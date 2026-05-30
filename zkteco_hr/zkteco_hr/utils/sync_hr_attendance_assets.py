import os
import shutil

import frappe


def sync_hr_attendance_assets():
    """
    Copy Vite-built SPA assets into sites/assets for Frappe Cloud.

    Only copies the assets/ subtree (JS/CSS). Do not copy index.html — it contains
    Jinja and must be served via www/hr-attendance, not as a static asset.
    """
    app = "zkteco_hr"
    app_path = frappe.get_app_path(app)
    src_assets = os.path.join(app_path, "public", "hr_attendance", "assets")
    dest_dir = os.path.join(frappe.local.sites_path, "assets", app, "hr_attendance")
    dest_assets = os.path.join(dest_dir, "assets")

    if not os.path.isdir(src_assets):
        return

    os.makedirs(dest_dir, exist_ok=True)
    if os.path.exists(dest_assets):
        shutil.rmtree(dest_assets)

    shutil.copytree(src_assets, dest_assets)
