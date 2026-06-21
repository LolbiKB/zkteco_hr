# Phase 2 — Dewey conformance sweep: findings (pre-spec)

- **Date:** 2026-06-20
- **Status:** FINDINGS / discovery — not yet a spec. Phase 2 implementation is **gated** (see "Gating" below).
- **Scope audited:** the 27 `src/ui/*.tsx` screens of the HR attendance SPA, against the six Dewey guardrails. Phase 1 (brand layer + wordmark + dial mark) is already merged on `main`.

## Method

A 27-agent LLM conformance workflow was attempted first; it **stalled** (one agent dead through 6 retries, ~870k tokens / ~100 min, no synthesized result) — a bad cost/value trade. This pass is instead a **deterministic grep audit + judgment**, which is faster and gives ground truth for the checkable guardrails. The one guardrail that genuinely needs design judgment (color-as-signal) is called out as a decision for the user, not auto-resolved.

## Summary verdict

The screens are **structurally sound** on dewey-ui primitives (cards, sheets, dialogs, tokens) — the substrate is right. The conformance gap is a **pre-Dewey semantic palette** baked into ~16 screens that predates the brand layer: `emerald` = success, `sky` = info/active, `amber` = warning, each rendered as a **tinted surface** with **`dark:` variants**. This collides with four guardrails at once and is the bulk of Phase 2.

## Findings by guardrail

### G1 — Neutral substrate (tinted surfaces) · **HIGH**
Panels use brand-ish tinted backgrounds: `bg-emerald-500/5`, `bg-sky-500/5`, `bg-amber-500/5` with matching tinted borders (`border-emerald-500/25`). Examples:
- `ClearEmployeeScheduleDialog.tsx:172` — `border-emerald-500/25 bg-emerald-500/5` confirmation panel
- `DayInspectorSheet.tsx:365` — `border-sky-500/30 bg-sky-500/5` info card; `:380,:388` sky-tinted chips
- `ClearEmployeeScheduleDialog.tsx:253` — `bg-amber-500/5` caution strip

Dewey rule: surfaces stay neutral; the signal rides an **accent** (a left bar, an icon, a dot), not a tinted wallpaper. Fix pattern: neutral card + a colored 1px left rule / icon carrying the signal (the codebase already does the left-bar idiom, e.g. `DayInspectorSheet.tsx:316,367`).

### G2 / G3 — Color is not the Dewey signal system; hardcoded hues · **HIGH (design decision)**
Counts (occurrences): **amber ≈103, emerald ≈54, sky ≈26**, across 16 files (App, DayInspectorSheet, DayTimeline, WeekView, WeekScheduleGantt, FlagDetailPanel, WeekFlagSummary, WeeklySchedulePage, all the Clear*/Import/Spreadsheet/RunEngine dialogs, DeviceAlerts).
- These are hardcoded tailwind hues, **not** brand tokens. Notably `emerald` is a **second green** beside Phase 1's Forest `--primary` → two greens in one app.
- The mapping is a 4-state semantic palette (success / info / warning + destructive), which is **wider than Dewey's 3 signals** (primary green / accent orange / destructive red) + neutral.

**This is the central Phase 2 design decision (needs the user) —** how to reconcile a multi-state attendance UI with a 3-signal language:
- **Option A (strict Dewey):** collapse to the 3 signals — success/confirm → `--primary`; warning/attention → `--brand-accent` (orange); destructive → `--destructive`; demote `sky`/info to neutral. Most on-brand; loses some state distinction.
- **Option B (extended tokens):** add a small set of *semantic status tokens* (`--status-ok`, `--status-info`, `--status-warn`) in `brand/tokens.css`, tuned to sit beside the brand, and replace the raw hues with them. Keeps state richness, stays "one place to retune," but extends the palette beyond the canonical 3.
- Attendance flags (LATE_START, LEFT_EARLY, MISSING_TIME, UNNOTIFIED_ABSENCE, OFF_SHIFT_PUNCH, …) likely need more than 3 categories, so this is a real call, not a rubber-stamp.

### G4 — Light-only (`dark:` variants) · **MEDIUM**
**~50 `dark:` utilities across 16 files.** They are currently **inert** (nothing toggles `.dark` on `<html>`, so the app stays light), but they violate the light-only principle and are dead maintenance noise. Strip them as part of the same palette sweep (they're co-located with the tinted-surface classes).

### G5 — Motion restraint · **LOW**
Mostly fine. `animate-spin` (23) = loading spinners, acceptable. Issues: a few ad-hoc `duration-300/200/350` + `ease-out` (≈14 hits) instead of the one house easing/durations from `base.css`; `animate-in` (12, tailwindcss-animate) overlaps the `base.css` choreography. Normalize opportunistically; low priority.

### G6 — Accessible names · **✓ CONFORMANT (verified)**
All four `size="icon"` (icon-only) buttons already carry `aria-label`s — `AttendanceToolbar.tsx:84` ("Previous week"), `:105` ("Next week"), `:130` ("Refresh attendance data"), `RunEngineDialog.tsx:99` ("Run flag engine"). The icon-button a11y guardrail passes; **no action needed.** (This was the only Phase-2 item separable from the palette decision — it's already done.)

## Recommended Phase 2 sequencing

1. **Decide the palette (G2/G3)** — user picks Option A or B above. *Everything else depends on this.*
2. **Finalize the green** — Phase 1's `--brand-primary` is provisional; the sweep restyles *against* the brand colors, so the green (and any new status tokens) must be locked first. Restyling against a provisional palette is wasted work.
3. Then one screen-cluster-at-a-time sweep (its own spec + TDD plan), per cluster: detint surfaces (G1) → map hues to tokens (G2/G3) → strip `dark:` (G4) → normalize motion (G5) → fix icon-button aria (G6). Suggested cluster order by user-visibility: **WeekView/DayTimeline/FlagDetailPanel/WeekFlagSummary** (the main calendar) → **DayInspectorSheet** → **schedule wizard** (WeeklySchedulePage + Gantt + pickers) → **dialogs** (Clear*/Import/RunEngine/Spreadsheet) → **DeviceAlerts**.

## Gating

Phase 2 **implementation is intentionally not started.** It is blocked on two user inputs that cannot be resolved autonomously:
- **The palette decision** (G2/G3 Option A vs B) — a design judgment about how many signal colors an attendance UI needs.
- **The final green** (and any status tokens) — restyling must target locked colors.

Both are natural follow-ups to a short brainstorming pass. Mechanical-only sub-tasks that are safe to do **before** those decisions: stripping inert `dark:` variants (G4) and icon-button aria (G6) — but bundling them into the per-cluster sweep is cleaner.
