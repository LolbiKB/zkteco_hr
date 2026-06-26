"""Wiring tests: the dewey_launcher_tiles hook is well-formed and resolvable."""

import importlib
import sys
import unittest
from unittest.mock import MagicMock

from dewey_time.tests.test_closeout import _install_frappe_mock

_install_frappe_mock()

if "requests" not in sys.modules:
    _requests_stub = MagicMock(name="requests")

    class _RequestException(Exception):
        pass

    _requests_stub.RequestException = _RequestException
    sys.modules["requests"] = _requests_stub

import dewey_time.hooks as hooks  # noqa: E402

_BUILTINS = {"desk", "roles"}


def _resolve(path):
    mod_path, attr = path.rsplit(".", 1)
    return getattr(importlib.import_module(mod_path), attr)


class HookShapeTests(unittest.TestCase):
    def test_is_list_of_tiles(self):
        self.assertIsInstance(hooks.dewey_launcher_tiles, list)
        self.assertGreaterEqual(len(hooks.dewey_launcher_tiles), 3)

    def test_required_keys_present(self):
        for t in hooks.dewey_launcher_tiles:
            for field in ("key", "title", "route", "gate"):
                self.assertIn(field, t, f"{t} missing {field}")

    def test_keys_unique(self):
        keys = [t["key"] for t in hooks.dewey_launcher_tiles]
        self.assertEqual(len(keys), len(set(keys)))

    def test_dewey_time_tile_titled_dewey_time(self):
        by_key = {t["key"]: t for t in hooks.dewey_launcher_tiles}
        self.assertEqual(by_key["dewey_time"]["title"], "Dewey Time")

    def test_gates_resolve(self):
        for t in hooks.dewey_launcher_tiles:
            gate = t["gate"]
            if gate in _BUILTINS:
                continue
            self.assertIn(".", gate, f"{gate} is neither built-in nor dotted")
            self.assertTrue(callable(_resolve(gate)), f"{gate} not callable")

    def test_sync_registered_in_after_migrate(self):
        self.assertIn(
            "dewey_time.attendance_engine.launcher_sync.sync_launcher_tiles",
            hooks.after_migrate,
        )


if __name__ == "__main__":
    unittest.main()
