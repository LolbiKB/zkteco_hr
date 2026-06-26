# dewey_portal Extraction — Design (Phase 2)

**Status:** approved design (brainstormed + locked via `/goal`). Phase 2 of the launcher work.

## Goal

Physically extract the company portal — `/login`, `/home`, the `Launcher Tile` registry, and the resolver — out of `dewey_time` into a new neutral Frappe app, **`dewey_portal`**, so `dewey_time` becomes purely the HR-attendance product. The Phase-1 registration contract already decoupled everything conceptually (no `dewey_time` product code imports the portal); Phase 2 is the relocation plus untying the last three product seams.

## Scope boundary: "MVP"

This environment has **no bench**, so install/migrate/Frappe-Cloud steps cannot run or be verified here. **MVP = everything code-side complete and unit-tested:**
- `dewey_portal` scaffolded as a valid Frappe app (its own sibling git repo at `/Users/lolbikb/projects/dewey-portal`) with all moved code, its SPA building, and its mock-based unit tests green.
- `dewey_time` slimmed (moved code/hooks removed, access-roles hook added) with its tests green.
- A written **cutover runbook** for the user's bench/Cloud ops.

The live cutover (install, migrate, deploy) is explicitly **out of MVP** — it is the user's bench step, documented in the runbook.

## Target shape & dependency direction

```
dewey_portal (NEW repo)                     dewey_time (slimmed)
• /login reskin (login_brand.css,           • flag engine, attendance SPAs, doctypes
  web_include_css hook, theme-reset patch)  • ADMS bundle + dashboard_auth (backend stays)
• /home SPA + own brand tokens              • launcher_gates.py (can_see_attendance/_adms)
• Launcher Tile + Launcher Tile Role         • dewey_launcher_tiles hook (registers its tiles)
  (module "Dewey Portal")                   • NEW dewey_portal_access_roles hook
• resolver, launcher_sync, landing,         • all HR/ADMS product code
  tile role-picker, sync_home_assets
depends on: frappe only                     depends on: frappe only
        ▲ dewey_time publishes both hooks; dewey_portal aggregates them
```

Portal depends on nothing; products depend on nothing. No app imports a sibling app's Python.

## Untying the three backend seams

The portal must import **zero** `dewey_time` product code. Today three modules reach in:

1. **Avatar** — `launcher.py::_user_image` imports `hr_calendar._employee_linked_to_user` for employee-photo precedence. **Resolution:** the portal's `_user_image` uses **`User.user_image` only**. The employee-photo precedence is dropped. (`dewey_time` may re-contribute it later via a hook — out of scope.)
2. **Access overview** — `access.py::get_access_overview` imports `HR_STAFF_ROLES` + `ADMS_ROLES` to label "who is HR / ADMS". **Resolution:** `dewey_time` publishes a **`dewey_portal_access_roles`** hook — a list of `{label, roles}` groups — and the portal's overview aggregates the hook across installed apps instead of importing constants. Same publish→aggregate pattern as tiles.
3. **Role-picker** (`get/set_tile_roles`) and **`landing.py`** — already portal-pure (operate on `Launcher Tile` / `Role.home_page`); they move unchanged.

After this, `dewey_portal` imports only `frappe`.

## Frontend brand tokens

`frontend/home/src/index.css` relative-imports `../../hr_attendance/src/brand/tokens.css` (+ `base.css`) — a cross-app path that breaks once `home` lives in a different repo. **Resolution:** `dewey_portal` **vendors its own copy** of `brand/tokens.css` + `base.css` under `frontend/home/src/brand/`, and `index.css` imports them locally. The company brand is the portal's to own. `@lolbikb/dewey-ui` (a published package dep) is unchanged and carries over. *(Hoisting the shared tokens into the `dewey-ui` package is a clean future follow-up — out of scope.)*

## Asset namespace

