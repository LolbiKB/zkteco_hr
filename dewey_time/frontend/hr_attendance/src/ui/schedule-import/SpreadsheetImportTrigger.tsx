import { UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SpreadsheetImportTrigger(props: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      className={cn("h-9 gap-2", props.className)}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      <UploadIcon className="size-3.5" />
      Import
    </Button>
  );
}
