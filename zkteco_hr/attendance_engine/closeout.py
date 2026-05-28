import json
from datetime import datetime, timedelta

import frappe
from frappe.utils import add_days, get_datetime, getdate, nowdate


AUTO_FLAG_CODES = [
    "UNNOTIFIED_ABSENCE",
    "NON_PRIMARY_SITE_PUNCH",
    "LATE_START",
    "OFF_SHIFT_PUNCH",
    "MISSING_IN_OR_OUT",
    "UNKNOWN_DEVICE_BRANCH",
    # Lunch flags are intentionally optional/deferred for MVP (can be added later).
]

FLAG_SEVERITY = {
    "UNNOTIFIED_ABSENCE": "CRITICAL",
    "MISSING_IN_OR_OUT": "CRITICAL",
    "UNKNOWN_DEVICE_BRANCH": "CRITICAL",
    "OFF_SHIFT_PUNCH": "WARNING",
    "NON_PRIMARY_SITE_PUNCH": "WARNING",
    "LATE_START": "WARNING",
    "MISSING_LUNCH": "INFO",
    "LATE_FROM_LUNCH": "WARNING",
    "LATE_CHECKIN_AFTER_CLOSE": "INFO",
}


def run_yesterday_closeout():
    """Daily scheduler entrypoint (closeout-only MVP)."""
    d = add_days(getdate(nowdate()), -1)
    generate_auto_flags_for_date(d)


def generate_auto_flags_for_date(attendance_date):
    """
    Generate AUTO Attendance Flag rows for a single day.

    Idempotency: delete/recreate only AUTO flags for (employee, attendance_date).
    """
    attendance_date = getdate(attendance_date)

    employees = frappe.get_all("Employee", filters={"status": "Active"}, pluck="name") or []
    for employee in employees:
        _generate_for_employee_date(employee=employee, attendance_date=attendance_date)


def _generate_for_employee_date(*, employee: str, attendance_date):
    attendance_date = getdate(attendance_date)

    # Delete existing AUTO flags for this employee/day (never touch HR/EMPLOYEE).
    frappe.db.delete(
        "Attendance Flag",
        {
            "source": "AUTO",
            "employee": employee,
            "attendance_date": attendance_date,
        },
    )

    employee_doc = frappe.get_cached_doc("Employee", employee)
    employee_branch = getattr(employee_doc, "branch", None)
    employee_company = getattr(employee_doc, "company", None)

    shift_assignment = _get_shift_assignment(employee=employee, attendance_date=attendance_date)
    on_shift = bool(shift_assignment)

    checkins = _get_checkins_for_day(employee=employee, attendance_date=attendance_date)
    checkins_count = len(checkins)

    first_in_dt = checkins[0]["time"] if checkins else None
    last_out_dt = checkins[-1]["time"] if checkins else None

    evidence = {
        "employee": employee,
        "date": str(attendance_date),
        "on_shift": on_shift,
        "shift_type": shift_assignment.get("shift_type") if shift_assignment else None,
        "employee_branch": employee_branch,
        "checkins_count": checkins_count,
        "first_in": first_in_dt.isoformat() if first_in_dt else None,
        "last_out": last_out_dt.isoformat() if last_out_dt else None,
    }

    flags_to_create = []

    # Absent / off-shift punch / missing in/out
    if on_shift and checkins_count == 0:
        flags_to_create.append(("UNNOTIFIED_ABSENCE", {"reason": "on_shift_no_checkins"}))
    elif (not on_shift) and checkins_count > 0:
        flags_to_create.append(("OFF_SHIFT_PUNCH", {"reason": "off_shift_has_checkins"}))
    elif on_shift and checkins_count == 1:
        flags_to_create.append(("MISSING_IN_OR_OUT", {"reason": "single_checkin"}))

    # Device branch enrichment / mismatch against primary employee branch
    unknown_branch_hits = 0
    non_primary_hits = 0
    for c in checkins:
        device_branch = c.get("custom_device_branch")
        if not device_branch:
            unknown_branch_hits += 1
            continue
        # Some employees are inherently multi-branch, so Employee.branch may be blank.
        # In that case we cannot determine "non-primary" punches.
        if employee_branch and device_branch != employee_branch:
            non_primary_hits += 1

    if checkins_count > 0 and unknown_branch_hits > 0:
        flags_to_create.append(
            ("UNKNOWN_DEVICE_BRANCH", {"unknown_branch_checkins": unknown_branch_hits})
        )
    if checkins_count > 0 and employee_branch and non_primary_hits > 0:
        flags_to_create.append(
            (
                "NON_PRIMARY_SITE_PUNCH",
                {
                    "employee_branch": employee_branch,
                    "non_primary_checkins": non_primary_hits,
                },
            )
        )

    # Late start (only if on-shift and at least one checkin)
    if on_shift and first_in_dt and shift_assignment and shift_assignment.get("shift_type"):
        shift_meta = _get_shift_meta(shift_assignment["shift_type"])
        if shift_meta and shift_meta.get("start_time") is not None:
            grace = int(shift_meta.get("custom_grace_minutes") or 0)
            start_dt = _combine_date_time(attendance_date, shift_meta["start_time"])
            late_threshold = start_dt + timedelta(minutes=grace)
            evidence["shift_start"] = start_dt.isoformat()
            evidence["grace_minutes"] = grace
            evidence["late_threshold"] = late_threshold.isoformat()
            if first_in_dt > late_threshold:
                flags_to_create.append(
                    (
                        "LATE_START",
                        {
                            "first_in": first_in_dt.isoformat(),
                            "late_threshold": late_threshold.isoformat(),
                        },
                    )
                )

    # Create AUTO flags
    for flag_code, extra_evidence in flags_to_create:
        _insert_flag(
            employee=employee,
            company=employee_company,
            attendance_date=attendance_date,
            flag_code=flag_code,
            evidence={**evidence, **extra_evidence},
        )


