from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

from . import commands as c
from .config import ConfigError, load_config
from .runner import run_all

DEFAULT_CONFIG = str(Path(__file__).resolve().parents[1] / "frappe-sandbox.json")


def _build(args, cfg) -> list[list[str]]:
    if args.cmd == "up":
        return c.build_up(cfg)
    if args.cmd == "down":
        return c.build_down(cfg, purge=args.purge)
    if args.cmd == "install-app":
        return c.build_provision(cfg)
    if args.cmd == "seed":
        if args.clean:
            return c.build_provision(cfg)
        return c.build_seed_prod(cfg, args.prod)
    if args.cmd == "test":
        if args.frontend:
            mode = "e2e" if args.e2e else "unit" if args.unit else "all"
            return c.build_frontend(cfg, mode=mode)
        return c.build_run_tests(cfg, module=args.module, fast=args.fast)
    if args.cmd == "exercise":
        kwargs = {}
        for a in cfg.exercise_args:
            val = getattr(args, a.flag.replace("-", "_"), None)
            if val is not None:
                kwargs[a.kwarg] = val
        return c.build_exercise(cfg, kwargs)
    if args.cmd == "verify":
        return c.build_verify(cfg)
    raise SystemExit(f"unknown command: {args.cmd}")


def _doctor(args) -> int:
    cfg = load_config(args.config)
    checks = []
    checks.append(("docker present", shutil.which("docker") is not None))
    checks.append(("compose file exists", Path(cfg.compose_file).is_file()))
    checks.append(("python >= 3.9", sys.version_info >= (3, 9)))
    checks.append(("NODE_AUTH_TOKEN set (frontend)", bool(os.environ.get("NODE_AUTH_TOKEN"))))
    ok = True
    for name, passed in checks:
        mark = "PASS" if passed else ("WARN" if "NODE_AUTH" in name else "FAIL")
        if mark == "FAIL":
            ok = False
        print(f"[{mark}] {name}")
    return 0 if ok else 1


def main(argv=None) -> int:
    pre = argparse.ArgumentParser(add_help=False)
    pre.add_argument("--config", default=DEFAULT_CONFIG)
    pre.add_argument("--dry-run", action="store_true")
    known, _ = pre.parse_known_args(argv)

    try:
        cfg = load_config(known.config)
    except ConfigError as ex:
        print(f"config error: {ex}", file=sys.stderr)
        return 2

    p = argparse.ArgumentParser(prog="frappe-sandbox", parents=[pre])
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("up")
    d = sub.add_parser("down"); d.add_argument("--purge", action="store_true")
    sub.add_parser("install-app")
    s = sub.add_parser("seed")
    s.add_argument("--clean", action="store_true")
    s.add_argument("--prod", metavar="BACKUP_DIR")
    t = sub.add_parser("test")
    t.add_argument("--backend", action="store_true")
    t.add_argument("--frontend", action="store_true")
    t.add_argument("--fast", action="store_true")
    t.add_argument("--unit", action="store_true")
    t.add_argument("--e2e", action="store_true")
    t.add_argument("--module")
    ex = sub.add_parser("exercise")
    for a in cfg.exercise_args:
        kw = {"required": a.required}
        if a.default is not None:
            kw["default"] = a.default
        if a.choices:
            kw["choices"] = list(a.choices)
        ex.add_argument(f"--{a.flag}", **kw)
    sub.add_parser("verify")
    sub.add_parser("doctor")

    args = p.parse_args(argv)
    if args.cmd == "seed" and not args.clean and not args.prod:
        print("seed requires --clean or --prod <BACKUP_DIR>", file=sys.stderr)
        return 2
    if args.cmd == "test" and not args.backend and not args.frontend:
        print("test requires --backend or --frontend", file=sys.stderr)
        return 2
    cwd = str(Path(args.config).resolve().parent)
    try:
        if args.cmd == "doctor":
            return _doctor(args)
        return run_all(_build(args, cfg), cwd=cwd, dry_run=args.dry_run)
    except ConfigError as ex:
        print(f"config error: {ex}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
