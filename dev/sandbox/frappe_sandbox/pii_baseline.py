"""Generic baseline PII scrub — common Frappe/ERPNext personal data that ANY
app's prod backup carries, independent of the app under test. Runs as a harness
layer (scripts/scrub_common_pii.py, raw pymysql, no frappe.init) IN ADDITION to
each app's own anonymize.py, so every project gets comprehensive anonymization
without hand-listing the framework's PII tables.

Design rules:
  * id-preserving — never touch `name`/primary keys (other rows reference them).
  * column-tolerant — only existing columns are written (apply-time filtering),
    so a doctype/column the schema lacks is silently skipped.
  * email columns get a deterministic per-row mask (keeps uniqueness, avoids
    unique-index collisions); contact/free-text/IP columns are blanked.

These are pure helpers; the DB I/O that uses them is in scripts/scrub_common_pii.py.
"""
from __future__ import annotations

# Deterministic, per-row-unique masks (PK `name` exists on every Frappe table).
# Identifier-like columns (email/phone) often carry a UNIQUE index, so they must
# get a per-row value — blanking every row to a constant collides (error 1062).
# Free-text columns are simply blanked.
_EMAIL = "CONCAT(LEFT(MD5(`name`), 12), '@example.invalid')"
_PHONE = "CONCAT('+', LEFT(MD5(`name`), 14))"  # per-row-unique + non-empty (NOT NULL safe)
_BLANK = "''"

# (doctype, {column: sql_value_expr}, where_clause)
COMMON_PII_SPECS = [
    ("User", {"email": _EMAIL, "phone": _PHONE, "mobile_no": _PHONE,
              "location": _BLANK, "bio": _BLANK, "banner_image": _BLANK},
     "WHERE `name` NOT IN ('Administrator', 'Guest')"),
    ("Contact", {"email_id": _EMAIL, "phone": _PHONE, "mobile_no": _PHONE}, ""),
    ("Contact Email", {"email_id": _EMAIL}, ""),
    ("Contact Phone", {"phone": _PHONE}, ""),
    ("Address", {"address_line1": _BLANK, "address_line2": _BLANK, "city": _BLANK,
                 "pincode": _BLANK, "phone": _PHONE, "fax": _PHONE, "email_id": _EMAIL}, ""),
    ("Communication", {"sender": _EMAIL, "sender_full_name": _BLANK, "recipients": _BLANK,
                       "cc": _BLANK, "bcc": _BLANK, "phone_no": _PHONE,
                       "subject": _BLANK, "content": _BLANK, "text_content": _BLANK}, ""),
    ("Email Queue", {"sender": _EMAIL, "message": _BLANK}, ""),
    ("Email Queue Recipient", {"recipient": _EMAIL}, ""),
    ("Notification Log", {"subject": _BLANK, "email_content": _BLANK}, ""),
    ("Access Log", {"ip_address": _BLANK}, ""),
    ("Activity Log", {"ip_address": _BLANK}, ""),
    ("ToDo", {"description": _BLANK}, ""),
    ("Comment", {"content": _BLANK}, ""),
]


def build_update(table: str, col_exprs: dict, existing_cols, where: str = "") -> str | None:
    """An `UPDATE tab<table>` for the columns that actually exist; None if none overlap."""
    existing = set(existing_cols)
    cols = {c: e for c, e in col_exprs.items() if c in existing}
    if not cols:
        return None
    set_clause = ", ".join(f"`{c}` = {e}" for c, e in cols.items())
    stmt = f"UPDATE `tab{table}` SET {set_clause}"
    if where:
        stmt += f" {where}"
    return stmt


def applicable_updates(specs, existing_by_table) -> list[str]:
    """Build UPDATEs for every spec whose table exists, filtered to existing columns.

    `existing_by_table` maps doctype -> iterable of its column names. A doctype
    absent from the map is skipped (table not present in this backup).
    """
    out: list[str] = []
    for table, col_exprs, where in specs:
        cols = existing_by_table.get(table)
        if cols is None:
            continue
        stmt = build_update(table, col_exprs, cols, where)
        if stmt:
            out.append(stmt)
    return out
