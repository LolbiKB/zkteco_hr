from __future__ import annotations

from collections import defaultdict

import frappe
from frappe.utils import add_days, getdate

from zkteco_hr.attendance_engine.closeout import _generate_for_employee_date
from zkteco_hr.attendance_engine.hr_calendar import _require_hr_role
from zkteco_hr.attendance_engine.intraday import refresh_intraday_flags_for_employee_date

VALID_MODES = frozenset({"intraday", "closeout", "both"})
MAX_RANGE_DAYS = 31


@frappe.whitelist()
def run_engine_for_employee(employee: str, start_date: str, end_date: str, mode: str = "both"):
    """Dev-only: recompute AUTO Attendance Flag rows for one employee over a date range."""
    _require_hr_role()

    employee = (employee or "").strip()
    if not employee:
        frappe.throw("employee is required")
    if not frappe.db.exists("Employee", employee):
        frappe.throw(f"Employee {employee} not found")

    if not start_date or not end_date:
        frappe.throw("start_date and end_date are required")

    start = getdate(start_date)
    end = getdate(end_date)
    if end < start:
        frappe.throw("end_date must be on or after start_date")

    day_count = (end - start).days + 1
    if day_count > MAX_RANGE_DAYS:
        frappe.throw(f"Date range cannot exceed {MAX_RANGE_DAYS} days")

    mode = (mode or "both").strip().lower()
    if mode not in VALID_MODES:
        frappe.throw(f"mode must be one of: {', '.join(sorted(VALID_MODES))}")

    current = start
    days_processed = 0
    while current <= end:
        if mode in ("intraday", "both"):
            refresh_intraday_flags_for_employee_date(employee, current)
        if mode in ("closeout", "both"):
            _generate_for_employee_date(
                employee=employee,
                attendance_date=current,
                include_unnotified_absence=True,
            )
        days_processed += 1
        current = add_days(current, 1)

    frappe.db.commit()

    return _build_response(
        employee=employee,
        start_date=str(start),
        end_date=str(end),
        mode=mode,
        days_processed=days_processed,
    )


def _build_response(*, employee, start_date, end_date, mode, days_processed):
    flags = (
        frappe.get_all(
            "Attendance Flag",
            filters={
                "employee": employee,
                "attendance_date": ["between", [start_date, end_date]],
            },
            fields=["attendance_date", "flag_code"],
            order_by="attendance_date asc, flag_code asc",
        )
        or []
    )

    by_date: dict[str, list[str]] = defaultdict(list)
    for row in flags:
        date_key = str(getdate(row["attendance_date"]))
        by_date[date_key].append(row["flag_code"])

    days = [
        {"date": date_key, "flag_codes": sorted(set(codes))}
        for date_key, codes in sorted(by_date.items())
    ]

    return {
        "ok": True,
        "employee": employee,
        "start_date": start_date,
        "end_date": end_date,
        "mode": mode,
        "days_processed": days_processed,
        "flags_after": len(flags),
        "days": days,
    }
