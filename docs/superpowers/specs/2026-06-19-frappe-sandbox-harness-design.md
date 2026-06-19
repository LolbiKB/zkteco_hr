# Frappe Sandbox Harness — Phase 1 Design

- **Date:** 2026-06-19
- **Status:** Approved (design); ready for implementation plan
- **Owner:** LolbiKB
- **Scope:** Phase 1 of a multi-phase roadmap (foundation only)

## 1. Context & Goal

We want to maximize **dev automation** for Frappe custom-app work and make it
**autonomous-loop-friendly** (`/loop`). Concretely: give Claude (and humans/CI) a
fast, disposable, safe environment to run tests, iterate TDD unattended, and triage
the flag engine against **copied production data** — without ever touching the live
Frappe Cloud site (`dewey.frappehr.com`).

This starts on `zkteco_hr` but is **structured to generalize** to other Frappe custom
apps / Frappe Cloud projects.

### Why not just an MCP?

The original idea was "an MCP into Frappe Cloud." Investigation showed that for a
**local** sandbox driven in loops, **Bash-over-Docker beats an MCP**: faster, deterministic,
no network flakiness, no auth-token expiry mid-loop. An MCP earns its keep only for
typed access to a *remote* instance or for *other* agents/tools — deferred to Phase 5.

## 2. Roadmap & Phase 1 Boundary

| Phase | What | Status |
|---|---|---|
| **1 — Foundation** | Dockerized bench, dual seeding (clean + prod-restore), one-command **backend + frontend** test run, the 3 done-bars | **this spec** |
| 2 — Coverage ratchet | find untested engine paths, measure + grow coverage in a loop | later |
| 3 — Flag triage | structured engine-run + diff/baseline/anomaly surfacing on real data | later |
| 4 — Deploy rehearsal | build → migrate → asset-sync → verify dry-run; optional GH Actions reuse | later |
| 5 — Generalize + MCP | extract to its own repo for any Frappe app; optional remote read-only MCP; `--scrubbed`/raw seeding variants | later |

Phase 1's "real-data engine run" bar = *seed prod data + run the engine + see flags*.
The systematic diff/anomaly **triage** is Phase 3, built on top.

## 3. Confirmed Decisions

- **Sandbox host:** local Docker bench. (Docker + a capable machine are available; FC plan tier is unknown, so we avoid any SSH/private-bench dependency.)
- **Seeding source:** a backup **downloaded from the Frappe Cloud dashboard** (available on every tier) — no SSH required; real data never leaves the machine.
- **No MCP in Phase 1.** Bash-on-local-Docker; MCP revisited in Phase 5.
- **Deliverable:** a config-driven CLI/scripts engine (humans + CI + Claude all use it) plus a **thin Claude skill** with loop recipes. CLI first.
- **Harness location:** **in-repo first**, under `dev/sandbox/`, config-driven, with a clean extraction path to its own repo in Phase 5.
- **PII:** restore real data then **anonymize by default, non-skippable** (deterministic, id-preserving). Local-only regardless.
- **Phase 1 scope:** backend **and** frontend.
- **Substrate:** Approach C — official `frappe/bench` image as base, all value in our CLI.

## 4. Architecture — one substrate, two decoupled lanes

The backend and frontend test paths share almost nothing, so the harness is **two
independent lanes** under one CLI:

```
frappe-sandbox (CLI, reads dev/sandbox/frappe-sandbox.yml)
│
├─ BACKEND lane → Docker: frappe/bench + mariadb:10.6(utf8mb4) + redis-cache + redis-queue
│   ├─ test_site   (clean; bench run-tests --app zkteco_hr)   ← CI parity
│   └─ sandbox     (prod backup, restored + anonymized)        ← engine triage
│
└─ FRONTEND lane → node 20 + npm (NO bench, NO DB, NO live site)
    ├─ test:web   (tsx + node:test, the 6 src/lib/*.test.ts)
    └─ test:e2e   (Playwright/chromium vs vite dev-server :8080, backend fully stubbed)
```

**Key grounding — the frontend lane needs no backend.** Playwright's `e2e/fixtures.ts`
intercepts every `/api/method/**` call and seeds the auth cookie; `FRAPPE_PROXY` points
at a dead address (`127.0.0.1:9`) deliberately. So the frontend lane requires only
node + chromium + the npm token — it is fully decoupled from Docker.

