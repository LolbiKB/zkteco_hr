from __future__ import annotations

import unittest

from frappe_sandbox.pii_baseline import (
    COMMON_PII_SPECS,
    applicable_updates,
    build_update,
)


class TestBuildUpdate(unittest.TestCase):
    def test_filters_to_existing_columns(self):
        stmt = build_update("Contact", {"email_id": "''", "phone": "''", "mobile_no": "''"},
                            existing_cols=["name", "email_id", "phone"])
        self.assertIn("`email_id` = ''", stmt)
        self.assertIn("`phone` = ''", stmt)
        self.assertNotIn("mobile_no", stmt)  # not in existing_cols
        self.assertTrue(stmt.startswith("UPDATE `tabContact` SET "))

    def test_none_when_no_columns_overlap(self):
        self.assertIsNone(build_update("X", {"a": "''"}, existing_cols=["name", "b"]))

    def test_where_clause_appended(self):
        stmt = build_update("User", {"email": "''"}, existing_cols=["email"],
                            where="WHERE `name` NOT IN ('Administrator', 'Guest')")
        self.assertTrue(stmt.endswith("WHERE `name` NOT IN ('Administrator', 'Guest')"))


class TestApplicableUpdates(unittest.TestCase):
    def test_skips_absent_tables(self):
        specs = [
            ("User", {"email": "''"}, ""),
            ("Communication", {"content": "''"}, ""),
        ]
        existing = {"User": ["name", "email"]}  # Communication table absent
        stmts = applicable_updates(specs, existing)
        self.assertEqual(len(stmts), 1)
        self.assertIn("`tabUser`", stmts[0])

    def test_empty_when_nothing_present(self):
        self.assertEqual(applicable_updates([("User", {"email": "''"}, "")], {}), [])


class TestSpecsAreSafe(unittest.TestCase):
    def test_specs_are_well_formed(self):
        for entry in COMMON_PII_SPECS:
            self.assertEqual(len(entry), 3, f"spec must be (table, cols, where): {entry}")
            table, cols, where = entry
            self.assertIsInstance(table, str)
            self.assertIsInstance(cols, dict)
            self.assertIsInstance(where, str)

    def test_never_targets_primary_key(self):
        # id-preserving: `name` is the PK other rows reference — must never be scrubbed.
        for table, cols, _ in COMMON_PII_SPECS:
            self.assertNotIn("name", cols, f"{table} spec must not scrub the `name` PK")

    def test_unique_prone_columns_get_per_row_values(self):
        # email/phone/mobile/fax commonly carry a UNIQUE index — blanking every row
        # to a constant collides (MariaDB error 1062). They must be per-row (MD5(`name`)).
        unique_prone = {"email", "email_id", "phone", "mobile_no", "fax"}
        for table, cols, _ in COMMON_PII_SPECS:
            for col, expr in cols.items():
                if col in unique_prone:
                    self.assertIn("MD5(`name`)", expr,
                                  f"{table}.{col} must use a per-row mask, not a constant ({expr!r})")

    def test_user_spec_protects_system_accounts(self):
        user_specs = [(cols, where) for table, cols, where in COMMON_PII_SPECS if table == "User"]
        self.assertEqual(len(user_specs), 1)
        _cols, where = user_specs[0]
        self.assertIn("Administrator", where)
        self.assertIn("Guest", where)


if __name__ == "__main__":
    unittest.main()
