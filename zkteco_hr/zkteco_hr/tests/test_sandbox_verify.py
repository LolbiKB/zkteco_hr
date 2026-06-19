import unittest

from zkteco_hr.tests.test_closeout import _install_frappe_mock

_install_frappe_mock()

from zkteco_hr.utils import sandbox_verify as sv  # noqa: E402


class TestNoDuplicateFlags(unittest.TestCase):
    def test_detects_duplicate(self):
        rows = [
            {"employee": "E1", "attendance_date": "2026-06-01", "flag_code": "LATE_START", "day_closed": 1},
            {"employee": "E1", "attendance_date": "2026-06-01", "flag_code": "LATE_START", "day_closed": 1},
            {"employee": "E1", "attendance_date": "2026-06-02", "flag_code": "LATE_START", "day_closed": 1},
        ]
        violations = sv.no_duplicate_flags(rows)
        self.assertEqual(len(violations), 1)
        self.assertEqual(violations[0]["count"], 2)

    def test_clean_set_has_no_violations(self):
        rows = [
            {"employee": "E1", "attendance_date": "2026-06-01", "flag_code": "LATE_START", "day_closed": 1},
            {"employee": "E1", "attendance_date": "2026-06-01", "flag_code": "LEFT_EARLY", "day_closed": 1},
        ]
        self.assertEqual(sv.no_duplicate_flags(rows), [])


if __name__ == "__main__":
    unittest.main()
