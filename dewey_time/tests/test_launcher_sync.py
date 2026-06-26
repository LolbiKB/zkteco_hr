"""Tests for the launcher-tile reconcile sync."""

import unittest
from unittest.mock import patch

from dewey_time.tests.test_closeout import _install_frappe_mock

_install_frappe_mock()

from dewey_time.attendance_engine import launcher_sync as mod  # noqa: E402


class _FakeDoc:
    def __init__(self, data):
        self.data = dict(data)
    def set(self, k, v):
        self.data[k] = v


def _tile(key, **over):
    t = {"key": key, "title": key.title(), "route": f"/{key}", "icon": f"/i/{key}.svg",
         "is_admin": False, "gate": f"app.gates.{key}", "order": 10}
    t.update(over)
    return t


def _run(*, installed, hooks_by_app, existing=None, prune_rows=None):
    existing = existing or {}
    prune_rows = prune_rows or []
    created, updated, deleted, get_all_calls = [], [], [], []

    def _get_hooks(hook, app_name=None, **kw):
        return list(hooks_by_app.get(app_name, []))

    def _exists(dt, name):
        return name in existing

    def _get_doc(arg, *a, **kw):
        if isinstance(arg, dict):
            d = _FakeDoc(arg)
            d.insert = lambda **k: created.append(dict(d.data))
            return d
        name = a[0]
        d = _FakeDoc({"name": name, **existing.get(name, {})})
        d.save = lambda **k: updated.append(dict(d.data))
        return d

    def _get_all(dt, filters=None, fields=None, **kw):
        get_all_calls.append({"doctype": dt, "filters": filters})
        return list(prune_rows)

    with patch.object(mod.frappe, "get_installed_apps", return_value=installed), \
         patch.object(mod.frappe, "get_hooks", side_effect=_get_hooks), \
         patch.object(mod.frappe.db, "exists", side_effect=_exists), \
         patch.object(mod.frappe, "get_doc", side_effect=_get_doc), \
         patch.object(mod.frappe, "get_all", side_effect=_get_all), \
         patch.object(mod.frappe, "delete_doc", side_effect=lambda dt, name, **k: deleted.append(name)), \
         patch.object(mod.frappe, "clear_cache"), \
         patch.object(mod.frappe, "log_error"):
        mod.sync_launcher_tiles()
    return {"created": created, "updated": updated, "deleted": deleted, "get_all": get_all_calls}


class SyncTests(unittest.TestCase):
    def test_insert_sets_code_and_seed_fields(self):
        r = _run(installed=["dewey_time"],
                 hooks_by_app={"dewey_time": [_tile("dewey_time", title="Dewey Time", is_admin=False)]})
        self.assertEqual(len(r["created"]), 1)
        c = r["created"][0]
        self.assertEqual(c["app_name"], "dewey_time")
        self.assertEqual(c["title"], "Dewey Time")
        self.assertEqual(c["source_app"], "dewey_time")
        self.assertEqual(c["enabled"], 1)
        self.assertEqual(c["tile_order"], 10)
        self.assertEqual(c["is_admin"], 0)

    def test_update_refreshes_code_only_keeps_admin_owned(self):
        r = _run(installed=["dewey_time"],
                 hooks_by_app={"dewey_time": [_tile("dewey_time", title="Dewey Time", order=10)]},
                 existing={"dewey_time": {"enabled": 0, "tile_order": 99, "title": "Old"}})
        self.assertEqual(len(r["updated"]), 1)
        u = r["updated"][0]
        self.assertEqual(u["title"], "Dewey Time")     # code-owned refreshed
        self.assertEqual(u["source_app"], "dewey_time")
        self.assertEqual(u["enabled"], 0)              # admin-owned preserved
        self.assertEqual(u["tile_order"], 99)          # admin-owned preserved

    def test_prune_removes_managed_tile_no_longer_declared(self):
        r = _run(installed=["dewey_time"],
                 hooks_by_app={"dewey_time": [_tile("dewey_time")]},
                 existing={"dewey_time": {}},
                 prune_rows=[{"name": "dewey_time", "source_app": "dewey_time"},
                             {"name": "gone", "source_app": "oldapp"}])
        self.assertEqual(r["deleted"], ["gone"])

    def test_prune_query_filters_to_managed_only(self):
        r = _run(installed=["dewey_time"], hooks_by_app={"dewey_time": [_tile("dewey_time")]},
                 existing={"dewey_time": {}})
        tile_calls = [c for c in r["get_all"] if c["doctype"] == "Launcher Tile"]
        self.assertTrue(any(c["filters"] == {"source_app": ["is", "set"]} for c in tile_calls))

    def test_key_collision_first_wins(self):
        r = _run(installed=["a", "b"],
                 hooks_by_app={"a": [_tile("x", title="From A")], "b": [_tile("x", title="From B")]})
        self.assertEqual(len(r["created"]), 1)
        self.assertEqual(r["created"][0]["title"], "From A")

    def test_missing_key_skipped(self):
        r = _run(installed=["a"], hooks_by_app={"a": [{"title": "No Key", "route": "/x", "gate": "desk"}]})
        self.assertEqual(r["created"], [])

    def test_exception_is_swallowed(self):
        with patch.object(mod.frappe, "get_installed_apps", side_effect=RuntimeError("boom")), \
             patch.object(mod.frappe, "log_error") as log:
            mod.sync_launcher_tiles()  # must not raise
        self.assertTrue(log.called)


if __name__ == "__main__":
    unittest.main()
