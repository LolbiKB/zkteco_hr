# HR Attendance UI — build & Frappe Cloud deploy

SPA routes: `/hr-attendance`, `/hr-schedule` (shared bundle)  
Source: `frontend/hr_attendance/`  
Built output: `public/hr_attendance/` (commit JS/CSS to git)  
WWW entries: `www/hr-attendance.html`, `www/hr-schedule.html` + matching `.py` handlers (Jinja, `no_cache = 1`)

## Build

```bash
cd zkteco_hr/zkteco_hr/frontend/hr_attendance
npm install
npm run build
```

This writes:

- `public/hr_attendance/assets/index.js` / `index.css` (stable filenames)
- `public/hr_attendance/assets/build-id.txt` (timestamp for debugging)
- `www/hr-attendance.html` and `www/hr-schedule.html` with literal `?v=<timestamp>` on asset URLs (cache bust)
- copies the same HTML to `public/hr_attendance/index.html` (do **not** serve this as the app entry)

Commit `public/hr_attendance/assets/*`, `www/hr-attendance.html`, and `www/hr-schedule.html` with your code changes.

## How Frappe serves the bundle

| URL | Served from |
|-----|-------------|
| `/hr-attendance` | `www/hr-attendance.html` (Jinja — CSRF token) |
| `/hr-schedule` | `www/hr-schedule.html` (same bundle, different title) |
| `/assets/zkteco_hr/hr_attendance/assets/index.js` | `public/hr_attendance/assets/` (via bench symlink or sync copy) |

After deploy, Frappe Cloud usually symlinks:

`sites/assets/zkteco_hr/hr_attendance` → `apps/.../public/hr_attendance`

When that symlink exists, files are read **directly from `public/`** in the app repo. No copy step is required.

## `sync_hr_attendance_assets` (migrate hook)

Runs on every `bench migrate` (`hooks.py` → `after_migrate`).

**Purpose:** fallback when the bench symlink is missing (otherwise CSS/JS 404).

**Rules (do not break these):**

1. **If `sites/assets/.../hr_attendance` is a symlink → skip sync.**  
   Copying `public/hr_attendance/assets/` into the symlink target is copying **onto the same directory**. A partial sync that `rmtree`s only `assets/` will **delete the bundle** and leave 404s until restored.

2. **If sync is needed → full `copytree` of `public/hr_attendance/`, excluding `index.html`.**  
   `index.html` contains Jinja (`{{ frappe.session.csrf_token }}`). It must only be served via `/hr-attendance`, not as a static file under `/assets/`.

3. **Do not use Jinja in asset URLs** (`?v={{ asset_version }}`).  
   Static asset paths are not rendered by Jinja. The browser requests the literal string `{{%20asset_version%20}}` and gets HTML → MIME type error.

4. **Cache bust with a build-time literal** in `copy-html-entry.mjs` (`?v=1730123456`), not server-side template vars.

Implementation: `zkteco_hr/utils/sync_hr_attendance_assets.py`

## Troubleshooting

### Symptom: `404` on `index.js` / `index.css`

The file is missing under `sites/assets/zkteco_hr/hr_attendance/assets/`.

- Confirm built files are in git and deployed (`public/hr_attendance/assets/index.css` ~120 KB).
- Run **Migrate** on Frappe Cloud (runs `sync_hr_attendance_assets` + any one-time repair patches).
- On bench SSH (if available):  
  `ls sites/assets/zkteco_hr/hr_attendance/assets/index.css`

### Symptom: MIME type `'text/html'` on CSS/JS

Almost always a **404 disguised as a stylesheet error** — Frappe returns its HTML error page.

Less common: URL contains unrendered Jinja (`?v={{ asset_version }}`). Fix: rebuild with current `copy-html-entry.mjs`.

### Symptom: UI unchanged after push

- Hard refresh, or check that `www/hr-attendance.html` has a new `?v=` timestamp from the latest build.
- Confirm deploy succeeded and migrate ran.

### Symptom: stale UI but assets load (200)

Browser cached old `index.js` (stable filename). Rebuild to bump `?v=` in HTML.

## Incident reference (May 2026)

Broken sync copied `assets/` onto itself via symlink → deleted bundle → 404 → browser reported `text/html` MIME on CSS. Fixed in commit `383ea8f0` (symlink detection + full copytree fallback + `resync_hr_attendance_assets_v2` patch).
