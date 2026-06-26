"""Reconcile `dewey_launcher_tiles` hook declarations into Launcher Tile rows.

Runs on after_migrate. Reconcile, not replace: code owns
title/route/icon/is_admin/gate (+ source_app provenance); admins own enabled +
tile_order (seeded once from the hook's `order`). Managed tiles whose registering
app is gone are pruned; hand-made tiles (blank source_app) are never touched.
"""

import frappe

_DOCTYPE = "Launcher Tile"


def _declared_tiles():
    """[(declaring_app, tile_dict)] across installed apps; first-wins on key clash."""
    seen = {}
    out = []
    for app in frappe.get_installed_apps():
        for tile in frappe.get_hooks("dewey_launcher_tiles", app_name=app) or []:
            key = tile.get("key")
            if not key:
                frappe.log_error(title="launcher tile missing key", message=str(tile))
                continue
            if key in seen:
                frappe.log_error(
                    title="launcher tile key collision",
                    message=f"{key}: kept {seen[key]}, ignored {app}",
                )
                continue
            seen[key] = app
            out.append((app, tile))
    return out


def sync_launcher_tiles():
    try:
        declared = _declared_tiles()
        declared_keys = {tile["key"] for _app, tile in declared}

        for app, tile in declared:
            key = tile["key"]
            code_fields = {
                "title": tile.get("title"),
                "route": tile.get("route"),
                "icon": tile.get("icon") or "",
                "is_admin": 1 if tile.get("is_admin") else 0,
                "gate": tile.get("gate"),
                "source_app": app,
            }
            if frappe.db.exists(_DOCTYPE, key):
                doc = frappe.get_doc(_DOCTYPE, key)
                for field, value in code_fields.items():
                    doc.set(field, value)
                doc.save(ignore_permissions=True)  # enabled + tile_order untouched
            else:
                doc = frappe.get_doc({
                    "doctype": _DOCTYPE,
                    "app_name": key,
                    "enabled": 1,
                    "tile_order": tile.get("order") or 0,
                    **code_fields,
                })
                doc.insert(ignore_permissions=True)

        # Prune managed tiles (source_app set) whose app no longer declares them.
        for row in frappe.get_all(
            _DOCTYPE, filters={"source_app": ["is", "set"]}, fields=["name", "source_app"]
        ):
            if row["name"] not in declared_keys:
                frappe.delete_doc(_DOCTYPE, row["name"], ignore_permissions=True, force=True)

        frappe.clear_cache()
    except Exception:
        frappe.log_error(title="sync_launcher_tiles failed")  # never break migrate