## 5. Backend Lane

### 5.1 Stack (mirror `.github/workflows/tests.yml`)

- `mariadb:10.6` (root pw `root`), **server charset utf8mb4** (`SET GLOBAL character_set_server=utf8mb4`), TCP / `--no-mariadb-socket`.
- `redis:6.2-alpine` ×2 (cache + queue).
- `frappe/bench:latest` container, `command: sleep infinity`, **named volume** for `frappe-bench/` (apps + sites persist), repo **bind-mounted** at `/workspace/zkteco_hr-src`.

### 5.2 Required apps (install order = dependency order)

`frappe` → `erpnext` → `hrms` → `zkteco_hr`, all `version-15`.
- `erpnext` is required because **hrms depends on it**.
- `hrms` provides `Employee Checkin`, `Shift Assignment`, `Shift Type`, `Shift Schedule`, `Shift Schedule Assignment`, `Holiday List`, `Leave Application`, `Attendance` — all used by `attendance_engine/`. (Also one lazy import `from hrms.hr.doctype.shift_assignment.shift_assignment import get_shifts_for_date` in `attendance_engine/shift_assignment.py`, wrapped in try/except.)
- `zkteco_hr` owns only `Attendance Flag`, `Device Closeout Alert`, `Device Sync Status`.

### 5.3 One-time provisioning (cold path, runs once on the named volume)

```bash
export FRAPPE_BRANCH=version-15 ERPNEXT_BRANCH=version-15 HRMS_BRANCH=version-15
bench init --skip-redis-config-generation --skip-assets \
  --frappe-branch "$FRAPPE_BRANCH" --python "$(which python)" frappe-bench
cd frappe-bench
bench set-config -g db_host mariadb
bench set-config -g redis_cache    "redis://redis-cache:6379"
bench set-config -g redis_queue    "redis://redis-queue:6379"
bench set-config -g redis_socketio "redis://redis-queue:6379"
bench get-app erpnext --branch "$ERPNEXT_BRANCH" --skip-assets
bench get-app hrms    --branch "$HRMS_BRANCH"    --skip-assets
bench get-app zkteco_hr /workspace/zkteco_hr-src --skip-assets   # bind-mounted source

# apps.txt trailing-newline guard (nested zkteco_hr/zkteco_hr/ layout can skip auto-registration
# AND concatenate into 'hrmszkteco_hr' without a trailing newline):
[ -s sites/apps.txt ] && [ -n "$(tail -c1 sites/apps.txt)" ] && echo >> sites/apps.txt
grep -qxF zkteco_hr sites/apps.txt 2>/dev/null || echo zkteco_hr >> sites/apps.txt

bench new-site test_site --no-mariadb-socket --db-host mariadb \
  --mariadb-root-password root --admin-password admin
bench --site test_site install-app erpnext hrms zkteco_hr
bench --site test_site set-config allow_tests true   # MANDATORY — run-tests refuses without it
```

`--skip-assets` everywhere: the app ships pre-built committed frontend assets and the
backend test run needs no JS build.

### 5.4 Two test speeds (grounding: all 14 test files are pure unit tests)

Every backend test installs a MagicMock `frappe` (`_install_frappe_mock` in
`tests/test_closeout.py`) and never reads the DB; no `FrappeTestCase`, no `test_records`,
no seeded master data. Therefore:

- **Fast lane** — `python -m unittest` in a venv (app on `PYTHONPATH`). Sub-second, **no Docker**. This is the inner `/loop` TDD cycle. (148 test methods across 14 files; 3 files need no frappe at all.)
- **Parity lane** — dockerized `bench --site test_site run-tests --app zkteco_hr`. The gate that matches what protects `main`. Accepts `--module zkteco_hr.tests.test_closeout` / `--test <name>` to scope.

`run-tests` is canonical (CI uses it; CLAUDE.md's old `pytest` reference was wrong and
has already been corrected). The fast lane is an optimization, not the gate.

### 5.5 Two sites, never crossed

- `test_site` — clean, app-only, deterministic; rebuilt freely; target of `run-tests`.
- `sandbox` — prod backup, restored + anonymized; engine triage and manual poking; **never** `run-tests` (it can leave test fixtures and is slow/destructive-ish on real data).

## 6. Frontend Lane (reuse existing prior art)

The worktree `ci+frontend-e2e-and-unit` (branch tip `ac92da92`) already built this; Phase 1
**merges it to main** and wires it into the CLI:

