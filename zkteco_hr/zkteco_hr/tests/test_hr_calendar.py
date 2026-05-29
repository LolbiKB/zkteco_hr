import unittest
from unittest.mock import patch

from zkteco_hr.tests.test_closeout import _install_frappe_mock

_install_frappe_mock()

from zkteco_hr.attendance_engine.hr_calendar import (
    _shift_schedule_assignment_start_field,
    is_full_time_employment,
)


class TestHrCalendarHelpers(unittest.TestCase):
    def test_full_time_employment(self):
        self.assertTrue(is_full_time_employment("Full-time"))
        self.assertTrue(is_full_time_employment("Full Time"))
        self.assertTrue(is_full_time_employment("FULL TIME"))

    def test_not_full_time(self):
        self.assertFalse(is_full_time_employment(None))
        self.assertFalse(is_full_time_employment(""))
        self.assertFalse(is_full_time_employment("Part-time"))
        self.assertFalse(is_full_time_employment("Contract"))

    def test_ssa_start_field_prefers_create_shifts_after(self):
        with patch("zkteco_hr.attendance_engine.hr_calendar.frappe.db.has_column") as has_column:
            has_column.side_effect = lambda _dt, col: col == "create_shifts_after"
            self.assertEqual(_shift_schedule_assignment_start_field(), "create_shifts_after")

    def test_ssa_start_field_falls_back_to_from_date(self):
        with patch("zkteco_hr.attendance_engine.hr_calendar.frappe.db.has_column") as has_column:
            has_column.side_effect = lambda _dt, col: col == "from_date"
            self.assertEqual(_shift_schedule_assignment_start_field(), "from_date")


if __name__ == "__main__":
    unittest.main()
