import type { Checkin } from "@/types/calendar";

export type Segment = {
  start: Checkin;
  end: Checkin;
  minutes: number | null;
  startMin: number | null;
  endMin: number | null;
  startPct: number | null;
  endPct: number | null;
  branch: string | null;
};

export type TimelineGap = {
  startMin: number;
  endMin: number;
  minutes: number;
  kind: "lunch" | "away";
  source: "observed" | "scheduled" | "gap";
  startCheckin?: Checkin | null;
  endCheckin?: Checkin | null;
};

export function punchBranch(checkin: Checkin): string | null {
  const branch = checkin.custom_device_branch?.trim();
  return branch || null;
}

export function hasPunchBranch(checkin: Checkin): boolean {
  return punchBranch(checkin) != null;
}

/**
 * Consecutive punches at the same device branch (branch change starts a new run).
 * Punches without custom_device_branch are never grouped — each is its own run (rogue).
 */
export function groupCheckinsByBranchRuns(sorted: Checkin[]): Checkin[][] {
  const runs: Checkin[][] = [];

  for (const checkin of sorted) {
    if (!hasPunchBranch(checkin)) {
      runs.push([checkin]);
      continue;
    }

    const branch = punchBranch(checkin)!;
    const current = runs[runs.length - 1];

    if (!current?.length) {
      runs.push([checkin]);
      continue;
    }

    const currentBranch = punchBranch(current[0]!);
    if (currentBranch && currentBranch === branch) {
      current.push(checkin);
    } else {
      runs.push([checkin]);
    }
  }

  return runs;
}

export function sortCheckinsByTime(
  checkins: Checkin[],
  parseTime: (value: string) => Date
): Checkin[] {
  return [...checkins].sort(
    (a, b) => parseTime(a.time).getTime() - parseTime(b.time).getTime()
  );
}

/** MVP direction within a single branch run; ignores Employee Checkin.log_type. */
export function inferCheckinDirection(sortedIndex: number, totalCheckins: number): "IN" | "OUT" {
  if (totalCheckins <= 0) return "IN";
  if (sortedIndex === 0) return "IN";
  if (sortedIndex === totalCheckins - 1) return "OUT";
  return sortedIndex % 2 === 0 ? "IN" : "OUT";
}

export function directionForCheckin(sorted: Checkin[], checkin: Checkin): "IN" | "OUT" {
  for (const run of groupCheckinsByBranchRuns(sorted)) {
    const idx = run.findIndex(
      (row) =>
        row === checkin ||
        (row.name && checkin.name && row.name === checkin.name) ||
        row.time === checkin.time
    );
    if (idx >= 0) return inferCheckinDirection(idx, run.length);
  }
  return "IN";
}

export function deriveSegments(
  checkins: Checkin[],
  helpers: {
    parseTime: (value: string) => Date;
    minutesFromDateTime: (value: string | null | undefined) => number | null;
    clamp: (value: number, min: number, max: number) => number;
  }
): Segment[] {
  const sorted = sortCheckinsByTime(checkins, helpers.parseTime);
  const out: Segment[] = [];

  for (const run of groupCheckinsByBranchRuns(sorted)) {
    if (!run.length || !hasPunchBranch(run[0]!)) continue;

    for (let i = 0; i < run.length - 1; i += 2) {
      const start = run[i]!;
      const end = run[i + 1]!;
      const startBranch = punchBranch(start);
      const endBranch = punchBranch(end);

      if (!startBranch || !endBranch || startBranch !== endBranch) {
        continue;
      }

      let minutes: number | null = null;
      if (start.time && end.time) {
        const delta = helpers.parseTime(end.time).getTime() - helpers.parseTime(start.time).getTime();
        if (Number.isFinite(delta) && delta >= 0) minutes = Math.round(delta / 60000);
      }

      const startMin = helpers.minutesFromDateTime(start.time);
      const endMin = helpers.minutesFromDateTime(end.time);
      const dayMinutes = 24 * 60;

      out.push({
        start,
        end,
        minutes,
        startMin,
        endMin,
        startPct: startMin != null ? helpers.clamp((startMin / dayMinutes) * 100, 0, 100) : null,
        endPct: endMin != null ? helpers.clamp((endMin / dayMinutes) * 100, 0, 100) : null,
        branch: startBranch ?? endBranch,
      });
    }
  }

  return out;
}

/**
 * Unpaired punches: every punch without branch (rogue), plus last punch in a named
 * branch run when that run has an odd count.
 */
export function deriveUnpairedPunches(
  checkins: Checkin[],
  parseTime: (value: string) => Date
): Checkin[] {
  const sorted = sortCheckinsByTime(checkins, parseTime);
  const unpaired: Checkin[] = [];

  for (const run of groupCheckinsByBranchRuns(sorted)) {
    if (!run.length) continue;

    if (!hasPunchBranch(run[0]!)) {
      unpaired.push(...run);
      continue;
    }

    if (run.length % 2 === 1) {
      unpaired.push(run[run.length - 1]!);
    }
  }

  return unpaired;
}

