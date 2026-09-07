"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewContentSheet } from "./NewContentSheet";
import type { EditorVideoOption } from "@/lib/contentPlan";

// The page header's add action, for when there is something to plan but no
// particular day in mind yet. Picking the day first is the other way in: see
// CalendarGrid, where any cell opens the same sheet already dated.
export function NewContentButton({ videoOptions = [] }: { videoOptions?: EditorVideoOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" />
        New content
      </Button>
      <NewContentSheet open={open} onOpenChange={setOpen} videoOptions={videoOptions} />
    </>
  );
}
