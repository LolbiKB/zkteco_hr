import os
import shutil

import frappe


def execute():
    """
    Ensure Vite-built HR Attendance assets exist under sites/assets after migrate.

    Frappe Cloud should symlink public/ on bench build, but this patch is a safe
    fallback when assets are missing (404 / text/html MIME for CSS).
    """
    app = "zkteco_hr"
    app_path = frappe.get_app_path(app)
    src_dir = os.path.join(app_path, "public")
    dest_dir = os.path.join(frappe.local.sites_path, "assets", app)

    os.makedirs(dest_dir, exist_ok=True)

    for name in ("hr_attendance.bundle.js", "hr_attendance.bundle.css", "hr_attendance.bundle.js.map"):
        src = os.path.join(src_dir, name)
        if not os.path.isfile(src):
            continue
        shutil.copy2(src, os.path.join(dest_dir, name))