export type ShiftTimelinePolicy = {
  startMin?: number | null;
  endMin?: number | null;
  graceMinutes?: number;
  lunchStartMin?: number | null;
  lunchEndMin?: number | null;
};

export function parseShiftTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = time.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function shiftTimelinePolicyFromShift(shift: {
  shift_assigned?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  grace_minutes?: number;
  lunch_start?: string | null;
  lunch_end?: string | null;
} | null | undefined): ShiftTimelinePolicy | null {
  if (!shift?.shift_assigned) return null;
  const graceMinutes = Number.isFinite(shift.grace_minutes) ? Number(shift.grace_minutes) : 0;
  return {
    startMin: parseShiftTimeToMinutes(shift.start_time ?? null),
    endMin: parseShiftTimeToMinutes(shift.end_time ?? null),
    graceMinutes,
    lunchStartMin: parseShiftTimeToMinutes(shift.lunch_start ?? null),
    lunchEndMin: parseShiftTimeToMinutes(shift.lunch_end ?? null),
  };
}

/** Minutes not counted as unaccounted away time (shift start grace + scheduled lunch + lunch-end grace). */
export function buildShiftExemptIntervals(
  policy: ShiftTimelinePolicy
): Array<{ startMin: number; endMin: number }> {
  const exempt: Array<{ startMin: number; endMin: number }> = [];
  const grace = Math.max(0, policy.graceMinutes ?? 0);

  if (policy.startMin != null && Number.isFinite(policy.startMin)) {
    exempt.push({ startMin: policy.startMin, endMin: policy.startMin + grace });
  }

  if (
    policy.lunchStartMin != null &&
    policy.lunchEndMin != null &&
    policy.lunchEndMin > policy.lunchStartMin
  ) {
    exempt.push({
      startMin: policy.lunchStartMin,
      endMin: policy.lunchEndMin + grace,
    });
  }

  return exempt;
}

export function subtractExemptFromGap(
  gap: { startMin: number; endMin: number },
  exemptIntervals: Array<{ startMin: number; endMin: number }>
): Array<{ startMin: number; endMin: number }> {
  let parts = [{ startMin: gap.startMin, endMin: gap.endMin }];

  for (const exempt of exemptIntervals) {
    const next: Array<{ startMin: number; endMin: number }> = [];
    for (const part of parts) {
      const overlapStart = Math.max(part.startMin, exempt.startMin);
      const overlapEnd = Math.min(part.endMin, exempt.endMin);
      if (overlapEnd <= overlapStart) {
        next.push(part);
        continue;
      }
      if (part.startMin < overlapStart) {
        next.push({ startMin: part.startMin, endMin: overlapStart });
      }
      if (overlapEnd < part.endMin) {
        next.push({ startMin: overlapEnd, endMin: part.endMin });
      }
    }
    parts = next;
  }

  return parts.filter((p) => p.endMin > p.startMin);
}

export type TimelineGapOptions = {
  shiftPolicy?: ShiftTimelinePolicy | null;
  /** Punch-derived lunch OUT→IN (same heuristic as closeout flags). */
  observedLunchRange?: { startMin: number; endMin: number } | null;
  /** Scheduled lunch window incl. return grace — used when no observed lunch. */
  scheduledLunchRange?: { startMin: number; endMin: number } | null;
};

/**
 * Lunch and away intervals on the timeline.
 * Away applies only between consecutive paired segments (segment end → next segment start).
 * Gaps involving unpaired punches are not labeled away — use missing expected instead.
 * Observed lunch from punches takes priority over schedule-only inference.
 */
