import json
import unittest
from datetime import date
from unittest.mock import MagicMock, patch

from zkteco_hr.tests.test_closeout import _install_frappe_mock

_install_frappe_mock()


class TestGroupWeekPattern(unittest.TestCase):
    def test_groups_mon_fri_and_saturday(self):
        from zkteco_hr.attendance_engine.schedule_resolver import group_week_pattern

        days = [
            {
                "weekday": "Monday",
                "works": True,
                "start_time": "08:00:00",
                "end_time": "17:00:00",
                "lunch_start": "12:00:00",
                "lunch_end": "13:00:00",
                "grace_minutes": 10,
            },
            {
                "weekday": "Tuesday",
                "works": True,
                "start_time": "08:00:00",
                "end_time": "17:00:00",
                "lunch_start": "12:00:00",
                "lunch_end": "13:00:00",
                "grace_minutes": 10,
            },
            {
                "weekday": "Wednesday",
                "works": True,
                "start_time": "08:00:00",
                "end_time": "17:00:00",
                "lunch_start": "12:00:00",
                "lunch_end": "13:00:00",
                "grace_minutes": 10,
            },
            {
                "weekday": "Thursday",
                "works": True,
                "start_time": "08:00:00",
                "end_time": "17:00:00",
                "lunch_start": "12:00:00",
                "lunch_end": "13:00:00",
                "grace_minutes": 10,
            },
            {
                "weekday": "Friday",
                "works": True,
                "start_time": "08:00:00",
                "end_time": "17:00:00",
                "lunch_start": "12:00:00",
                "lunch_end": "13:00:00",
                "grace_minutes": 10,
            },
            {
                "weekday": "Saturday",
                "works": True,
                "start_time": "08:00:00",
                "end_time": "12:00:00",
                "grace_minutes": 10,
            },
            {"weekday": "Sunday", "works": False},
        ]

        groups = group_week_pattern(days)
        self.assertEqual(len(groups), 2)
        self.assertEqual(len(groups[0]["days"]), 5)
        self.assertEqual(groups[1]["days"], ["Saturday"])

    def test_skips_invalid_end_before_start(self):
        from zkteco_hr.attendance_engine.schedule_resolver import group_week_pattern

        groups = group_week_pattern(
            [
                {
                    "weekday": "Monday",
                    "works": True,
                    "start_time": "17:00:00",
                    "end_time": "08:00:00",
                }
            ]
        )
        self.assertEqual(groups, [])


class TestNaming(unittest.TestCase):
    def test_proposed_shift_type_name(self):
        from zkteco_hr.attendance_engine.schedule_resolver import proposed_shift_type_name

        self.assertEqual(
            proposed_shift_type_name({"start_time": "08:00:00", "end_time": "17:00:00"}),
            "FT_0800_1700",
        )

    def test_proposed_pat_name_mon_fri(self):
        from zkteco_hr.attendance_engine.schedule_resolver import proposed_pat_name

        profile = {
            "start_time": "08:00:00",
            "end_time": "17:00:00",
            "lunch_start": "12:00:00",
            "lunch_end": "13:00:00",
        }
        name = proposed_pat_name(
            ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "FT_0800_1700",
            profile,
        )
        self.assertEqual(name, "PAT_MON-FRI_FT_0800_1700_L1200_1300")


