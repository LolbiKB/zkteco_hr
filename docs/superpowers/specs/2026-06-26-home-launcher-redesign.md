# /home Launcher Redesign — "Dewey International Portal"

**Status:** locked design (prototyped + approved). Implements the `di-7-applist-max` mockup.

## Goal
Rebuild the `/home` launcher (`dewey_time/frontend/home/src/Launcher.tsx`) from the current small-square springboard into a clean, modern **company portal** for **Dewey International** — header-less, app-list-first, with a brand backdrop and a compact app filter.

## Identity model (important)
- **The home is the company portal (Dewey International)** — NOT "Dewey Time". "Dewey Time" is the HR Attendance app (one tile). So the home carries the **company** identity (DI mark + "Dewey International"), never a product name.

## Layout (top → bottom), full-height flex column, `max-w` ~1200px centered
1. **Identity row** — DI logo mark + `Dewey International` wordmark (left); account avatar button (right).
2. **Greeting** — uppercase date eyebrow (`EEEE, MMMM d`), `Good {morning|afternoon|evening}, {firstName}`, a short forest-green keyline.
3. **Apps header** — `YOUR APPS` label (left) + a **compact search field** (right) that filters the app list.
4. **App panel (the main event)** — a 2-column "quiet row" grid (icon chip + title + description + chevron, hairline dividers, green hover accent). Fills remaining height and **scrolls internally** when apps exceed the viewport.
5. **Footer** — `Signed in as {full_name} · {role?}` + Help.

**Brand backdrop:** a large, desaturated **DI logo ghost** bleeding off the top-right, radial-masked, ~0.15 opacity — present but never fighting content. Lives behind everything (`z-index:0`); content sits above.

## Data & behavior
- Source: `get_launcher` → `LauncherData { user{full_name, initials, image_url?, can_manage_tiles}, apps[]{name,title,route,logo,admin} }`.
- **Icons:** each app's own `logo` image in a neutral chip (real data; the mockup's line icons were placeholders).
- **Search:** client-side filter on `app.title` (case-insensitive). Empty result → quiet "No apps match" row. Trivial, no backend.
- **Admin tiles:** `app.admin` → small orange "Admin" badge (brand accent).
- **Account menu** (dewey-ui `DropdownMenu`): full name label; Profile (`/app/user-profile`); Manage tiles (only if `can_manage_tiles` → `/home/admin`); Log out (`useFrappeAuth().logout()` → `/login`). Preserve current behavior.
- **Greeting:** `firstName = full_name.split(" ")[0]`; time-of-day from local hour; date via `date-fns format`.
- **States:** loading → skeleton; error → existing Retry / Go to Desk / Log out; empty apps → "No apps assigned yet — contact your administrator."

## Constraints
- Tailwind classes + brand tokens (`--primary` forest green, `--brand-accent` orange). Geist (already bundled). Match existing component conventions (`AdminTiles`, etc.).
- The backdrop (mask-image radial) + custom scrollbar live as small raw-CSS rules in `index.css` (Tailwind can't express the masked gradient cleanly).
- Accessible: keyboard-focusable app rows + account button; `aria-label`s; visible focus rings (brand green).
- DI asset: `/assets/dewey_time/images/DI-logo.svg` (identity mark + backdrop).
- Responsive: collapses to 1 column and tightens spacing on narrow widths.

## Build / deploy
- `cd dewey_time/frontend/home && npm run build` → writes `public/home/assets/index.{js,css}` + bumps `build-id.txt`; `copy-html-entry.mjs` cache-busts the HTML. Commit the rebuilt bundle.
- Frappe Cloud: Deploy → Migrate (syncs assets) → Clear Cache.

## Out of scope (later)
- Global/command search beyond app-filter. Per-app stats / dashboard data. Consistent custom line-icon set (vs per-tile logos). Aligning the **login** page to the same "Dewey International" identity (currently "Dewey Frappe").