Rewrite `/assets/dewey_time/...` → `/assets/dewey_portal/...` in: `login_brand.css`, `Launcher.tsx` (`DI_LOGO`), `index.css`, `AdminTiles.tsx`, `www/home.html`, and the Vite `--base` (`/assets/dewey_portal/home/`). `dewey_portal/public/` vendors the chrome assets the portal renders: `images/DI-logo.svg`, the login logo, and the Geist `woff2` fonts. The `web_include_css` URL becomes `/assets/dewey_portal/css/login_brand.css?v=1`.

**Tile-icon images stay in `dewey_time`** — the `dewey_launcher_tiles` hook lives in `dewey_time`, so its `icon` values keep pointing at `/assets/dewey_time/images/...` (a tile icon may reference any installed app's asset). No tile-icon images move.

## DocType move + data safety

`dewey_portal` ships `Launcher Tile` + `Launcher Tile Role` JSON under a new module **"Dewey Portal"** (with a fresh `modified` timestamp so migrate reimports). `dewey_time` deletes its copies (and the module/doctype dirs). Because a DocType's **records live in the DB table**, not in the owning app, the existing `tabLauncher Tile` rows persist across the move — admin overrides (`enabled`/`tile_order`) and hand-made tiles survive, and the reconcile (now in the portal) keeps managing them. There is **no uninstall and no table drop** — only a definition re-home (the portal's DocType import updates the `module` field on the existing doc). A small guard in the portal's reconcile path logs the pre/post row count so the cutover can confirm nothing was lost.

## Slim dewey_time

Remove from `dewey_time`: the home SPA (`frontend/home`, `public/home`, `www/home.*`), the login reskin (`public/css/login_brand.css`, `reset_broken_website_theme` patch + its `patches.txt` line), `attendance_engine/{launcher,launcher_sync,landing,access}.py`, `utils/sync_home_assets.py`, the `Launcher Tile`/`Launcher Tile Role` doctype dirs, and the hooks entries (`web_include_css`, the two `/home` `website_route_rules`, `sync_home_assets` + `launcher_sync` from `after_migrate`). **Keep:** `launcher_gates.py`, the `dewey_launcher_tiles` hook, the new `dewey_portal_access_roles` hook, all HR/ADMS code, and the ADMS bundle. The Phase-1 launcher tests that exercised the moved resolver/sync move **with** their code into `dewey_portal`; `dewey_time` keeps `test_launcher_gates` and a wiring test for its two hooks.

## Cutover runbook (user bench/Cloud — out of MVP)

A `docs/` runbook: add `dewey_portal` to the bench (`bench get-app` / `install-app`), add it to the Frappe Cloud bench group, **deploy `dewey_portal` and the slimmed `dewey_time` together**, `bench migrate` once (portal DocType import re-homes the definition; reconcile re-syncs tiles; `/home`+`/login` shift to the portal; assets land under `/assets/dewey_portal`), `clear-cache`. Then smoke `/login`, `/home`, `/home/admin`, and per-persona tile gating. Includes a rollback note (the slimmed `dewey_time` deploy is the revert point).

## Testing

- **`dewey_portal` (mock-based, runnable here):** resolver gate dispatch (ported `test_launcher`), reconcile (ported `test_launcher_sync`), landing, tile role-picker, and the new access-overview hook-aggregation. SPA builds (`npm run build`) using the moved `node_modules` (no fresh install / token needed).
- **`dewey_time` (mock-based):** `test_launcher_gates` still green; a wiring test that both hooks (`dewey_launcher_tiles`, `dewey_portal_access_roles`) are well-formed and their dotted-path targets resolve; the slimmed `hooks.py`/`patches.txt` no longer reference moved modules.
- **Integration (user bench):** install + migrate + the smoke checklist in the runbook.

## Out of scope

- The live cutover/deploy (user bench step; documented, not executed).
- Re-contributing employee-photo avatars via a hook.
- Hoisting shared brand tokens into `@lolbikb/dewey-ui`.
- Renaming `/hr-attendance` routes or the `dewey_time` package.
- Any new launcher features — this is a pure relocation + seam-untie.
