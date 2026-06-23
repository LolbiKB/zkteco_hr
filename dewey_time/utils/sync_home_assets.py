import os
import shutil

import frappe

from dewey_time.utils.sync_hr_attendance_assets import (
    _needs_hr_attendance_resync,
    _remove_dest,
)


def sync_home_assets():
    """Copy the Vite-built /home launcher SPA into sites/assets on migrate.

    Mirrors sync_hr_attendance_assets' bundle handling (build-id aware,
    symlink-safe) for the home bundle, reusing its helpers. Branding images
    are published by sync_hr_attendance_assets.sync_app_branding_assets and
    are not duplicated here.
    """
    app = "dewey_time"
    app_path = frappe.get_app_path(app)
    src_dir = os.path.join(app_path, "public", "home")
    src_assets = os.path.join(src_dir, "assets")
    dest_dir = os.path.join(frappe.local.sites_path, "assets", app, "home")

    if not os.path.isdir(src_assets):
        return

    if os.path.lexists(dest_dir) and not _needs_hr_attendance_resync(src_dir, dest_dir):
        return

    if os.path.lexists(dest_dir):
        _remove_dest(dest_dir)

    if os.path.lexists(dest_dir):
        return

    # index.html contains Jinja; served only via www/home.
    shutil.copytree(
        src_dir,
        dest_dir,
        ignore=shutil.ignore_patterns("index.html"),
    )
