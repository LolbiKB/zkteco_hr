import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ImportIssue } from "@/types/scheduleImport";
import { ISSUE_CODE_LABELS } from "@/ui/schedule-import/constants";

export function IssueBadge({ issue }: { issue: ImportIssue }) {
  const label = ISSUE_CODE_LABELS[issue.code] ?? issue.code;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-normal",
        issue.severity === "error" && "border-destructive/40 text-destructive",
        issue.severity === "warning" && "border-brand-accent/40 text-brand-accent",
        issue.severity === "info" && "border-border text-muted-foreground"
      )}
      title={issue.suggestion ?? issue.message}
    >
      {label}
    </Badge>
  );
}