- **Unit:** `test:web` = `tsx --test src/lib/*.test.ts` (`node:test` + `node:assert/strict`); devDep `tsx`. (The 6 `src/lib/*.test.ts` already exist on main but the script/dep wiring lives only in the worktree.) **No vitest** — do not introduce it.
- **E2E:** `test:e2e` = `playwright test`; `@playwright/test`. `playwright.config.ts` owns the server (`webServer.command: npm run dev`, vite on **:8080**), `desktop` (Chrome) + `mobile` (Pixel 7) projects (both chromium). Specs in `e2e/`; `e2e/fixtures.ts` stubs all network.
- **Build prereq:** `npm install` requires `NODE_AUTH_TOKEN` (GitHub PAT, `read:packages`) for the private `@lolbikb/dewey-ui` (`.npmrc` → `npm.pkg.github.com`). Use `npm install` (not `npm ci`) per the worktree note.
- **Base image:** `mcr.microsoft.com/playwright` (browser libs preinstalled); install **chromium only** (`playwright install --with-deps chromium`).
- **Node:** standardize on **node 20** (backend CI uses 18, this machine is 24 — pick one for the sandbox).

## 7. Seeding & Anonymization

### 7.1 Frappe Cloud backup shape

`<ts>-<site>-database.sql.gz`, `<ts>-<site>-files.tar` (public),
`<ts>-<site>-private-files.tar` (private, may be absent). **Do not** restore the prod
`site_config.json` (carries the prod `encryption_key`/secrets) — let `new-site` generate a fresh one.

### 7.2 Restore (`seed --prod <backup-dir>`)

```bash
bench new-site sandbox --no-mariadb-socket --db-host mariadb \
  --mariadb-root-password root --admin-password admin \
  --install-app erpnext --install-app hrms
bench --site sandbox --force restore <db>.sql.gz \
  --with-public-files <files>.tar \
  --with-private-files <private-files>.tar \   # omit if absent
  --mariadb-root-password root
bench --site sandbox install-app zkteco_hr   # if not already in the restored DB
bench --site sandbox migrate
# then the non-skippable anonymize pass (see 7.3)
```

### 7.3 Anonymization (`zkteco_hr/zkteco_hr/utils/anonymize.py`, ON by default)

A **post-restore**, **non-skippable** pass run as the tail of `seed --prod` (e.g.
`bench --site sandbox execute zkteco_hr.utils.anonymize.run`). Properties:

- **Deterministic + id-preserving:** `Employee.employee_name → "Employee {id}"`; mask `first/last_name`, `personal_email`, `company_email`, `cell_number`, `bank_ac_no`, `passport_number`, `date_of_birth`. Scrub denormalized `Employee Checkin.employee_name`, `device_id`, `custom_device_serial_number`, `latitude`, `longitude`, `geolocation`. Also scrub `User` (email/full_name), `Contact`, `Address`.
- **Engine-relevant fields untouched:** `time`, `log_type`, `shift`, `custom_supabase_log_id`, and the `employee` **link** are preserved — so engine behavior is identical and triage still correlates a bug to a real person **by id**.
- **Hard guard:** refuses to run unless the site is clearly non-prod (config flag / site-name check), wrapped in a `frappe.db` transaction + `commit()`.
- Phase 5 may add a `--raw` opt-out and a more complete PII enumeration pass.

## 8. CLI Surface, Config, Generalization

A config-driven CLI living at `dev/sandbox/` reading `dev/sandbox/frappe-sandbox.yml`:

```yaml
app: zkteco_hr
app_src: .                       # host path bind-mounted into the bench
required_apps: [erpnext, hrms]   # install order = dependency order
branch: version-15
frontend_dir: zkteco_hr/zkteco_hr/frontend/hr_attendance
register_app_in_apps_txt: true   # nested-layout newline fix
```

Generalizing to another Frappe app = a new config file; the engine is identical.

| Verb | Does |
|---|---|
| `up` / `down` | start/stop the stack; `down --purge` drops volumes (cold next start) |
| `install-app` | get-app erpnext/hrms + get-app from the mount + apps.txt fix + install onto a site |
| `seed --clean` \| `--prod <dir>` | build `test_site`; or restore+anonymize `sandbox` |
| `test --backend [--fast] [--module X]` \| `--frontend [--unit\|--e2e]` | run either lane |
| `engine-run --employee … --from … --to …` | run the engine on `sandbox`, dump resulting Attendance Flags |
| `shell [--console]` | exec into the bench container / `bench --site <s> console` |
| `migrate` | re-run patches + DocType sync after schema edits |
| `doctor` | preflight: Docker up? token set? backup files present? volume initialized? |

