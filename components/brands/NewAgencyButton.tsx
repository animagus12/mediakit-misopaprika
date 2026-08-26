"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createAgency } from "@/app/brands/actions";
import { AgencyFormFields, agencyInitialForm } from "./AgencyFormFields";

export function NewAgencyButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(agencyInitialForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createAgency({
        name: form.name.trim(),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setForm(agencyInitialForm());
      setOpen(false);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-3.5" />
          Add agency
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Add agency</SheetTitle>
          <SheetDescription>
            Agencies can be reused across brands, so their contacts don&apos;t need re-entering per brand.
          </SheetDescription>
        </SheetHeader>

        <form id="new-agency-form" onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6">
          <AgencyFormFields idPrefix="new-agency" form={form} setForm={setForm} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" form="new-agency-form" className="flex-1" disabled={isPending || !form.name.trim()}>
            {isPending ? "Adding…" : "Add agency"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
