"use client";

import { useState, useTransition } from "react";
import { Import } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importBrandsFromCampaigns } from "@/app/brands/actions";

export function ImportBrandsButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleImport() {
    setMessage(null);
    startTransition(async () => {
      const result = await importBrandsFromCampaigns();
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      setMessage(
        result.imported === 0
          ? `No new brands: all ${result.skipped} already tracked.`
          : `Imported ${result.imported} new brand${result.imported === 1 ? "" : "s"}${result.skipped > 0 ? ` (${result.skipped} already tracked)` : ""}.`
      );
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={handleImport} disabled={isPending}>
        <Import className="size-3.5" />
        {isPending ? "Importing…" : "Import from campaigns"}
      </Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
