import type { ShiftContext } from "@/types/calendar";

import {
  clamp,
  minutesFromDateTime,
  minutesSinceMidnight,
  parseDateTimeLocal,
  parseTimeToMinutes,
} from "@/lib/attendanceTime";

export function computeDaySpan(firstIn: string | null, lastOut: string | null) {
  if (!firstIn || !lastOut) return null;
  const a = parseDateTimeLocal(firstIn);
  const b = parseDateTimeLocal(lastOut);
  const aMin = minutesSinceMidnight(a);
  const bMin = minutesSinceMidnight(b);
  if (!Number.isFinite(aMin) || !Number.isFinite(bMin) || bMin < aMin) return null;
  const topPct = clamp((aMin / (24 * 60)) * 100, 0, 100);
  const bottomPct = clamp((bMin / (24 * 60)) * 100, 0, 100);
  const heightPct = Math.max(2, bottomPct - topPct);
  return { topPct, heightPct };
}

export function computeExpectedWindowPct(shift: ShiftContext) {
  if (!shift?.shift_assigned) return null;
  const startMin = parseTimeToMinutes(shift.start_time);
  const endMin = parseTimeToMinutes(shift.end_time);
  if (startMin == null || endMin == null) return null;
  if (endMin < startMin) return null;
  const topPct = clamp((startMin / (24 * 60)) * 100, 0, 100);
  const bottomPct = clamp((endMin / (24 * 60)) * 100, 0, 100);
  const heightPct = Math.max(2, bottomPct - topPct);
  return { topPct, heightPct, startMin, endMin };
}

export function computeLunchWindowPct(shift: ShiftContext) {
  if (!shift?.shift_assigned) return null;
  const startMin = parseTimeToMinutes(shift.lunch_start ?? null);
  const endMin = parseTimeToMinutes(shift.lunch_end ?? null);
  if (startMin == null || endMin == null) return null;
  if (endMin < startMin) return null;
  const topPct = clamp((startMin / (24 * 60)) * 100, 0, 100);
  const bottomPct = clamp((endMin / (24 * 60)) * 100, 0, 100);
  const heightPct = Math.max(2, bottomPct - topPct);
  return { topPct, heightPct, startMin, endMin };
}

export function computeExpectedMinutes(shift: ShiftContext) {
  if (!shift?.shift_assigned) return null;
  const startMin = parseTimeToMinutes(shift.start_time ?? null);
  const endMin = parseTimeToMinutes(shift.end_time ?? null);
  if (startMin == null || endMin == null) return null;
  if (endMin < startMin) return null;
  return endMin - startMin;
}

export function computeLateness(shift: ShiftContext, firstIn: string | null) {
  if (!shift?.shift_assigned) return null;
  const startMin = parseTimeToMinutes(shift.start_time ?? null);
  if (startMin == null) return null;
  const grace = Number.isFinite(shift.grace_minutes) ? Number(shift.grace_minutes) : 0;
  const thresholdMin = startMin + grace;
  const thresholdPct = clamp((thresholdMin / (24 * 60)) * 100, 0, 100);

  if (!firstIn) return { thresholdPct, isLate: false, deltaMinutes: null };
  const fiMin = minutesFromDateTime(firstIn) ?? NaN;
  const deltaMinutes = fiMin - thresholdMin;
  return {
    thresholdPct,
    isLate: deltaMinutes > 0,
    deltaMinutes: deltaMinutes > 0 ? deltaMinutes : 0,
  };
}

export function computeAdherenceOpacity(shift: ShiftContext, grossMinutes: number | null) {
  const expected = computeExpectedMinutes(shift);
  if (expected == null || expected <= 0) return 1;
  if (grossMinutes == null) return 0.55;
  const ratio = grossMinutes / expected;
  return clamp(0.55 + clamp(ratio, 0, 1.1) * 0.35, 0.55, 0.92);
}
