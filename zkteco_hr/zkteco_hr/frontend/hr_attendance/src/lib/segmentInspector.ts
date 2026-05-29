import { format } from "date-fns";

import {
  clamp,
  minutesFromDateTime,
  parseDateTimeLocal,
} from "@/lib/attendanceTime";
import {
  deriveSegments as deriveSegmentsFromCheckins,
  deriveTimelineGaps,
  deriveUnpairedPunches,
  shiftTimelinePolicyFromShift,
  sortCheckinsByTime as sortCheckinsByTimeLib,
  type Segment as AttendanceSegment,
} from "@/lib/attendancePunches";
import type { Day, ShiftContext } from "@/types/calendar";

type Checkin = NonNullable<Day["checkins"]>[number];

export type AwayGap = {
  start?: Checkin | null;
  end?: Checkin | null;
  minutes: number | null;
  startMin?: number | null;
  endMin?: number | null;
  topPct?: number;
  heightPct?: number;
};

export type SegmentInspectorItem =
  | { kind: "segment"; segment: AttendanceSegment }
  | { kind: "away"; gap: AwayGap };

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

/** Real punch at this minute, or a display-only stub using the day's date from checkins. */
function checkinAtMinuteOfDay(checkins: Checkin[], min: number): Checkin {
  const match = checkins.find((c) => minutesFromDateTime(c.time) === min);
  if (match) return match;

  const ref = checkins.find((c) => c.time)?.time;
  const base = ref ? parseDateTimeLocal(ref) : new Date();
  const d = new Date(base);
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return { time: format(d, "yyyy-MM-dd HH:mm:ss") } as Checkin;
}

export function buildSegmentInspectorItems(
  segments: AttendanceSegment[],
  checkins: Checkin[],
  shift?: ShiftContext
): SegmentInspectorItem[] {
  if (!segments.length && !checkins.length) return [];

  const sorted = [...segments].sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0));
  const unpaired = deriveUnpairedPunches(checkins, parseDateTimeLocal);
  const timelineGaps = deriveTimelineGaps(
    sorted,
    unpaired,
    minutesFromDateTime,
    shiftTimelinePolicyFromShift(shift)
  );
  const items: SegmentInspectorItem[] = [];

  type Entry =
    | { kind: "segment"; segment: AttendanceSegment; orderMin: number }
    | { kind: "away"; gap: AwayGap; orderMin: number };

  const entries: Entry[] = [];

  for (const segment of sorted) {
    entries.push({ kind: "segment", segment, orderMin: segment.startMin ?? 0 });
  }

  for (const gap of timelineGaps) {
    entries.push({
      kind: "away",
      orderMin: gap.startMin,
      gap: {
        start: checkinAtMinuteOfDay(checkins, gap.startMin),
        end: checkinAtMinuteOfDay(checkins, gap.endMin),
        minutes: gap.minutes,
        startMin: gap.startMin,
        endMin: gap.endMin,
      },
    });
  }

  entries.sort((a, b) => a.orderMin - b.orderMin);

  for (const entry of entries) {
    if (entry.kind === "segment") items.push({ kind: "segment", segment: entry.segment });
    else items.push({ kind: "away", gap: entry.gap });
  }

  return items;
}
