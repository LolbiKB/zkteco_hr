from zkteco_hr.utils.sync_hr_attendance_assets import (
    ATTENDANCE_APP_LOGO,
    force_sync_app_branding_assets,
)

import frappe


def execute():
    """Restore attendance icon on ZKTeco HR Desktop Icon (site favicon stays DI-logo)."""
    force_sync_app_branding_assets()

    if frappe.db.exists("Desktop Icon", "ZKTeco HR"):
        frappe.db.set_value("Desktop Icon", "ZKTeco HR", "logo_url", ATTENDANCE_APP_LOGO)

    frappe.clear_cache()