export function deriveTimelineGaps(
  segments: Segment[],
  _unpaired: Checkin[],
  _minutesFromDateTime: (value: string | null | undefined) => number | null,
  shiftPolicyOrOptions?: ShiftTimelinePolicy | null | TimelineGapOptions
): TimelineGap[] {
  const options: TimelineGapOptions =
    shiftPolicyOrOptions && "observedLunchRange" in shiftPolicyOrOptions
      ? shiftPolicyOrOptions
      : { shiftPolicy: shiftPolicyOrOptions ?? null };

  const shiftPolicy = options.shiftPolicy ?? null;
  const observedLunchRange = options.observedLunchRange ?? null;
  const scheduledLunchRange =
    options.scheduledLunchRange ??
    (shiftPolicy?.lunchStartMin != null &&
    shiftPolicy?.lunchEndMin != null &&
    shiftPolicy.lunchEndMin > shiftPolicy.lunchStartMin
      ? {
          startMin: shiftPolicy.lunchStartMin,
          endMin: shiftPolicy.lunchEndMin + Math.max(0, shiftPolicy.graceMinutes ?? 0),
        }
      : null);

  const sortedSegments = segments
    .filter((segment) => segment.startMin != null && segment.endMin != null)
    .sort((a, b) => a.startMin! - b.startMin!);

  const results: TimelineGap[] = [];

  if (observedLunchRange) {
    const minutes = observedLunchRange.endMin - observedLunchRange.startMin;
    if (minutes > 0) {
      results.push({
        startMin: observedLunchRange.startMin,
        endMin: observedLunchRange.endMin,
        minutes,
        kind: "lunch",
        source: "observed",
      });
    }
  }

  const startGraceInterval =
    shiftPolicy?.startMin != null && Number.isFinite(shiftPolicy.startMin)
      ? {
          startMin: shiftPolicy.startMin,
          endMin: shiftPolicy.startMin + Math.max(0, shiftPolicy.graceMinutes ?? 0),
        }
      : null;

  for (let i = 0; i < sortedSegments.length - 1; i++) {
    const current = sortedSegments[i]!;
    const next = sortedSegments[i + 1]!;
    const endMin = current.endMin!;
    const startMin = next.startMin!;
    if (startMin <= endMin) continue;

    let parts = [{ startMin: endMin, endMin: startMin }];

    if (observedLunchRange) {
      parts = subtractExemptFromGap(
        { startMin: endMin, endMin: startMin },
        [observedLunchRange]
      );
    }

    if (startGraceInterval) {
      const trimmed: typeof parts = [];
      for (const part of parts) {
        trimmed.push(...subtractExemptFromGap(part, [startGraceInterval]));
      }
      parts = trimmed;
    }

    for (const part of parts) {
      if (scheduledLunchRange) {
        const lunchOverlapStart = Math.max(part.startMin, scheduledLunchRange.startMin);
        const lunchOverlapEnd = Math.min(part.endMin, scheduledLunchRange.endMin);
        if (lunchOverlapEnd > lunchOverlapStart) {
          results.push({
            startMin: lunchOverlapStart,
            endMin: lunchOverlapEnd,
            minutes: lunchOverlapEnd - lunchOverlapStart,
            kind: "lunch",
            source: "scheduled",
          });
        }
        for (const awayPart of subtractExemptFromGap(part, [scheduledLunchRange])) {
          const minutes = awayPart.endMin - awayPart.startMin;
          if (minutes <= 0) continue;
          results.push({
            startMin: awayPart.startMin,
            endMin: awayPart.endMin,
            minutes,
            kind: "away",
            source: "gap",
          });
        }
        continue;
      }

      const minutes = part.endMin - part.startMin;
      if (minutes <= 0) continue;
      results.push({
        startMin: part.startMin,
        endMin: part.endMin,
        minutes,
        kind: "away",
        source: "gap",
      });
    }
  }

  results.sort((a, b) => a.startMin - b.startMin);
  return results;
}

/** Week timeline: 10 hours of time map to the full scroll viewport height. */
export const TIMELINE_VIEWPORT_HOURS = 10;
export const TIMELINE_VIEWPORT_MINUTES = TIMELINE_VIEWPORT_HOURS * 60;

export const DEFAULT_TIMELINE_FALLBACK_WINDOW = {
  startMin: 8 * 60,
  endMin: 18 * 60,
};

export function computeWeekTimelineWindow(
  minuteValues: number[],
  marginMinutes = 30,
  fallback: { startMin: number; endMin: number } = DEFAULT_TIMELINE_FALLBACK_WINDOW
): { startMin: number; endMin: number; spanMinutes: number } {
  if (!minuteValues.length) {
    const spanMinutes = fallback.endMin - fallback.startMin;
    return { startMin: fallback.startMin, endMin: fallback.endMin, spanMinutes };
  }

  const min = Math.min(...minuteValues);
  const max = Math.max(...minuteValues);
  const startMin = Math.max(0, min - marginMinutes);
  const endMin = Math.min(24 * 60, max + marginMinutes);
  const spanMinutes = Math.max(60, endMin - startMin);
  return { startMin, endMin, spanMinutes };
}

/** Inner week canvas height (% of scroll viewport). Grows when span exceeds 10 hours. */
export function weekTimelineCanvasHeightPct(
  spanMinutes: number,
  viewportMinutes = TIMELINE_VIEWPORT_MINUTES
): number {
  return Math.max(100, (spanMinutes / viewportMinutes) * 100);
}

export function weekTimelineNeedsScroll(
  spanMinutes: number,
  viewportMinutes = TIMELINE_VIEWPORT_MINUTES
): boolean {
  return spanMinutes > viewportMinutes;
}

export function computeDayTimeWindow(
  checkins: Checkin[],
  minutesFromDateTime: (value: string | null | undefined) => number | null,
  marginMinutes = 30
): { startMin: number; endMin: number; span: number } | null {
  const mins: number[] = [];
  for (const checkin of checkins) {
    const min = minutesFromDateTime(checkin.time);
    if (min != null) mins.push(min);
  }
  if (!mins.length) return null;

  const startMin = Math.max(0, Math.min(...mins) - marginMinutes);
  const endMin = Math.min(24 * 60, Math.max(...mins) + marginMinutes);
  if (endMin <= startMin) return null;

  return { startMin, endMin, span: endMin - startMin };
}
