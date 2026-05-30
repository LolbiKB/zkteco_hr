import {
  detectObservedLunch,
  observedLunchMinuteRange,
  scheduledLunchMinuteRange,
} from "@/lib/lunchDetection";
import {
  clamp,
  minutesFromDateTime,
  parseDateTimeLocal,
} from "@/lib/attendanceTime";
import {
  deriveSegments as deriveSegmentsFromCheckins,
  deriveTimelineGaps,
  deriveUnpairedPunches,
  hasPunchBranch,
  shiftTimelinePolicyFromShift,
  sortCheckinsByTime as sortCheckinsByTimeLib,
  type Segment as AttendanceSegment,
} from "@/lib/attendancePunches";
import type { Day, ObservedLunch, ShiftContext } from "@/types/calendar";

type Checkin = NonNullable<Day["checkins"]>[number];

export type SegmentInspectorItem =
  | { kind: "segment"; segment: AttendanceSegment }
  | { kind: "unpaired"; checkin: Checkin; isRogue: boolean }
  | {
      kind: "lunch";
      startMin: number;
      endMin: number;
      minutes: number;
      source: "observed" | "scheduled";
      observed?: ObservedLunch | null;
    }
  | { kind: "away"; startMin: number; endMin: number; minutes: number };

type TimelineBlock =
  | { kind: "segment"; segment: AttendanceSegment; startMin: number; endMin: number }
  | { kind: "unpaired"; checkin: Checkin; min: number };

export function deriveSegments(checkins: Checkin[]): AttendanceSegment[] {
  return deriveSegmentsFromCheckins(checkins, {
    parseTime: parseDateTimeLocal,
    minutesFromDateTime,
    clamp,
  });
}

export function sortCheckinsByTime(checkins: Checkin[]): Checkin[] {
  return sortCheckinsByTimeLib(checkins, parseDateTimeLocal);
}

function buildTimelineBlocks(
  segments: AttendanceSegment[],
  unpaired: Checkin[]
): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];

  for (const segment of segments) {
    if (segment.startMin == null || segment.endMin == null) continue;
    blocks.push({
      kind: "segment",
      segment,
      startMin: segment.startMin,
      endMin: segment.endMin,
    });
  }

  for (const checkin of unpaired) {
    const min = minutesFromDateTime(checkin.time);
    if (min == null) continue;
    blocks.push({ kind: "unpaired", checkin, min });
  }

  blocks.sort((a, b) => {
    const aStart = a.kind === "segment" ? a.startMin : a.min;
    const bStart = b.kind === "segment" ? b.startMin : b.min;
    return aStart - bStart;
  });

  return blocks;
}

/** Inspector list: segments, lunch/away gaps, and unpaired punches (chronological). */
export function buildSegmentInspectorItems(
  segments: AttendanceSegment[],
  checkins: Checkin[],
  options?: {
    dateKey?: string;
    shift?: ShiftContext;
    observedLunch?: ObservedLunch | null;
  }
): SegmentInspectorItem[] {
  if (!segments.length && !checkins.length) return [];

  const sorted = [...segments].sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0));
  const unpaired = deriveUnpairedPunches(checkins, parseDateTimeLocal);
  const blocks = buildTimelineBlocks(sorted, unpaired);
  if (!blocks.length) return [];

  const observed =
    options?.observedLunch ??
    (options?.dateKey && options?.shift
      ? detectObservedLunch(checkins, options.shift, options.dateKey)
      : null);
  const shiftPolicy = options?.shift ? shiftTimelinePolicyFromShift(options.shift) : null;
  const gaps = deriveTimelineGaps(sorted, unpaired, minutesFromDateTime, {
    shiftPolicy,
    observedLunchRange: observedLunchMinuteRange(observed),
    scheduledLunchRange: scheduledLunchMinuteRange(options?.shift),
  });

  type Sortable = { sortMin: number; item: SegmentInspectorItem };

  const items: Sortable[] = blocks.map((block) =>
    block.kind === "segment"
      ? { sortMin: block.startMin, item: { kind: "segment" as const, segment: block.segment } }
      : {
          sortMin: block.min,
          item: {
            kind: "unpaired" as const,
            checkin: block.checkin,
            isRogue: !hasPunchBranch(block.checkin),
          },
        }
  );

  for (const gap of gaps) {
    if (gap.kind === "lunch") {
      items.push({
        sortMin: gap.startMin,
        item: {
          kind: "lunch",
          startMin: gap.startMin,
          endMin: gap.endMin,
          minutes: gap.minutes,
          source: gap.source === "observed" ? "observed" : "scheduled",
          observed: gap.source === "observed" ? observed : null,
        },
      });
      continue;
    }

    items.push({
      sortMin: gap.startMin,
      item: {
        kind: "away",
        startMin: gap.startMin,
        endMin: gap.endMin,
        minutes: gap.minutes,
      },
    });
  }

  items.sort((a, b) => a.sortMin - b.sortMin);
  return items.map((entry) => entry.item);
}