A thin Claude **skill** wraps these with loop recipes (inner fast-lane TDD, parity gate,
triage). CLI first; skill is a documentation/automation layer over it.

## 9. The Loop (warm iteration / `/loop`)

- Container stays warm (`sleep infinity`, named volume persists bench + both sites).
- App is **bind-mounted editable** → a host edit is live on the next run, no reinstall.
- Inner loop: fast-lane `python -m unittest` (sub-second). Before "done": run the parity
  lane once. Each step is a single non-interactive `docker compose exec` → headless,
  `/loop`-safe. The slow cold path (init + get-app erpnext/hrms + new-site) runs **once**.
- After `hooks.py`/scheduler or DocType/patch changes: `migrate` (and restart workers if wiring changed).

## 10. Error Handling & Reproducibility

- `doctor` preflight before any lane.
- Missing `NODE_AUTH_TOKEN` → frontend lane **skips with a clear warning** (non-fatal, matching the worktree), never a hard red.
- Missing `--with-private-files` tolerated (sites with no private files).
- `allow_tests true` always set before `run-tests`; the `apps.txt` newline guard always applied.
- **Reproducibility:** `version-15` branches track tips → upstream can drift. Phase 1 pins the branch (like CI); SHA-pinning or a prebuilt base image is a noted hardening knob (Phase 5).
- **Cold-start cost:** installing erpnext+hrms is the slow path (minutes); mitigated by persisting on the named volume so it happens once. A prebuilt image baking frappe+erpnext+hrms+site is a future speedup.

## 11. Acceptance Criteria (the 3 done-bars)

1. **One-command green suite:** `frappe-sandbox up && seed --clean && test --backend` → full backend suite green, repeatable.
2. **Unattended TDD loop:** a scripted red→green demo runs fully unattended (fast lane each iteration), proving the `/loop` substrate.
3. **Real-data engine run:** `seed --prod <backup> && engine-run --employee …` → prints real (anonymized) Attendance Flags, proving triage.

Plus: `up`/`down`/`up` is idempotent; frontend lane (`test --frontend`) runs unit + e2e when the token is present, skips cleanly when not.

## 12. Explicitly Out of Scope (Phase 1)

Coverage ratchet, structured diff/anomaly triage, deploy/release rehearsal, cross-project
repo extraction, the optional remote read-only MCP, and `--raw`/`--scrubbed` seeding
variants. (Deploy rehearsal is out despite being named earlier — it is not among the 3 done-bars.)

## 13. Open Questions / Risks (carry into implementation)

1. Does `bench get-app /workspace/zkteco_hr-src` on `frappe/bench` symlink (edits live) or copy? If it copies, bind-mount directly onto `frappe-bench/apps/zkteco_hr` instead. **Verify in the real image.**
2. Confirm pip-editable install resolves the **nested** package (`zkteco_hr/zkteco_hr/`, `pyproject` package layout) correctly inside the container, not just in GH Actions.
3. Confirm the exact FC backup variant (separate `site_config.json`? private-files always present?) so `restore` flags are tolerant.
4. Anonymization completeness: enumerate every DocType with real PII actually present in the restored DB (Contact, Address, any custom doctypes), not just a fixed list.
5. Confirm `frappe/bench` plays cleanly pointed at sibling compose services (`db_host=mariadb`, redis hostnames) vs the image's built-in supervisor/services.
6. Decide whether the frontend warm loop runs on the host or inside a node container (no root `package.json`; node only guaranteed inside images).

## 14. Deliverable Summary

- `dev/sandbox/` — `docker-compose.yml`, the `frappe-sandbox` CLI, `frappe-sandbox.yml`, helper scripts.
- `zkteco_hr/zkteco_hr/utils/anonymize.py` — the anonymization pass.
- Frontend: merge the `ci+frontend-e2e-and-unit` prior art to main (`test:web`/`test:e2e` scripts, `tsx`/`@playwright/test` devDeps, `playwright.config.ts`, `e2e/`).
- A thin Claude skill documenting the loop recipes.
