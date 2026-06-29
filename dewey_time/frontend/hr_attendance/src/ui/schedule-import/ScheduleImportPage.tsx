import { ArrowLeftIcon, UploadIcon } from "lucide-react";
import { Link, Navigate, useNavigate, useOutletContext } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useScheduleImport, type ImportStep } from "@/hooks/useScheduleImport";
import type { HrAccessOutletContext } from "@/lib/hrAccess";
import { ReviewStep } from "@/ui/schedule-import/ReviewStep";
import { UploadStep } from "@/ui/schedule-import/UploadStep";

const STEPS: { key: "upload" | "review" | "apply"; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "review", label: "Review" },
  { key: "apply", label: "Apply" },
];

function stepStage(step: ImportStep): "upload" | "review" | "apply" {
  if (step === "idle" || step === "parsing") return "upload";
  if (step === "preview") return "review";
  return "apply";
}

function StepIndicator({ step }: { step: ImportStep }) {
  const stage = stepStage(step);
  const order = STEPS.map((s) => s.key);
  const activeIndex = order.indexOf(stage);
  return (
    <ol className="flex items-center gap-1.5 text-xs">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium transition-colors",
              i === activeIndex
                ? "bg-primary/10 text-primary"
                : i < activeIndex
                  ? "text-foreground"
                  : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-full text-[10px] tabular-nums",
                i === activeIndex
                  ? "bg-primary text-primary-foreground"
                  : i < activeIndex
                    ? "bg-foreground/80 text-background"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {i + 1}
            </span>
            {s.label}
          </span>
          {i < STEPS.length - 1 ? <span className="text-muted-foreground/50">›</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function ScheduleImportPage() {
  const { hrStaff, sessionLoading } = useOutletContext<HrAccessOutletContext>();
  const navigate = useNavigate();
  const controller = useScheduleImport();

  if (sessionLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!hrStaff) {
    return <Navigate to="/hr-attendance" replace />;
  }

  const stage = stepStage(controller.step);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border/60 px-5 py-3 sm:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2.5">
          <Link
            to="/hr-schedule"
            className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />
            Weekly Schedule
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UploadIcon className="size-5" />
              </span>
              <div>
                <h1 className="text-base font-semibold tracking-tight">Import from spreadsheet</h1>
                <p className="text-xs text-muted-foreground">
                  Validate a normalised CSV, then apply schedules in bulk.
                </p>
              </div>
            </div>
            <StepIndicator step={controller.step} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        {stage === "upload" ? (
          <UploadStep
            onFile={(file) => void controller.handleFile(file)}
            parsing={controller.step === "parsing"}
            parseError={controller.parseError}
            fileName={controller.currentFileName}
          />
        ) : (
          <ReviewStep
            controller={controller}
            onBackToSchedule={() => navigate("/hr-schedule")}
          />
        )}
      </div>
    </div>
  );
}
