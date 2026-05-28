import frappe
from frappe.model.document import Document


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


class AttendanceFlag(Document):
    def before_insert(self):
        if not self.severity and self.flag_code:
            self.severity = FLAG_SEVERITY.get(self.flag_code, "WARNING")

        # For AUTO flags we use a deterministic name so reruns are idempotent.
        # Other sources (HR/EMPLOYEE) can use Frappe's default naming.
        if (self.source or "").upper() == "AUTO":
            if not (self.employee and self.attendance_date and self.flag_code):
                frappe.throw("AUTO flags require employee, attendance_date, and flag_code")

            key = "AUTO-{0}-{1}-{2}".format(
                frappe.scrub(self.employee),
                str(self.attendance_date),
                frappe.scrub(self.flag_code),
            )
            # Frappe name length constraints vary by backend; keep it reasonable.
            self.name = key[:140]

            # Fill Company when possible (matches your DocType spec).
            if not self.company:
                self.company = frappe.db.get_value("Employee", self.employee, "company")

