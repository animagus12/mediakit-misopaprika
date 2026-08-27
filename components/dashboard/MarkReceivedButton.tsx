import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// Presentational only — the optimistic hide, sheet write, toast and Undo all
// live in the parent card via useMarkReceived().
export function MarkReceivedButton({
  onClick,
  pending,
}: {
  onClick: () => void;
  pending?: boolean;
}) {
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onClick}>
      <Check />
      {pending ? "Saving…" : "Mark received"}
    </Button>
  );
}
