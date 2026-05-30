import os

import frappe
from frappe.utils import get_system_timezone

no_cache = 1


def _hr_attendance_asset_version() -> str:
    js_path = os.path.join(
        frappe.get_app_path("zkteco_hr"),
        "public",
        "hr_attendance",
        "assets",
        "index.js",
    )
    if os.path.isfile(js_path):
        return str(int(os.path.getmtime(js_path)))
    return "0"


def get_context(context):
    csrf_token = frappe.sessions.get_csrf_token()
    frappe.db.commit()

    context.update(
        {
            "csrf_token": csrf_token,
            "asset_version": _hr_attendance_asset_version(),
            "boot": get_boot(),
        }
    )
    return context


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
    if not frappe.conf.developer_mode:
        frappe.throw("This method is only meant for developer mode")
    return get_boot()


def get_boot():
    return frappe._dict(
        {
            "frappe_version": frappe.__version__,
            "site_name": frappe.local.site,
            "read_only_mode": frappe.flags.read_only,
            "system_timezone": get_system_timezone(),
        }
    )
