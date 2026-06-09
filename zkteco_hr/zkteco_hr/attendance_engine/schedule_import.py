"""
Spreadsheet-based bulk schedule import.

Accepts a CSV (or xlsx) in the canonical import format:

  employee_id  | email | am_from | am_to | pm_from | pm_to | days_off

  - times: HH:MM 24h (07:30, 12:00, 17:00)
  - pm_from / pm_to: "off" or blank when no afternoon shift
  - days_off: pipe-separated list of weekday names; append "(am)" to mark a
    day where the employee works mornings only, e.g.
      Saturday|Sunday
      Saturday(am)|Sunday
      Sunday

Use the Haiku prompt in docs/SCHEDULE_IMPORT_PROMPT.md to normalise any raw
spreadsheet into this format before importing.

Exposed API: parse_schedule_upload(file_b64, filename)
"""

from __future__ import annotations

import base64
import csv
import io
import re

import frappe

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
_WEEKDAY_IDX: dict[str, int] = {d: i for i, d in enumerate(WEEKDAYS)}

_DAY_ALIASES: dict[str, str] = {
    "mon": "Monday", "monday": "Monday",
    "tue": "Tuesday", "tues": "Tuesday", "tuesday": "Tuesday",
    "wed": "Wednesday", "wednesday": "Wednesday",
    "thu": "Thursday", "thur": "Thursday", "thurs": "Thursday", "thursday": "Thursday",
    "fri": "Friday", "friday": "Friday",
    "sat": "Saturday", "saturday": "Saturday",
    "sun": "Sunday", "sunday": "Sunday",
}

_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")
_ID_PATTERN = re.compile(r"^[A-Za-z]{1,4}-\d{2,}", re.IGNORECASE)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalize_weekday(s: str) -> str | None:
    return _DAY_ALIASES.get(s.strip().lower())


def _is_blank(value) -> bool:
    return not value or str(value).strip().lower() in ("", "off", "none", "n/a", "-")


def _cell(value) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    return "" if s.lower() in ("nan", "none") else s


def _parse_time(value) -> str | None:
    """Accept HH:MM 24h only (Haiku prompt normalises everything to this)."""
    text = _cell(value)
    if not text or _is_blank(text):
        return None
    m = _TIME_RE.match(text)
    if not m:
        return None
    return text.zfill(5)  # ensure "7:30" → "07:30"


def _parse_days_off(raw: str) -> tuple[list[str], list[str]]:
    """
    Parse the days_off column.
    Format: pipe-separated weekday names; append "(am)" for morning-only days.

    Examples:
      "Saturday|Sunday"           → full_off=[Sat, Sun], am_only=[]
      "Saturday(am)|Sunday"       → full_off=[Sun],      am_only=[Sat]
      "Sunday"                    → full_off=[Sun],       am_only=[]

    Returns (full_off, am_only).
    """
    full_off: list[str] = []
    am_only: list[str] = []

    if not raw or not raw.strip():
        return full_off, am_only

    for token in re.split(r"[|;,]", raw):
        token = token.strip()
        if not token:
            continue
        is_am = bool(re.search(r"\(am\)", token, re.IGNORECASE))
        day_name = re.sub(r"\(am\)", "", token, flags=re.IGNORECASE).strip()
        weekday = _normalize_weekday(day_name)
        if not weekday:
            continue
        if is_am:
            am_only.append(weekday)
        else:
            full_off.append(weekday)

    return (
        sorted(full_off, key=lambda d: _WEEKDAY_IDX[d]),
        sorted(am_only, key=lambda d: _WEEKDAY_IDX[d]),
    )


# ---------------------------------------------------------------------------
# File reading
# ---------------------------------------------------------------------------


def _read_xlsx(file_bytes: bytes) -> list[list]:
    from openpyxl import load_workbook  # noqa: PLC0415

    wb = load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active
    return [[_cell(cell.value) for cell in row] for row in ws.iter_rows()]


