import type { WeekPattern } from "@/types/schedule";
import { weekPatternForApi } from "@/types/schedule";

// Pure orchestration for bulk schedule apply. Kept free of React/network so the
// concurrency model — parallel ACROSS shared-pattern groups, serial WITHIN a
// group — is unit-testable. The serial-within-group rule matters: the apply
// endpoint decides create-vs-use for the shared Shift Type/Schedule at apply
// time, so two members of one group applied concurrently would both try to
// create the same record and the second would hit the duplicate guard.

export type ApplyRowInput = {
  /** Original index into the parsed-rows array (used to map per-row status). */
  index: number;
  employee: string;
  /** Stable key grouping rows that share an identical week pattern. */
  patternKey: string;
  /** Pre-serialized weekPatternForApi(pattern) payload for the apply call. */
  weekPatternJson: string;
};

export type ApplyOutcome =
  | { index: number; ok: true }
  | { index: number; ok: false; error: string };

type ApplyableRow = {
  employee: string | null;
  week_pattern: WeekPattern | null;
  importable: boolean;
};

/** Turn parsed rows + the current selection into the apply work-list. */
export function buildApplyRows(
  rows: ApplyableRow[],
  selected: Set<number>
): ApplyRowInput[] {
  const out: ApplyRowInput[] = [];
  rows.forEach((row, index) => {
    if (!selected.has(index) || !row.importable || !row.employee || !row.week_pattern) {
      return;
    }
    const json = JSON.stringify(weekPatternForApi(row.week_pattern));
    out.push({ index, employee: row.employee, patternKey: json, weekPatternJson: json });
  });
  return out;
}

/** Bucket rows by patternKey, preserving first-seen order of groups and rows. */
export function groupRowsByPattern(rows: ApplyRowInput[]): ApplyRowInput[][] {
  const groups = new Map<string, ApplyRowInput[]>();
  for (const row of rows) {
    const bucket = groups.get(row.patternKey) ?? [];
    bucket.push(row);
    groups.set(row.patternKey, bucket);
  }
  return [...groups.values()];
}

/** A group's effective date is its override (if set) else the batch default. */
export function resolveEffectiveDate(
  patternKey: string,
  batchEffectiveFrom: string,
  overrides: Record<string, string> = {}
): string {
  const override = overrides[patternKey];
  return override && override.trim() ? override : batchEffectiveFrom;
}

export type ApplyRowFn = (row: ApplyRowInput, effectiveFrom: string) => Promise<void>;

export type RunApplyOptions = {
  rows: ApplyRowInput[];
  batchEffectiveFrom: string;
  groupOverrides?: Record<string, string>;
  /** Max pattern groups applied concurrently. */
  laneLimit?: number;
  applyRow: ApplyRowFn;
  onOutcome?: (outcome: ApplyOutcome) => void;
  /** Polled before each group and each row; true stops launching new work. */
  shouldCancel?: () => boolean;
};

export async function runScheduleImportApply(opts: RunApplyOptions): Promise<ApplyOutcome[]> {
  const {
    rows,
    batchEffectiveFrom,
    groupOverrides = {},
    laneLimit = 5,
    applyRow,
    onOutcome,
    shouldCancel,
  } = opts;

  const groups = groupRowsByPattern(rows);
  const outcomes: ApplyOutcome[] = [];
  let nextGroup = 0;

  async function lane(): Promise<void> {
    // `nextGroup++` is atomic between awaits (single-threaded), so lanes never
    // claim the same group.
    while (true) {
      if (shouldCancel?.()) return;
      const groupIndex = nextGroup++;
      if (groupIndex >= groups.length) return;

      for (const row of groups[groupIndex]!) {
        if (shouldCancel?.()) return;
        let outcome: ApplyOutcome;
        try {
          const effective = resolveEffectiveDate(row.patternKey, batchEffectiveFrom, groupOverrides);
          await applyRow(row, effective);
          outcome = { index: row.index, ok: true };
        } catch (err) {
          outcome = {
            index: row.index,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
        outcomes.push(outcome);
        onOutcome?.(outcome);
      }
    }
  }

  const laneCount = Math.max(1, Math.min(laneLimit, groups.length || 1));
  await Promise.all(Array.from({ length: laneCount }, () => lane()));
  return outcomes;
}