def _insert_flag(*, employee, company, attendance_date, flag_code, evidence):
    doc = frappe.get_doc(
        {
            "doctype": "Attendance Flag",
            "employee": employee,
            "company": company,
            "attendance_date": attendance_date,
            "flag_code": flag_code,
            "severity": FLAG_SEVERITY.get(flag_code, "WARNING"),
            "source": "AUTO",
            "status": "OPEN",
            "day_closed": 1,
            "rule_version": "v0",
            "evidence": json.dumps(evidence, separators=(",", ":"), ensure_ascii=False),
        }
    )
    doc.insert(ignore_permissions=True)


def _get_shift_assignment(*, employee: str, attendance_date):
    rows = frappe.get_all(
        "Shift Assignment",
        filters={"employee": employee, "start_date": attendance_date},
        fields=["name", "shift_type", "start_date"],
        limit=1,
    )
    return rows[0] if rows else None


def _get_shift_meta(shift_type: str):
    try:
        doc = frappe.get_doc("Shift Type", shift_type)
    except Exception:
        return None

    return {
        "start_time": doc.start_time,
        "end_time": doc.end_time,
        "custom_grace_minutes": getattr(doc, "custom_grace_minutes", 0),
        "custom_lunch_start": getattr(doc, "custom_lunch_start", None),
        "custom_lunch_end": getattr(doc, "custom_lunch_end", None),
    }


def _get_checkins_for_day(*, employee: str, attendance_date):
    start = get_datetime(str(attendance_date) + " 00:00:00")
    end = get_datetime(str(attendance_date) + " 23:59:59")
    return (
        frappe.get_all(
            "Employee Checkin",
            filters={"employee": employee, "time": ["between", [start, end]]},
            fields=[
                "name",
                "time",
                "log_type",
                "device_id",
                "custom_device_branch",
            ],
            order_by="time asc",
        )
        or []
    )


def _combine_date_time(d, t):
    # Frappe returns Time values as datetime.time.
    if isinstance(d, str):
        d = getdate(d)
    if hasattr(t, "hour"):
        return datetime(d.year, d.month, d.day, t.hour, t.minute, t.second)
    # fallback
    dt = get_datetime(str(d) + " 00:00:00")
    return dt

