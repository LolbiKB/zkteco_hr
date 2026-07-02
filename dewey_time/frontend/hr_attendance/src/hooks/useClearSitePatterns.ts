import { useFrappePostCall } from "frappe-react-sdk";
import { useCallback, useRef, useState } from "react";

import { formatAttendanceLoadError } from "@/hooks/useHrAttendanceData";
import type { ClearSitePatternsPreview } from "@/types/schedule";

export const PREVIEW_CLEAR_SITE_PATTERNS_METHOD =
  "dewey_time.attendance_engine.dev_tools.preview_clear_site_schedule_patterns_api";

// Bounded, committed step — called repeatedly until `done` so the wipe never times out.
export const CLEAR_SITE_PATTERNS_STEP_METHOD =
  "dewey_time.attendance_engine.dev_tools.clear_site_patterns_step_api";

export const CLEAR_SITE_PATTERNS_CONFIRM_PHRASE = "CLEAR SITE PATTERNS";

export type WipeStep = {
  clear_employee_data: boolean;
  current_table: string | null;
  deleted: number;
  counts: Record<string, number>;
  total_remaining: number;
  done: boolean;
  verified_empty: boolean;
  remaining_counts: Record<string, number> | null;
};

export type WipeProgress = {
  processed: number;
  total: number;
  currentTable: string | null;
  done: boolean;
};

// Backstop against an infinite loop if the server never reports `done` (batch=2000, so
// even a very large site is a few dozen steps).
const MAX_WIPE_STEPS = 5000;

export function useClearSitePatterns() {
  const previewCall = useFrappePostCall<{ message: ClearSitePatternsPreview }>(
    PREVIEW_CLEAR_SITE_PATTERNS_METHOD
  );
  const stepCall = useFrappePostCall<{ message: WipeStep }>(CLEAR_SITE_PATTERNS_STEP_METHOD);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [progress, setProgress] = useState<WipeProgress | null>(null);
  const [running, setRunning] = useState(false);

  const previewCallRef = useRef(previewCall);
  previewCallRef.current = previewCall;
  const stepCallRef = useRef(stepCall);
  stepCallRef.current = stepCall;

  const loading = previewCall.loading || running;

  const loadPreview = useCallback(
    async (clearEmployeeData = true): Promise<ClearSitePatternsPreview | null> => {
      setStatus(null);
      previewCallRef.current.reset();
      try {
        const result = await previewCallRef.current.call({
          clear_employee_data: clearEmployeeData ? 1 : 0,
        });
        return result?.message ?? (result as unknown as ClearSitePatternsPreview) ?? null;
      } catch (error) {
        setStatus({ type: "error", message: formatAttendanceLoadError(error) });
        return null;
      }
    },
    []
  );

  const clearSitePatterns = useCallback(
    async (clearEmployeeData = true): Promise<WipeStep | null> => {
      setStatus(null);
      setProgress({ processed: 0, total: 0, currentTable: null, done: false });
      setRunning(true);
      try {
        let initialTotal = 0;
        for (let i = 0; i < MAX_WIPE_STEPS; i++) {
          const result = await stepCallRef.current.call({
            confirm_phrase: CLEAR_SITE_PATTERNS_CONFIRM_PHRASE,
            clear_employee_data: clearEmployeeData ? 1 : 0,
          });
          const step = (result?.message ?? (result as unknown as WipeStep)) || null;
          if (!step) {
            setStatus({ type: "error", message: "Wipe step returned no response" });
            return null;
          }

          const remaining = step.total_remaining ?? 0;
          // The first step already deleted a batch, so the pre-wipe total is
          // (what's left) + (what this step removed).
          if (initialTotal === 0) initialTotal = remaining + (step.deleted ?? 0);
          const total = Math.max(initialTotal, remaining);
          setProgress({
            processed: Math.max(0, total - remaining),
            total,
            currentTable: step.current_table,
            done: step.done,
          });

          if (step.done) {
            setProgress({ processed: total, total, currentTable: null, done: true });
            if (step.verified_empty) {
              setStatus({ type: "success", message: "Site wipe verified clean — all tables empty." });
            } else {
              const leftover = Object.entries(step.remaining_counts ?? {})
                .filter(([, count]) => count > 0)
                .map(([table, count]) => `${count} ${table}`)
                .join(", ");
              setStatus({
                type: "error",
                message: `Wipe incomplete — rows remain: ${leftover || "unknown"}.`,
              });
            }
            return step;
          }
        }
        setStatus({ type: "error", message: "Wipe did not finish within the step limit." });
        return null;
      } catch (error) {
        setStatus({ type: "error", message: formatAttendanceLoadError(error) });
        return null;
      } finally {
        setRunning(false);
      }
    },
    []
  );

  const clearStatus = useCallback(() => {
    setStatus(null);
    setProgress(null);
  }, []);

  return {
    loadPreview,
    clearSitePatterns,
    loading,
    running,
    progress,
    status,
    clearStatus,
  };
}
