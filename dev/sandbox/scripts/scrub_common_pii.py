#!/usr/bin/env python3
"""Generic baseline PII scrub for a restored sandbox DB. Complements each app's
own anonymize.py with a common Frappe/ERPNext PII sweep (contact info, message
bodies, IP addresses) so every project is anonymized comprehensively.

Runs INSIDE the sandbox container via the bench env python (pymysql available),
connecting to MariaDB directly — NO frappe.init, so it survives version skew and
half-migrated schemas. id-preserving and column-tolerant (see pii_baseline.py).

Usage (cwd = the bench dir, e.g. /home/frappe/frappe-bench):
    env/bin/python /workspace/repo/dev/sandbox/scripts/scrub_common_pii.py <site>

Env: DB_HOST (default mariadb), DB_ROOT_USER (default root), DB_ROOT_PASSWORD (default root)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, "/workspace/repo/dev/sandbox")
from frappe_sandbox.pii_baseline import COMMON_PII_SPECS, build_update  # noqa: E402

import pymysql  # noqa: E402


def main() -> int:
    if len(sys.argv) != 2:
        sys.exit("usage: scrub_common_pii.py <site>")
    site = sys.argv[1]
    db_name = json.loads(Path("sites", site, "site_config.json").read_text())["db_name"]

    conn = pymysql.connect(
        host=os.environ.get("DB_HOST", "mariadb"),
        user=os.environ.get("DB_ROOT_USER", "root"),
        password=os.environ.get("DB_ROOT_PASSWORD", "root"),
        database=db_name,
        autocommit=False,
    )
    scrubbed: list[tuple[str, int]] = []
    try:
        with conn.cursor() as cur:
            for table, col_exprs, where in COMMON_PII_SPECS:
                cur.execute(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema=%s AND table_name=%s",
                    (db_name, f"tab{table}"),
                )
                existing = [r[0] for r in cur.fetchall()]
                if not existing:
                    continue  # doctype/table not in this backup
                stmt = build_update(table, col_exprs, existing, where)
                if not stmt:
                    continue
                cur.execute(stmt)
                scrubbed.append((table, cur.rowcount))
        conn.commit()
    finally:
        conn.close()

    if scrubbed:
        print("scrub_common_pii: " + ", ".join(f"{t}({n})" for t, n in scrubbed))
    else:
        print("scrub_common_pii: no common PII tables present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
