import { useState } from "react";
import { ChevronDownIcon, RotateCcwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { cn } from "@/lib/utils";
import { formatScheduleDuration } from "@/lib/weekSchedule";
import type { ImportPatternBucket } from "@/hooks/useImportSchedulePlanSummary";
import { summarizeWeekPattern } from "@/types/schedule";

export function GroupEffectiveDates(props: {
  buckets: ImportPatternBucket[];
  effectiveFrom: string;
  onEffectiveFromChange: (value: string) => void;
  groupOverrides: Record<string, string>;
  onGroupOverrideChange: (patternKey: string, date: string) => void;
  disabled?: boolean;
}) {
  const {
    buckets,
    effectiveFrom,
    onEffectiveFromChange,
    groupOverrides,
    onGroupOverrideChange,
    disabled,
  } = props;
  const [expanded, setExpanded] = useState(false);

  const overrideCount = buckets.filter((b) => groupOverrides[b.patternKey]).length;

  return (
    <div className="space-y-2">
      <DatePickerInput
        id="import-effective-from"
        label="Effective from (applies to all groups)"
        value={effectiveFrom}
        onChange={onEffectiveFromChange}
        disabled={disabled}
        className="w-full"
      />

      {buckets.length > 1 ? (
        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
            onClick={() => setExpanded((v) => !v)}
            disabled={disabled}
          >
            <ChevronDownIcon
              className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
            />
            Per-group dates
            {overrideCount > 0 ? (
              <Badge variant="secondary" className="ml-1 text-[10px] font-normal">
                {overrideCount} overridden
              </Badge>
            ) : (
              <span className="text-muted-foreground"> ({buckets.length} groups)</span>
            )}
          </button>

          {expanded ? (
            <ul className="mt-2 max-h-60 space-y-2 overflow-y-auto pr-1">
              {buckets.map((bucket) => {
                const { workDays, totalWeeklyMinutes } = summarizeWeekPattern(bucket.weekPattern);
                const override = groupOverrides[bucket.patternKey] ?? "";
                return (
                  <li
                    key={bucket.patternKey}
                    className="rounded-md border border-border/50 bg-muted/20 px-2 py-2"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                      <span className="font-medium text-foreground">
                        {bucket.employeeCount} employee{bucket.employeeCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {workDays} day{workDays !== 1 ? "s" : ""}
                        {totalWeeklyMinutes > 0
                          ? ` · ${formatScheduleDuration(totalWeeklyMinutes)}/wk`
                          : null}
                      </span>
                      {override ? (
                        <button
                          type="button"
                          className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                          onClick={() => onGroupOverrideChange(bucket.patternKey, "")}
                          disabled={disabled}
                          title="Reset to batch date"
                        >
                          <RotateCcwIcon className="size-3" />
                          Reset
                        </button>
                      ) : null}
                    </div>
                    <DatePickerInput
                      value={override}
                      onChange={(date) => onGroupOverrideChange(bucket.patternKey, date)}
                      disabled={disabled}
                      placeholder={
                        effectiveFrom ? `Batch date (${effectiveFrom})` : "Uses batch date"
                      }
                      className="w-full"
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
