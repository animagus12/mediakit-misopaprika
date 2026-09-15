"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EDITOR_TRANSACTION_STATUS_OPTIONS } from "@/lib/editorTransactions";
import { cn } from "@/lib/utils";

// Tinted like the badge it replaced, so the column still scans by colour; the
// label carries the meaning either way.
function statusTone(status: string): string {
  switch (status.toLowerCase()) {
    case "paid":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
    case "pending":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
    case "cancelled":
      return "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/20";
    default:
      return "";
  }
}

interface EditorTransactionStatusSelectProps {
  status: string;
  video: string;
  disabled?: boolean;
  onChange: (status: string) => void;
}

export function EditorTransactionStatusSelect({ status, video, disabled, onChange }: EditorTransactionStatusSelectProps) {
  return (
    <Select value={status} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        size="sm"
        aria-label={`Status of ${video}`}
        className={cn("w-26 font-medium dark:hover:bg-transparent", statusTone(status))}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {EDITOR_TRANSACTION_STATUS_OPTIONS.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
