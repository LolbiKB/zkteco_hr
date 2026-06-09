"""
Spreadsheet-based bulk schedule import.

Normalisation strategy (in order):
  1. AI model (Claude / OpenAI / any OpenAI-compatible) — handles any column
     order, time format, or day-off description style.
  2. Rule-based fallback — used when no API key is configured or the AI call
     fails.

Site-config keys (frappe bench set-config):
  anthropic_api_key          Anthropic API key  (primary if model is claude-*)
  openai_api_key             OpenAI API key (used when model is gpt-* / o1*)
  schedule_import_model      model name, default "claude-3-5-haiku-20241022"
  schedule_import_base_url   base URL for OpenAI-compatible providers (optional)

Exposed API: parse_schedule_upload(file_b64, filename)
"""

from __future__ import annotations

import base64
import io
import json
import re

import frappe

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
_WEEKDAY_IDX: dict[str, int] = {d: i for i, d in enumerate(WEEKDAYS)}
_WEEKDAY_SET = set(WEEKDAYS)

_DAY_ALIASES: dict[str, str] = {
    "mon": "Monday", "monday": "Monday",
    "tue": "Tuesday", "tues": "Tuesday", "tuesday": "Tuesday",
    "wed": "Wednesday", "wednesday": "Wednesday",
    "thu": "Thursday", "thur": "Thursday", "thurs": "Thursday", "thursday": "Thursday",
    "fri": "Friday", "friday": "Friday",
    "sat": "Saturday", "saturday": "Saturday",
    "sun": "Sunday", "sunday": "Sunday",
}

_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})\s*(am|pm)?$", re.IGNORECASE)
_ID_PATTERN = re.compile(r"^[A-Za-z]{1,4}-\d{2,}", re.IGNORECASE)

_DEFAULT_MODEL = "claude-3-5-haiku-20241022"

# ---------------------------------------------------------------------------
# AI normalisation
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You parse employee schedule spreadsheets and return structured JSON.
Respond with ONLY a raw JSON array — no markdown, no explanation.
"""

_USER_PROMPT_TMPL = """\
Here is a raw employee schedule spreadsheet (rows tab-separated, including any header rows):

{tsv}

Return a JSON array with one object per data row (skip header/blank rows):
[
  {{
    "employee_id": "badge or card number e.g. DI-0159",
    "email": "email or null",
    "am_from": "morning start as HH:MM 24h e.g. 07:30, or null",
    "am_to":   "morning end   as HH:MM 24h e.g. 12:00, or null",
    "pm_from": "afternoon start as HH:MM 24h e.g. 13:00, or null if no afternoon",
    "pm_to":   "afternoon end   as HH:MM 24h e.g. 17:00, or null if no afternoon",
    "days_off":    ["fully off day names from: Monday Tuesday Wednesday Thursday Friday Saturday Sunday"],
    "days_am_only": ["days where employee works mornings only even if they normally have an afternoon shift"]
  }}
]

Rules:
- Normalise any time format (7:30am, 730, 07:30, 7h30, etc.) to HH:MM 24h.
- If PM column says "off", "-", blank, or similar → pm_from and pm_to are null.
- "Day off" column describes which days/half-days the employee does NOT work.
  Parse it to populate days_off (fully absent) and days_am_only (present AM only).
