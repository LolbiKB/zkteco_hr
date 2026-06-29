# Schedule Import — dedicated page redesign

**Date:** 2026-06-29
**Status:** Design — awaiting review
**Scope:** Frontend only (`frontend/hr_attendance`). No backend changes.

## Goal

Promote the bulk "Import from spreadsheet" flow out of a cramped centered modal
into its own first-class page at `/hr-schedule/import`, and redesign the flow to
handle real-world batches (≈329 rows) without losing the parts that already work
well (filter chips, issue badges, problems-CSV export, live plan summary).

## Background

Today the importer is `SpreadsheetImportDialog` — an ~800-line wizard crammed
into a `max-w-2xl`, `max-h-44rem` `Dialog`, launched from a small "Import" button
wedged between the employee picker and three destructive "Clear …" buttons in the
Weekly Schedule wizard header (`WeeklySchedulePage.tsx:336`).

Four pains (all confirmed by the user):

1. **Cramped for big files** — 300+ rows in a tiny scroll viewport.
2. **Entry point buried** — reads as a secondary action of single-employee editing.
3. **Flow friction** — one global effective date set late in the footer; serial
   per-row apply (`for … await`, `SpreadsheetImportDialog.tsx:601`) with no cancel
   and no aggregate progress; closing mid-triage calls `reset()` and loses
   everything (`:534`); normalization happens off-tool ("use Haiku prompt first").
4. **Visual polish** — wants a tightening pass throughout.

## Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Container | **Dedicated route/page** `/hr-schedule/import` under `HrAppShell` |
| 2 | Normalization | **Keep external, improve guidance** (copy-prompt, format help, template download). In-app AI normalization = separate future spec |
| 3 | Effective date | **One batch date + per-pattern-group override** |
| 4 | Recovery | **Persist parsed rows + filters + selections in `sessionStorage`**; clear on apply success / start over |
| 5 | Apply (given) | **Concurrent across pattern groups, serial within a group**, with aggregate progress bar + cancel |
| 6 | Polish (given) | Full visual pass on hierarchy, spacing, states, copy |

## Architecture

### Routing & entry points

- `main.tsx`: add `<Route path="/hr-schedule/import" element={<ScheduleImportPage />} />`
  as a sibling of `/hr-schedule` under the `HrAppShell` element. `hooks.py` already
  rewrites `/hr-schedule/<path>` to the SPA entry, so **no backend route work**.
- `WeeklySchedulePage.tsx`: the existing `SpreadsheetImportTrigger` becomes a
  **navigation** to `/hr-schedule/import` (via `useNavigate`) instead of opening a
  dialog. Remove `importOpen` state and the `<SpreadsheetImportDialog>` mount.
- `ScheduleImportPage` renders a "← Back to Weekly Schedule" link (preserving the
  current tab context). The Schedule tab in the shell stays as-is; import is a
  sub-destination of Schedule, reachable by URL + the wizard button.
- **Access gating:** HR-staff-only, same as the Schedule tab. Read `hrStaff` from
  the `HrAccessOutletContext`; while loading show a skeleton; if resolved non-HR,
  `<Navigate to="/hr-attendance" replace />`.

### Component decomposition

Break the monolith into focused units (brainstorming "design for isolation"):

```
src/ui/schedule-import/
  ScheduleImportPage.tsx     — page shell, step orchestration, access gate, layout
  UploadStep.tsx             — dropzone + "how to get this file" guidance panel
  ReviewStep.tsx             — summary bar + row list + per-group date controls
                               + plan summary + apply bar
  ApplyStep.tsx              — aggregate progress, cancel, per-row results, done summary
  PreviewRow.tsx             — (moved from dialog, largely unchanged)
  IssueBadge.tsx             — (moved)
  SummaryBar.tsx             — (moved; filter chips + problems-CSV export)
  GroupEffectiveDates.tsx    — batch date + per-pattern-group overrides
  constants.ts               — DAY_ABBREV, SHAPE_LABELS, ISSUE_CODE_LABELS, methods
```

```
src/hooks/
  useScheduleImport.ts       — headless state machine: file → parse → rows/summary/
                               selection/filter → groups → apply → done; owns
                               sessionStorage persistence
```

```
src/lib/
  scheduleImportApply.ts     — pure: group selected rows by patternKey, resolve
                               per-group effective date, bounded-concurrency runner
  scheduleImportPersist.ts   — pure: serialize/deserialize review state (versioned)
  importProblems.ts          — (existing, reused as-is)
```

### Reuse map (no rewrite)

- `buildImportPatternBuckets`, `useImportSchedulePlanSummary`, `ImportSchedulePlanSummary`
- `buildProblemRows` / `problemsToCsv` (`lib/importProblems.ts`)
- Apply endpoint `apply_weekly_schedule` with `confirm_create: 1`,
  `derive_employment_type: 1` (unchanged)
- `weekPatternForApi`, `summarizeWeekPattern` (`types/schedule.ts`)

### `SpreadsheetImportDialog` fate

Delete it once `ScheduleImportPage` is live and the wizard button navigates.
`SpreadsheetImportTrigger` is kept (repurposed as the nav button). Its sub-pieces
(`DropZone`, `PreviewRow`, `IssueBadge`, `SummaryBar`, helpers) move into
`schedule-import/` rather than being reinvented.

