import { format } from "date-fns";
import { useMemo } from "react";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  clamp,
  formatDurationMinutes,
  minutesFromDateTime,
  parseDateTimeLocal,
  parseTimeToMinutes,
} from "@/lib/attendanceTime";
import {
  computeDayTimeWindow,
  deriveTimelineGaps,
  deriveUnpairedPunches,
  shiftTimelinePolicyFromShift,
} from "@/lib/attendancePunches";
import { deriveSegments } from "@/lib/segmentInspector";
import {
  computeAdherenceOpacity,
  computeDaySpan,
  computeExpectedWindowPct,
  computeLateness,
  computeLunchWindowPct,
} from "@/lib/shiftTimeline";
import { cn } from "@/lib/utils";
import type { Day, Flag, ShiftContext } from "@/types/calendar";

type Checkin = NonNullable<Day["checkins"]>[number];

export function DayCell(props: {
  date: Date;
  outside: boolean;
  today: boolean;
  info?: Day;
  dense: boolean;
  timelineStartMin?: number;
  timelineEndMin?: number;
  onInspectDay: () => void;
  onInspectFlag: (flag: Flag) => void;
}) {
  const checkins = props.info?.checkins ?? [];
  const hasUnpairedPunch = deriveUnpairedPunches(checkins, parseDateTimeLocal).length > 0;

  return (
    <button
      type="button"
      onClick={props.onInspectDay}
      className={cn(
        "group relative min-h-0 border-b border-r border-border/60 p-3 text-left outline-hidden transition-colors hover:bg-muted/20 focus:bg-muted/20 focus:ring-2 focus:ring-ring/40",
        props.dense ? "h-full" : "h-full",
        props.outside && "bg-muted/10 text-muted-foreground",
        props.today && "bg-primary/3 ring-1 ring-primary/20"
      )}
    >
      <div className={cn("grid h-full gap-2", props.dense ? "grid-rows-[20px_1fr]" : "grid-rows-[1fr]")}>
        {props.dense ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-4 w-1 rounded-full",
                  hasUnpairedPunch ? "bg-destructive" : "bg-muted/40"
                )}
                aria-hidden="true"
              />
              <div className="text-xs font-semibold">{format(props.date, "d")}</div>
            </div>
            <div className="opacity-0 transition-opacity group-hover:opacity-100">
              <span className="text-[11px] text-muted-foreground">Inspect</span>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 h-full">
          <DayDayTrack
            firstIn={props.info?.first_in ?? null}
            lastOut={props.info?.last_out ?? null}
            checkins={checkins}
            shift={props.info?.shift ?? { shift_assigned: false }}
            grossMinutes={props.info?.gross_minutes ?? null}
            dense={props.dense}
            windowStartMin={props.timelineStartMin}
            windowEndMin={props.timelineEndMin}
          />
        </div>
      </div>
    </button>
  );
}