def _read_csv(file_bytes: bytes) -> list[list]:
    text = file_bytes.decode("utf-8-sig", errors="replace")
    return [row for row in csv.reader(io.StringIO(text))]


def _find_data_start(rows: list[list]) -> int:
    for i, row in enumerate(rows):
        if row and _ID_PATTERN.match(str(row[0]).strip()):
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
# WeekPattern builder
# ---------------------------------------------------------------------------


def _build_week_pattern(
    am_from: str,
    am_to: str,
    pm_from: str | None,
    pm_to: str | None,
    full_off: list[str],
    am_only: list[str],
) -> dict:
    full_off_set = set(full_off)
    am_only_set = set(am_only)
    has_pm = bool(pm_from and pm_to)

    days = []
    for weekday in WEEKDAYS:
        if weekday in full_off_set:
            days.append({"weekday": weekday, "works": False})
            continue
        if weekday in am_only_set or not has_pm:
            days.append({
                "weekday": weekday, "works": True,
                "start_time": am_from, "end_time": am_to,
                "lunch_start": None, "lunch_end": None,
                "grace_minutes": 10,
            })
        else:
            days.append({
                "weekday": weekday, "works": True,
                "start_time": am_from, "end_time": pm_to,
                "lunch_start": am_to, "lunch_end": pm_from,
                "grace_minutes": 10,
            })

    return {"frequency": "Every Week", "days": days}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


@frappe.whitelist()
def parse_schedule_upload(file_b64: str, filename: str = "upload.csv") -> dict:
    """
    Parse a base64-encoded canonical schedule CSV/xlsx and return a preview.

    Expected columns (header row optional):
      employee_id, email, am_from, am_to, pm_from, pm_to, days_off
    """
    try:
        file_bytes = base64.b64decode(file_b64)
    except Exception as exc:
        frappe.throw(f"Invalid file data: {exc}")

    ext = (filename or "").lower().rsplit(".", 1)[-1]
    try:
        raw_rows = _read_csv(file_bytes) if ext == "csv" else _read_xlsx(file_bytes)
    except Exception as exc:
        frappe.throw(f"Failed to read file: {exc}")

    data_start = _find_data_start(raw_rows)
    if data_start >= len(raw_rows):
        frappe.throw(
            "No employee rows found. "
            "First column must be an employee ID (e.g. DI-0159). "
            "Use the Haiku prompt to normalise your spreadsheet first."
        )

    result_rows = []
    for raw in raw_rows[data_start:]:
        while len(raw) < 7:
            raw.append("")

        id_card = _cell(raw[0])
        if not id_card:
            continue

        email = _cell(raw[1])
        am_from = _parse_time(raw[2])
        am_to = _parse_time(raw[3])
        pm_from = _parse_time(raw[4]) if not _is_blank(raw[4]) else None
        pm_to = _parse_time(raw[5]) if not _is_blank(raw[5]) else None
        full_off, am_only = _parse_days_off(_cell(raw[6]))

        warnings: list[str] = []
        if not am_from or not am_to:
            warnings.append(
                f"AM times missing or wrong format ({_cell(raw[2])!r} – {_cell(raw[3])!r}). "
                "Expected HH:MM 24h."
            )

        employee, employee_name = _lookup_employee(id_card, email)
        if not employee:
            warnings.append(f"No active employee found for {id_card!r}")

        week_pattern = None
        if am_from and am_to:
            week_pattern = _build_week_pattern(am_from, am_to, pm_from, pm_to, full_off, am_only)

        result_rows.append({
            "id_card": id_card,
            "email": email,
            "employee": employee,
            "employee_name": employee_name,
            "matched": bool(employee),
            "am_from": am_from,
            "am_to": am_to,
            "pm_from": pm_from,
            "pm_to": pm_to,
            "day_off": {"full_off": full_off, "afternoon_off": am_only},
            "week_pattern": week_pattern,
            "warnings": warnings,
        })

    return {"rows": result_rows, "normalized_by": "rules"}