## Flow / UX

A 3-step page with a persistent step indicator (Upload → Review → Apply):

**① Upload.** Full-width dropzone + a side/under panel: "How to prepare this file"
with a copy-the-Haiku-prompt button, the canonical 7-column format reference, and a
template CSV download. Parse errors render inline.

**② Review.** The heart, now with real vertical space:
- `SummaryBar` (filter chips + counts + problems-CSV export) — unchanged behavior.
- Full-height scrollable row list (`PreviewRow` cards; stacked on mobile, roomier
  on desktop). Pre-selected = importable rows, as today.
- `GroupEffectiveDates`: one batch date input (default) + an expandable list of
  pattern groups (from `buildImportPatternBuckets`) each able to override the date.
- `ImportSchedulePlanSummary` live preview (reused) reflecting current selection.
- Apply bar: "Apply N employees" with the resolved group/date breakdown.

**③ Apply.** Aggregate progress bar (`done/total`, ok/failed), a **Cancel** that
stops launching new groups (in-flight finish), and per-row result chips. Done
summary offers "Import another" (clears persisted state) and "Back to Schedule".

## Concurrency model

Grounded in `schedule_api.py:404-418`: each apply call decides `create` vs `use`
for the **shared** Shift Type/Schedule at apply time. Concurrent applies of two
members of the *same* pattern group both attempt `create` → the duplicate guard
(`:438`) fails the second. Therefore:

- **Group rows by `patternKey`** (reuse `buildImportPatternBuckets` grouping).
- **Run groups in parallel** with a bounded pool (e.g. 4–6 lanes).
- **Within a group, apply members serially**: the first creates the shared
  Shift Type/Schedule; the rest see `action: "use"` and reuse.
- Each member applies with **its group's effective date** (override or batch default).

This is safe (no shared-record contention across groups) and fast (≈ #patterns ×
speedup; a 329-row / ~6-pattern file ≈ 6× faster than today's fully-serial loop).

## Persistence / recovery

- Key `dewey:schedule-import:v1` in `sessionStorage`.
- Persist on parse + on every selection/filter/date change: parsed `rows`,
  `summary`, `feedback_rows`, `selected` (as array), `rowFilter`, batch
  `effectiveFrom`, and per-group date overrides. (The `File` is **not** stored;
  parsed rows are enough to restore Review.)
- Hydrate on mount when present and not already applied → land directly on Review.
- Clear on: all-applied success, explicit "Start over" / "Import another".
- Versioned payload; a version mismatch is ignored (treated as no saved state).

## Backend impact

**One small fix, surfaced by the pre-merge review.** The apply/resolve/parse
endpoints already supported everything needed, BUT the parallel-apply design had a
latent race the review caught: rows are grouped by full week pattern, yet the shared
*Shift Type* is named on clock hours only (`FT_{start}_{end}`), so two distinct
day-patterns sharing the same hours (the app's 5-day vs 5.5-day case) land in
different groups, run in parallel, and both resolve `create` for the same Shift Type
— the loser hit a duplicate guard and the employee rolled back.

Fix: `create_shift_type` (`schedule_resolver.py`) is now idempotent under
concurrency — on a duplicate insert it re-matches and reuses the existing record,
mirroring the try/except → re-match that `create_shift_schedule` already had.
Regression-locked by `TestCreateShiftTypeIdempotency` (TDD). Safe for the manual
wizard (single-threaded, never races). The *Shift Schedule* path was already safe
(its name embeds the days, so collisions only happen within an identical pattern,
which is serialized within a group).

## Testing plan (TDD)

Frontend logic is extracted specifically to be unit-testable under the existing
`npm run test:web` harness (`tsx --test src/lib/*.test.ts`, node:test/assert):

- `scheduleImportApply.test.ts` — grouping by patternKey; per-group date resolution
  (override vs batch default); bounded-concurrency runner (respects pool size,
  parallel across groups, serial within a group, cancel stops new launches,
  partial-failure isolation).
- `scheduleImportPersist.test.ts` — serialize/deserialize round-trip; version-guard
  rejects stale payloads; selection Set ↔ array fidelity.
- Existing `importProblems` tests stay green.
- `tsc` clean; production bundle rebuilt (`npm run build`).
- Backend suite unchanged and green (no Python edits planned).

## Out of scope

- In-app AI / raw-spreadsheet normalization (separate future spec).
- Any change to parse / resolve / apply backend logic beyond verification.
- The single-employee Weekly Schedule wizard's own UX (only its Import button changes).
- A full sortable data-grid — `PreviewRow` cards are retained; the win is space, not a new table widget.

## Risks & open questions

- **Concurrency vs. shared records** — mitigated by the group-parallel/row-serial
  model above; a pre-implementation read of `create_shift_type`/`create_shift_schedule`
  confirms first-write-wins within a group before coding the runner.
- **sessionStorage size** — ~329 parsed rows of JSON is small; acceptable. Guard
  against quota errors (fail soft: skip persistence, keep working).
- **Mobile** — page must remain usable on phones (stacked rows; the bottom tab bar
  reserves space via the shell). No new mobile-only layout beyond responsive stacking.

## Build / deploy

Frontend-only: after implementation, `npm run build` then `bench migrate` on
Frappe Cloud to sync the rebuilt bundle. No patch, no DocType, no hook changes.
