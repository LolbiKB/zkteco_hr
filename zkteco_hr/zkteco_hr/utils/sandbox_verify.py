"""Phase-1 verify STUB: the seam for the Phase-2 oracle layer.

Implements the crash oracle (this runs the engine output query; any exception
surfaces) and ONE invariant (no duplicate flags). Emits findings as JSON.
Run via: bench --site sandbox execute zkteco_hr.utils.sandbox_verify.run
"""
from __future__ import annotations

import json
from collections import Counter

import frappe


def no_duplicate_flags(rows: list[dict]) -> list[dict]:
    keys = Counter(
        (r["employee"], r["attendance_date"], r["flag_code"], r["day_closed"])
        for r in rows
    )
    return [
        {"employee": e, "attendance_date": d, "flag_code": f, "day_closed": c, "count": n}
        for (e, d, f, c), n in keys.items() if n > 1
    ]


def run() -> str:
    rows = frappe.get_all(
        "Attendance Flag",
        filters={"source": "AUTO"},
        fields=["employee", "attendance_date", "flag_code", "day_closed"],
        limit_page_length=0,
    )
    findings = {
        "oracle": "invariant:no_duplicate_flags",
        "scanned": len(rows),
        "violations": no_duplicate_flags(rows),
    }
    print(json.dumps(findings, default=str))
    return f"VERIFY_OK violations={len(findings['violations'])}"
