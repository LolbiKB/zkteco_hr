import type { Day, DeviceAlert, Flag } from "@/types/calendar";
import { format } from "date-fns";
import { ArrowRightIcon, LogInIcon, LogOutIcon } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatBranchLabel,
  formatCheckinTime,
  formatDurationMinutes,
} from "@/lib/attendanceTime";
import { directionForCheckin, type Segment as AttendanceSegment } from "@/lib/attendancePunches";
import {
  buildSegmentInspectorItems,
  deriveSegments,
  sortCheckinsByTime,
  type AwayGap,
} from "@/lib/segmentInspector";
import { cn } from "@/lib/utils";
import { DeviceAlertRow } from "@/ui/DeviceAlerts";

type Checkin = NonNullable<Day["checkins"]>[number];
type Severity = "INFO" | "WARNING" | "CRITICAL";

const SEVERITY_ORDER: Severity[] = ["CRITICAL", "WARNING", "INFO"];

export type DayInspectorSheetProps = {
  inspectingDate: string | null;
  employee: string | null;
  inspectingDay?: Day;
  alertsByDate: Map<string, DeviceAlert[]>;
  inspectingFlag: Flag | null;
  onInspectingFlagChange: (flag: Flag | null) => void;
  onClose: () => void;
};

export function DayInspectorSheet(props: DayInspectorSheetProps) {
  const segments = useMemo(
    () => deriveSegments(props.inspectingDay?.checkins ?? []),
    [props.inspectingDay?.checkins]
  );
  const segmentInspectorItems = useMemo(
    () =>
      buildSegmentInspectorItems(
        segments,
        props.inspectingDay?.checkins ?? [],
        props.inspectingDay?.shift
      ),
    [props.inspectingDay?.checkins, props.inspectingDay?.shift, segments]
  );

  const punches = sortCheckinsByTime(props.inspectingDay?.checkins ?? []);
  const dayAlerts = props.inspectingDate
    ? (props.alertsByDate.get(props.inspectingDate) ?? [])
    : [];
  const flags = [...(props.inspectingDay?.flags ?? [])].sort((a, b) => {
    const aIdx = SEVERITY_ORDER.indexOf((a.severity ?? "WARNING") as Severity);
    const bIdx = SEVERITY_ORDER.indexOf((b.severity ?? "WARNING") as Severity);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return (a.flag_code ?? "").localeCompare(b.flag_code ?? "");
  });

  return (
    <Sheet open={!!props.inspectingDate} onOpenChange={(open) => !open && props.onClose()}>
      <SheetContent side="right" className="flex w-[440px] flex-col overflow-hidden sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {props.inspectingDate ? format(new Date(props.inspectingDate), "EEE, MMM d") : "Day"}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <span className="text-foreground">{props.employee}</span>
            <Separator orientation="vertical" className="h-4" />
            <span>Inspector</span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1 px-4 pb-5">
          <div className="grid h-full grid-rows-[auto_1fr_auto] gap-3">
            <Tabs defaultValue="timeline" className="min-h-0">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="timeline" className="gap-2">
                  Segments
                  <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                    {segmentInspectorItems.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="punches" className="gap-2">
                  Punches
                  <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                    {punches.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="flags" className="gap-2">
                  Flags
                  <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                    {flags.length + dayAlerts.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="mt-3 min-h-0">
                <Card className="border-border/60">
                  <CardContent className="space-y-3 pt-4">
                    {segments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-6 text-center">
                        <div className="text-sm font-medium">No segments</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Not enough punches to form segments for this day.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {segmentInspectorItems.map((item, idx) =>
                          item.kind === "segment" ? (
                            <SegmentInspectorRow key={`segment-${idx}`} segment={item.segment} />
                          ) : (
                            <AwayInspectorRow key={`away-${idx}`} gap={item.gap} />
                          )
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="punches" className="mt-3 min-h-0">
                <Card className="border-border/60">
                  <CardContent className="pt-4">
                    {punches.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-6 text-center">
                        <div className="text-sm font-medium">No punches</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          There are no checkins recorded for this day.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {punches.map((checkin, idx) => (
                          <PunchInspectorRow
                            key={checkin.name ?? `${checkin.time}-${idx}`}
                            checkin={checkin}
                            index={idx + 1}
                            direction={directionForCheckin(punches, checkin)}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="flags" className="mt-3 min-h-0">
                <Card className="border-border/60">
                  <CardContent className="pt-4">
                    <div className="text-sm font-medium">Flags</div>
                    {dayAlerts.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          Device closeout
                        </div>
                        {dayAlerts.map((alert) => (
                          <DeviceAlertRow key={`${alert.device_sn}-${alert.local_date}`} alert={alert} />
                        ))}
                      </div>
                    ) : null}
                    {flags.length === 0 && dayAlerts.length === 0 ? (
                      <div className="mt-3 rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-6 text-center">
                        <div className="text-sm font-medium">No flags</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          No attendance flags for this day.
                        </div>
                      </div>
                    ) : flags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {flags.slice(0, 14).map((f) => (
                          <Tooltip key={f.name}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="rounded-full focus:outline-hidden focus:ring-2 focus:ring-ring/40"
                                onClick={() => props.onInspectingFlagChange(f)}
                              >
                                <FlagBadge flag={f} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs">
                                <div className="font-medium">{f.flag_code}</div>
                                <div className="text-muted-foreground">
                                  {f.status ?? "OPEN"} · {f.severity ?? "WARNING"}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    ) : null}

                    {props.inspectingFlag ? (
                      <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                        <div className="text-xs font-medium">Selected</div>
                        <div className="mt-1 flex items-center gap-2">
                          <FlagBadge flag={props.inspectingFlag} />
                          <div className="text-xs text-muted-foreground">
                            {props.inspectingFlag.status ?? "OPEN"}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SegmentInspectorRow(props: { segment: AttendanceSegment }) {
  const { segment } = props;
  const branch = formatBranchLabel(segment.branch);

  return (
    <div className="flex gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 shadow-xs">
      <div className="mt-0.5 flex w-8 shrink-0 flex-col items-center gap-1">
        <div className="h-full min-h-10 w-1 rounded-full bg-emerald-600" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold tracking-tight">
              <span>{formatCheckinTime(segment.start?.time ?? null)}</span>
              <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>{formatCheckinTime(segment.end?.time ?? null)}</span>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold">
            {formatDurationMinutes(segment.minutes)}
          </Badge>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px] font-semibold">
              IN
            </Badge>
            <ArrowRightIcon className="size-3 text-muted-foreground" aria-hidden="true" />
            <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px] font-semibold">
              OUT
            </Badge>
          </div>
          {branch ? (
            <span className="shrink-0 text-right text-xs text-muted-foreground">{branch}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AwayInspectorRow(props: { gap: AwayGap }) {
  const { gap } = props;

  return (
    <div className="flex gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-3 shadow-xs">
      <div className="mt-0.5 flex w-8 shrink-0 flex-col items-center gap-1">
        <div className="h-full min-h-10 w-1 rounded-full bg-destructive/60" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold tracking-tight text-destructive">
              <span>{formatCheckinTime(gap.start?.time ?? null)}</span>
              <ArrowRightIcon className="size-3.5 text-destructive/70" aria-hidden="true" />
              <span>{formatCheckinTime(gap.end?.time ?? null)}</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 rounded-md border-destructive/30 bg-background/80 px-2 py-0.5 text-[11px] font-semibold text-destructive"
          >
            {formatDurationMinutes(gap.minutes)}
          </Badge>
        </div>
        <div className="flex items-end justify-between gap-3">
          <Badge
            variant="outline"
            className="h-5 rounded-md border-destructive/30 bg-destructive/10 px-1.5 text-[10px] font-semibold text-destructive"
          >
            Away
          </Badge>
          <span className="shrink-0 text-right text-xs text-muted-foreground">Unaccounted time</span>
        </div>
      </div>
    </div>
  );
}

function PunchInspectorRow(props: { checkin: Checkin; index: number; direction: "IN" | "OUT" }) {
  const { checkin, index, direction } = props;
  const isIn = direction === "IN";
  const branch = formatBranchLabel(checkin.custom_device_branch);
  const Icon = isIn ? LogInIcon : LogOutIcon;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 shadow-xs">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg border",
          isIn
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200"
        )}
        aria-label={direction}
      >
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold tracking-tight">{formatCheckinTime(checkin.time)}</div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">#{index}</span>
          {branch ? (
            <span className="shrink-0 text-right text-xs text-muted-foreground">{branch}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FlagBadge({ flag }: { flag: Flag }) {
  const sev = flag.severity ?? "WARNING";
  const provisional = flag.is_provisional === true || flag.day_closed === 0;

  if (provisional) {
    return (
      <Badge
        variant="outline"
        className="rounded-full border border-dashed border-amber-500/70 bg-amber-500/10 text-[11px] text-amber-950 dark:text-amber-100"
        title="Provisional (intraday)"
      >
        {flag.flag_code}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border text-[11px]",
        sev === "CRITICAL" &&
          "border-destructive bg-destructive text-destructive-foreground",
        sev === "WARNING" &&
          "border-amber-600 bg-amber-500/20 text-amber-950 dark:text-amber-100",
        sev === "INFO" && "border-border bg-foreground/5 text-foreground"
      )}
      title={`Final · ${flag.status ?? "OPEN"}`}
    >
      {flag.flag_code}
    </Badge>
  );
}