class TestMatchShiftType(unittest.TestCase):
    @patch("zkteco_hr.attendance_engine.schedule_resolver.frappe.get_all")
    @patch("zkteco_hr.attendance_engine.schedule_resolver.frappe.db.table_exists")
    @patch("zkteco_hr.attendance_engine.schedule_resolver.frappe.db.has_column")
    def test_exact_match_returns_use(self, has_column, table_exists, get_all):
        from zkteco_hr.attendance_engine.schedule_resolver import match_shift_type

        table_exists.return_value = True
        has_column.return_value = True
        get_all.return_value = [
            {
                "name": "FT_0800_1700",
                "start_time": "08:00:00",
                "end_time": "17:00:00",
                "custom_lunch_start": "12:00:00",
                "custom_lunch_end": "13:00:00",
                "custom_grace_minutes": 10,
            }
        ]

        result = match_shift_type(
            {
                "start_time": "08:00:00",
                "end_time": "17:00:00",
                "lunch_start": "12:00:00",
                "lunch_end": "13:00:00",
                "grace_minutes": 10,
            }
        )
        self.assertEqual(result["action"], "use")
        self.assertEqual(result["name"], "FT_0800_1700")

    @patch("zkteco_hr.attendance_engine.schedule_resolver.frappe.get_all")
    @patch("zkteco_hr.attendance_engine.schedule_resolver.frappe.db.table_exists")
    @patch("zkteco_hr.attendance_engine.schedule_resolver.frappe.db.has_column")
    def test_no_match_returns_create(self, has_column, table_exists, get_all):
        from zkteco_hr.attendance_engine.schedule_resolver import match_shift_type

        table_exists.return_value = True
        has_column.return_value = True
        get_all.return_value = []

        result = match_shift_type(
            {
                "start_time": "08:00:00",
                "end_time": "12:00:00",
                "lunch_start": None,
                "lunch_end": None,
                "grace_minutes": 10,
            }
        )
        self.assertEqual(result["action"], "create")
        self.assertEqual(result["proposed_name"], "FT_0800_1200")


class TestReconcilePreview(unittest.TestCase):
    @patch("zkteco_hr.attendance_engine.schedule_resolver._future_assignments_for_shift_type")
    @patch("zkteco_hr.attendance_engine.schedule_resolver.list_employee_ssas")
    def test_orphan_ssa_marked_for_disable(self, list_ssas, future_assignments):
        from zkteco_hr.attendance_engine.schedule_resolver import build_reconcile_preview

        list_ssas.return_value = [
            {
                "name": "SSA-OLD",
                "shift_schedule": "PAT_OLD",
                "enabled": 1,
                "shift_status": "Active",
                "shift_type": "FT_OLD",
            },
            {
                "name": "SSA-KEEP",
                "shift_schedule": "PAT_NEW",
                "enabled": 1,
                "shift_status": "Active",
                "shift_type": "FT_NEW",
            },
        ]
        future_assignments.return_value = [
            {
                "name": "SA-1",
                "shift_type": "FT_OLD",
                "start_date": "2026-06-01",
                "end_date": "2026-06-30",
                "action": "end_before",
                "proposed_end_date": "2026-05-31",
            }
        ]

        plan = {
            "groups": [
                {
                    "shift_schedule": {"action": "use", "name": "PAT_NEW"},
                }
            ]
        }

        preview = build_reconcile_preview(
            employee="EMP-1",
            plan=plan,
            effective_from=date(2026, 6, 1),
        )

        self.assertEqual(len(preview["disable_ssas"]), 1)
        self.assertEqual(preview["disable_ssas"][0]["name"], "SSA-OLD")
        self.assertEqual(len(preview["affected_assignments"]), 1)


class TestScheduleApi(unittest.TestCase):
    @patch("zkteco_hr.attendance_engine.schedule_api.getdate")
    @patch("zkteco_hr.attendance_engine.schedule_api.build_resolve_plan")
    @patch("zkteco_hr.attendance_engine.schedule_api._employee_header")
    @patch("zkteco_hr.attendance_engine.schedule_api._require_hr_role")
    def test_apply_returns_needs_confirm_without_flag(
        self, _role, _header, build_plan, getdate
    ):
        from zkteco_hr.attendance_engine import schedule_api

        build_plan.return_value = {"needs_create": True, "groups": []}
        getdate.side_effect = lambda value: date.fromisoformat(str(value))

        result = schedule_api.apply_weekly_schedule(
            employee="EMP-1",
            week_pattern=json.dumps({"frequency": "Every Week", "days": []}),
            create_shifts_after="2026-06-02",
            generate_through="2026-09-01",
            confirm_create=False,
        )

        self.assertTrue(result["needs_confirm"])
        self.assertIn("plan", result)


if __name__ == "__main__":
    unittest.main()