function DayDayTrack(props: {
  firstIn: string | null;
  lastOut: string | null;
  checkins: Checkin[];
  shift: ShiftContext;
  grossMinutes: number | null;
  dense: boolean;
  windowStartMin?: number;
  windowEndMin?: number;
}) {
  const color = "bg-emerald-600";

  const span = computeDaySpan(props.firstIn, props.lastOut);
  const segments = deriveSegments(props.checkins);
  const roguePunches = useMemo(
    () => deriveUnpairedPunches(props.checkins ?? [], parseDateTimeLocal),
    [props.checkins]
  );
  const shiftPolicy = useMemo(
    () => shiftTimelinePolicyFromShift(props.shift),
    [props.shift]
  );
  const gaps = useMemo(
    () => deriveTimelineGaps(segments, roguePunches, minutesFromDateTime, shiftPolicy),
    [roguePunches, segments, shiftPolicy]
  );
  const expected = computeExpectedWindowPct(props.shift);
  const lunch = computeLunchWindowPct(props.shift);
  const lateness = computeLateness(props.shift, props.firstIn);
  const adherence = computeAdherenceOpacity(props.shift, props.grossMinutes);

  const window = useMemo(() => {
    if (props.dense) return null;
    if (props.windowStartMin != null && props.windowEndMin != null) {
      const span = props.windowEndMin - props.windowStartMin;
      if (span > 0) {
        return {
          startMin: props.windowStartMin,
          endMin: props.windowEndMin,
          span,
        };
      }
    }
    return computeDayTimeWindow(props.checkins ?? [], minutesFromDateTime);
  }, [props.checkins, props.dense, props.windowEndMin, props.windowStartMin]);

  function pctFromMinute(min: number) {
    if (!window) return clamp((min / (24 * 60)) * 100, 0, 100);
    return clamp(((min - window.startMin) / window.span) * 100, 0, 100);
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div
        className={cn("relative rounded-xl bg-muted/25", props.dense ? "" : "min-h-0 flex-1")}
        style={props.dense ? { height: 96 } : undefined}
      >
        <div
          className="absolute inset-y-2 w-px bg-border/60"
          style={{ left: "calc(50% - 0.5px)" }}
        />

        {roguePunches.map((c, idx) => {
          const m = minutesFromDateTime(c.time);
          if (m == null) return null;
          const topPct = pctFromMinute(m);
          return (
            <div
              key={`${c.time}-${idx}`}
              className="absolute inset-x-2 h-1 rounded-full bg-destructive shadow-sm"
              style={{ top: `calc(${topPct}% - 2px)` }}
              title={`Unpaired punch · ${format(parseDateTimeLocal(c.time), "h:mm a")}`}
            />
          );
        })}

        {expected && !window ? (
          <div
            className="absolute inset-x-3 rounded-md border border-dashed border-border/70 bg-background/10"
            style={{
              top: `calc(${expected.topPct}% + 8px)`,
              height: `calc(${expected.heightPct}% - 16px)`,
            }}
            title={`Expected: ${props.shift.start_time ?? ""}–${props.shift.end_time ?? ""}`}
          />
        ) : null}

        {lunch && !window ? (
          <div
            className="absolute inset-x-3 rounded-md bg-muted/20"
            style={{
              top: `calc(${lunch.topPct}% + 8px)`,
              height: `calc(${lunch.heightPct}% - 16px)`,
            }}
            title={`Lunch: ${props.shift.lunch_start ?? ""}–${props.shift.lunch_end ?? ""}`}
          />
        ) : null}

        {window && props.shift.shift_assigned ? (
          <>
            {(() => {
              const startMin = parseTimeToMinutes(props.shift.start_time ?? null);
              const endMin = parseTimeToMinutes(props.shift.end_time ?? null);
              if (startMin == null || endMin == null || endMin <= startMin) return null;
              const topPct = pctFromMinute(startMin);
              const bottomPct = pctFromMinute(endMin);
              const heightPct = Math.max(2, bottomPct - topPct);
              return (
                <div
                  className="absolute inset-x-3 rounded-md border border-dashed border-border/70 bg-background/10"
                  style={{ top: `calc(${topPct}% + 8px)`, height: `calc(${heightPct}% - 16px)` }}
                />
              );
            })()}
            {(() => {
              const ls = parseTimeToMinutes(props.shift.lunch_start ?? null);
              const le = parseTimeToMinutes(props.shift.lunch_end ?? null);
              if (ls == null || le == null || le <= ls) return null;
              const topPct = pctFromMinute(ls);
              const bottomPct = pctFromMinute(le);
              const heightPct = Math.max(2, bottomPct - topPct);
              return (
                <div
                  className="absolute inset-x-3 rounded-md bg-muted/20"
                  style={{ top: `calc(${topPct}% + 8px)`, height: `calc(${heightPct}% - 16px)` }}
                />
              );
            })()}
          </>
        ) : null}

        {props.dense && span && segments.length === 0 ? (
          <div
            className={cn("absolute left-1/2 w-[12px] -translate-x-1/2 rounded-sm opacity-20", color)}
            style={{
              top: `calc(${span.topPct}% + 8px)`,
              height: `calc(${span.heightPct}% - 16px)`,
            }}
          />
        ) : null}

        {gaps.slice(0, props.dense ? 3 : 6).map((g, idx) => {
          const topPct = pctFromMinute(g.startMin);
          const endPct = pctFromMinute(g.endMin);
          const heightPct = endPct - topPct;
          if (heightPct <= 0) return null;
          return (
            <HoverCard key={idx} openDelay={220} closeDelay={120}>
              <HoverCardTrigger asChild>
                <div
                  className="absolute inset-x-2 rounded-sm border-2 border-solid border-destructive/70 bg-destructive/5"
                  style={{
                    top: `${topPct}%`,
                    height: `${heightPct}%`,
                  }}
                />
              </HoverCardTrigger>
              <HoverCardContent className="w-auto p-2">
                <div className="text-xs">
                  Away · {formatDurationMinutes(g.minutes)}
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        })}

        {segments.length === 0 ? null : (
          segments.slice(0, props.dense ? 3 : 6).map((s, idx) => {
            if (s.startMin == null || s.endMin == null) return null;
            const topPct = pctFromMinute(s.startMin);
            const endPct = pctFromMinute(s.endMin);
            const heightPct = endPct - topPct;
            if (heightPct <= 0) return null;
            const branch = s.branch ?? null;
            const branchShort = branch ? branch.replace(/^BRANCH-/, "") : "";
            const startLabel = s.start?.time ? format(new Date(s.start.time), "h:mma") : "—";
            const endLabel = s.end?.time ? format(new Date(s.end.time), "h:mma") : "—";
            const compactTip = [
              `${startLabel}–${endLabel}`,
              s.minutes != null ? formatDurationMinutes(s.minutes) : null,
              branchShort ? `Branch ${branchShort}` : null,
              lateness?.isLate && lateness.deltaMinutes != null
                ? `Late ${formatDurationMinutes(lateness.deltaMinutes, { signed: true })}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <HoverCard key={idx} openDelay={220} closeDelay={120}>
                <HoverCardTrigger asChild>
                  <div
                    className={cn(
                      "absolute inset-x-2 rounded-sm shadow-sm ring-1 ring-foreground/10",
                      color
                    )}
                    style={{
                      top: `${topPct}%`,
                      height: `${heightPct}%`,
                      opacity: adherence,
                    }}
                  >
                    {!props.dense && heightPct >= 12 ? (
                      <div className="pointer-events-none absolute inset-0 px-2 pt-1.5 text-white/95">
                        <div className="absolute left-2 top-1.5 text-[11px] font-semibold leading-tight">
                          {startLabel}
                        </div>
                        {heightPct >= 18 ? (
                          <div className="absolute right-2 top-1.5 text-[10px] font-medium text-white/85">
                            {formatDurationMinutes(s.minutes)}
                          </div>
                        ) : null}
                        {heightPct >= 22 && lateness?.isLate && lateness.deltaMinutes != null ? (
                          <div className="absolute right-2 bottom-1.5 text-[10px] font-medium text-white/85">
                            {formatDurationMinutes(lateness.deltaMinutes, { signed: true })}
                          </div>
                        ) : null}
                        {heightPct >= 24 ? (
                          <div className="absolute left-2 right-2 top-[22px] truncate text-[10px] font-medium text-white/85">
                            {branchShort ? `Branch ${branchShort}` : "Branch —"}
                          </div>
                        ) : null}
                        <div className="absolute bottom-1.5 left-2 text-[11px] font-semibold leading-tight">
                          {endLabel}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-auto max-w-[320px] p-2">
                  <div className="text-xs">{compactTip || "Segment"}</div>
                </HoverCardContent>
              </HoverCard>
            );
          })
        )}
      </div>
    </div>
  );
}