- Return ONLY the JSON array.
"""


def _rows_to_tsv(rows: list[list]) -> str:
    lines = []
    for row in rows:
        cells = [str(v) if v is not None else "" for v in row]
        lines.append("\t".join(cells))
    return "\n".join(lines)


def _get_ai_config() -> dict | None:
    """Return {model, provider, api_key, base_url} or None if no key is configured."""
    model = frappe.conf.get("schedule_import_model") or _DEFAULT_MODEL
    base_url = frappe.conf.get("schedule_import_base_url") or ""

    # Determine provider from model name
    if model.startswith("gpt") or model.startswith("o1") or model.startswith("o3"):
        provider = "openai"
    else:
        provider = "anthropic"

    if provider == "openai":
        api_key = frappe.conf.get("openai_api_key") or ""
        if not api_key:
            # Fallback: maybe anthropic key is set with an OpenAI-compatible base_url
            api_key = frappe.conf.get("anthropic_api_key") or ""
    else:
        api_key = frappe.conf.get("anthropic_api_key") or ""
        if not api_key:
            api_key = frappe.conf.get("openai_api_key") or ""
            if api_key:
                provider = "openai"

    if not api_key:
        return None

    return {"model": model, "provider": provider, "api_key": api_key, "base_url": base_url}


def _call_anthropic(cfg: dict, prompt: str) -> str:
    import requests  # noqa: PLC0415

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": cfg["api_key"],
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": cfg["model"],
            "max_tokens": 4096,
            "system": _SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["content"][0]["text"]


def _call_openai(cfg: dict, prompt: str) -> str:
    import requests  # noqa: PLC0415

    base = (cfg.get("base_url") or "https://api.openai.com").rstrip("/")
    resp = requests.post(
        f"{base}/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {cfg['api_key']}",
            "content-type": "application/json",
        },
        json={
            "model": cfg["model"],
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 4096,
        },
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _clean_weekday_list(raw: list | None) -> list[str]:
    if not raw:
        return []
    out = []
    for item in raw:
        d = _DAY_ALIASES.get(str(item).strip().lower())
        if d:
            out.append(d)
        elif str(item).strip() in _WEEKDAY_SET:
            out.append(str(item).strip())
    return sorted(set(out), key=lambda d: _WEEKDAY_IDX[d])


def _ai_normalize_rows(raw_rows: list[list]) -> list[dict]:
    """
    Call the configured AI model and return per-row dicts:
      {employee_id, email, am_from, am_to, pm_from, pm_to, days_off, days_am_only}

    Raises on failure (caller falls back to rule-based).
    """
    cfg = _get_ai_config()
    if not cfg:
        raise RuntimeError("No AI API key configured")

    tsv = _rows_to_tsv(raw_rows)
    prompt = _USER_PROMPT_TMPL.format(tsv=tsv)

    if cfg["provider"] == "anthropic":
        raw_text = _call_anthropic(cfg, prompt)
    else:
        raw_text = _call_openai(cfg, prompt)

    # Strip possible markdown fences the model might add despite instructions
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned.strip())

    parsed = json.loads(cleaned)
    if not isinstance(parsed, list):
        raise ValueError("AI returned non-list JSON")

    result = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        employee_id = str(item.get("employee_id") or "").strip()
        if not employee_id:
            continue
        result.append(
            {
                "employee_id": employee_id,
                "email": str(item.get("email") or "").strip(),
                "am_from": item.get("am_from") or None,
                "am_to": item.get("am_to") or None,
                "pm_from": item.get("pm_from") or None,
                "pm_to": item.get("pm_to") or None,
                "days_off": _clean_weekday_list(item.get("days_off")),
                "days_am_only": _clean_weekday_list(item.get("days_am_only")),
                "_source": "ai",
            }
        )
    return result


# ---------------------------------------------------------------------------
# Rule-based fallback normalisation
# ---------------------------------------------------------------------------


def _normalize_weekday(s: str) -> str | None:
    return _DAY_ALIASES.get(s.lower().strip())


def _expand_day_range(start: str, end: str) -> list[str]:
    s = _normalize_weekday(start)
    e = _normalize_weekday(end)
    if not s or not e:
        return []
    si, ei = _WEEKDAY_IDX[s], _WEEKDAY_IDX[e]
    return WEEKDAYS[si : ei + 1] if si <= ei else []


def _parse_day_off_text(text) -> dict:
    if not text or str(text).strip().lower() in ("nan", "none", ""):
        return {"days_off": [], "days_am_only": []}

    text = str(text).strip()
    full_off: set[str] = set()
    afternoon_off: set[str] = set()

    pm_re = re.compile(r"([A-Za-z]+-[A-Za-z]+|[A-Za-z]+)\s*\(Afternoon\)", re.IGNORECASE)
    remaining = text
    for m in pm_re.finditer(text):
        remaining = remaining.replace(m.group(0), "")
        part = m.group(1)
        if "-" in part:
            s, e = part.split("-", 1)
            afternoon_off.update(_expand_day_range(s.strip(), e.strip()))
        else:
            d = _normalize_weekday(part)
            if d:
                afternoon_off.add(d)

    for token in re.split(r"[&,+]|\band\b", remaining, flags=re.IGNORECASE):
        token = token.strip()
        if not token:
            continue
        if "-" in token:
            parts = token.split("-", 1)
            if _normalize_weekday(parts[0].strip()) and _normalize_weekday(parts[1].strip()):
                full_off.update(_expand_day_range(parts[0].strip(), parts[1].strip()))
        else:
            d = _normalize_weekday(token)
            if d:
                full_off.add(d)

    return {
        "days_off": sorted(full_off, key=lambda d: _WEEKDAY_IDX[d]),
        "days_am_only": sorted(afternoon_off, key=lambda d: _WEEKDAY_IDX[d]),
    }


def _is_off(value) -> bool:
    if value is None:
        return True
    return str(value).strip().lower() in ("nan", "none", "", "off", "-", "n/a")


def _parse_time(value) -> str | None:
    if _is_off(value):
        return None
    text = str(value).strip()
    m = _TIME_RE.match(text)
    if not m:
        return None
    h, mi, period = int(m.group(1)), int(m.group(2)), (m.group(3) or "").lower()
    if period == "pm" and h != 12:
        h += 12
    elif period == "am" and h == 12:
        h = 0
    return f"{h:02d}:{mi:02d}"


def _cell_str(value) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    return "" if s.lower() in ("nan", "none") else s


def _rule_normalize_rows(raw_rows: list[list], data_start: int) -> list[dict]:
    """Fallback: column-position-based parsing for the known format."""
    result = []
    for raw in raw_rows[data_start:]:
        while len(raw) < 7:
            raw.append(None)

        employee_id = _cell_str(raw[0])
        if not employee_id:
            continue

        day_off_data = _parse_day_off_text(raw[6])
        result.append(
            {
                "employee_id": employee_id,
                "email": _cell_str(raw[1]),
                "am_from": _parse_time(raw[2]),
                "am_to": _parse_time(raw[3]),
                "pm_from": _parse_time(raw[4]) if not _is_off(raw[4]) else None,
                "pm_to": _parse_time(raw[5]) if not _is_off(raw[5]) else None,
                "days_off": day_off_data["days_off"],
                "days_am_only": day_off_data["days_am_only"],
                "_source": "rules",
            }
        )
    return result


# ---------------------------------------------------------------------------
# File reading
# ---------------------------------------------------------------------------


def _parse_xlsx_bytes(file_bytes: bytes) -> list[list]:
    from openpyxl import load_workbook  # noqa: PLC0415

    wb = load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active
    return [[cell.value for cell in row] for row in ws.iter_rows()]


def _parse_csv_bytes(file_bytes: bytes) -> list[list]:
    import csv  # noqa: PLC0415

    text = file_bytes.decode("utf-8-sig", errors="replace")
    return list(csv.reader(io.StringIO(text)))


def _find_data_start(rows: list[list]) -> int:
    for i, row in enumerate(rows):
        if row and row[0] is not None and _ID_PATTERN.match(str(row[0]).strip()):
            return i
    return len(rows)


# ---------------------------------------------------------------------------
# Employee lookup
# ---------------------------------------------------------------------------


def _lookup_employee(id_card: str, email: str = "") -> tuple[str | None, str | None]:
    for field in ("employee_number", "attendance_device_id"):
        result = frappe.db.get_value(
            "Employee",
            {field: id_card, "status": "Active"},
            ["name", "employee_name"],
            as_dict=True,
        )
        if result:
            return result["name"], result["employee_name"]

    if email:
        for email_field in ("company_email", "personal_email"):
            result = frappe.db.get_value(
                "Employee",
                {email_field: email, "status": "Active"},
                ["name", "employee_name"],
                as_dict=True,
            )
            if result:
                return result["name"], result["employee_name"]

    return None, None


# ---------------------------------------------------------------------------
# WeekPattern builder (shared by both paths)
# ---------------------------------------------------------------------------


def _build_week_pattern(normalized: dict) -> dict:
    """
    Build a WeekPattern dict from a normalized row dict.

    normalized keys used:
      am_from, am_to, pm_from, pm_to, days_off, days_am_only
    """
    am_from = normalized.get("am_from")
    am_to = normalized.get("am_to")
    pm_from = normalized.get("pm_from")
    pm_to = normalized.get("pm_to")
    full_off = set(normalized.get("days_off") or [])
    afternoon_off = set(normalized.get("days_am_only") or [])
    has_pm = bool(pm_from and pm_to)

    days = []
    for weekday in WEEKDAYS:
        if weekday in full_off:
            days.append({"weekday": weekday, "works": False})
            continue

        if weekday in afternoon_off or not has_pm:
            days.append(
                {
                    "weekday": weekday,
                    "works": True,
                    "start_time": am_from,
                    "end_time": am_to,
                    "lunch_start": None,
                    "lunch_end": None,
                    "grace_minutes": 10,
                }
            )
        else:
            days.append(
                {
                    "weekday": weekday,
                    "works": True,
                    "start_time": am_from,
                    "end_time": pm_to,
                    "lunch_start": am_to,
                    "lunch_end": pm_from,
                    "grace_minutes": 10,
                }
            )

    return {"frequency": "Every Week", "days": days}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


@frappe.whitelist()
def parse_schedule_upload(file_b64: str, filename: str = "upload.xlsx") -> dict:
    """
    Parse a base64-encoded xlsx/csv schedule file and return a structured preview.

    Tries AI normalisation first (reads schedule_import_model + anthropic_api_key /
    openai_api_key from site_config).  Falls back to column-position rules if no
    key is configured or the AI call fails.

    Returns {"rows": [...], "normalized_by": "ai" | "rules"}
    """
    try:
        file_bytes = base64.b64decode(file_b64)
    except Exception as exc:
        frappe.throw(f"Invalid file data: {exc}")

    ext = (filename or "").lower().rsplit(".", 1)[-1]
    try:
        raw_rows = _parse_csv_bytes(file_bytes) if ext == "csv" else _parse_xlsx_bytes(file_bytes)
    except Exception as exc:
        frappe.throw(f"Failed to read spreadsheet: {exc}")

    data_start = _find_data_start(raw_rows)
    if data_start >= len(raw_rows):
        frappe.throw(
            "No employee rows detected. "
            "Expected rows where the first column is an employee ID (e.g. DI-0159)."
        )

    # Attempt AI normalisation (send all rows including headers for context)
    normalized_by = "ai"
    ai_error = None
    try:
        normalized_rows = _ai_normalize_rows(raw_rows)
    except Exception as exc:
        ai_error = str(exc)
        normalized_by = "rules"
        normalized_rows = _rule_normalize_rows(raw_rows, data_start)

    # Build result rows (employee lookup + WeekPattern)
    result_rows = []
    for norm in normalized_rows:
        id_card = norm.get("employee_id") or ""
        email = norm.get("email") or ""
        am_from = norm.get("am_from")
        am_to = norm.get("am_to")
        pm_from = norm.get("pm_from")
        pm_to = norm.get("pm_to")

        warnings: list[str] = []
        if not am_from or not am_to:
            warnings.append("AM shift times missing or unparseable")

        employee, employee_name = _lookup_employee(id_card, email)
        if not employee:
            warnings.append(f"No active employee found for ID card {id_card!r}")

        week_pattern = None
        if am_from and am_to:
            week_pattern = _build_week_pattern(norm)

        result_rows.append(
            {
                "id_card": id_card,
                "email": email,
                "employee": employee,
                "employee_name": employee_name,
                "matched": bool(employee),
                "am_from": am_from,
                "am_to": am_to,
                "pm_from": pm_from,
                "pm_to": pm_to,
                "day_off": {
                    "full_off": norm.get("days_off") or [],
                    "afternoon_off": norm.get("days_am_only") or [],
                },
                "week_pattern": week_pattern,
                "warnings": warnings,
                "_normalized_by": norm.get("_source", normalized_by),
            }
        )

    out: dict = {"rows": result_rows, "normalized_by": normalized_by}
    if ai_error:
        out["ai_error"] = ai_error
    return out
