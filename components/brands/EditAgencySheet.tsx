"use client";

import { useState, useTransition } from "react";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { updateAgency } from "@/app/brands/actions";
import { AgencyContactsSection } from "./AgencyContactsSection";
import { AgencyFormFields, type AgencyFormState } from "./AgencyFormFields";
import type { Agency } from "@/repositories/agencies";
import type { Contact } from "@/repositories/contacts";

function formFromAgency(agency: Agency): AgencyFormState {
  return { name: agency.name };
}

interface EditAgencySheetProps {
  agency: Agency;
  brandCount: number;
  contacts: Contact[]; // pre-filtered to this agency
}

export function EditAgencySheet({ agency, brandCount, contacts }: EditAgencySheetProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AgencyFormState>(() => formFromAgency(agency));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formId = `edit-agency-${agency.id}`;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(formFromAgency(agency));
      setError(null);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateAgency({
        id: agency.id,
        name: form.name.trim(),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => handleOpenChange(true)}
            className={cn(
              badgeVariants({ variant: "secondary" }),
              "h-6 cursor-pointer px-2.5 text-xs transition hover:bg-secondary/70"
            )}
          >
            {agency.name}
          </button>
        </TooltipTrigger>
        <TooltipContent className="flex-col items-start gap-1 p-3">
          <p className="font-medium">{brandCount} {brandCount === 1 ? "brand" : "brands"}</p>
          <p>{contacts.length} {contacts.length === 1 ? "contact" : "contacts"}</p>
        </TooltipContent>
      </Tooltip>

      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Edit agency</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6">
          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <AgencyFormFields idPrefix={formId} form={form} setForm={setForm} />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </form>

          <Separator />

          <AgencyContactsSection agencyId={agency.id} contacts={contacts} />
        </div>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Close
            </Button>
          </SheetClose>
          <Button type="submit" form={formId} className="flex-1" disabled={isPending || !form.name.trim()}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
