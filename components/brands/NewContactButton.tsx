"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createContact } from "@/app/brands/actions";
import { ContactFormFields, contactInitialForm } from "./ContactFormFields";

interface NewContactButtonProps {
  brandId: string;
  agencyId: string | null;
  agencyName: string | null;
}

export function NewContactButton({ brandId, agencyId, agencyName }: NewContactButtonProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(contactInitialForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createContact({
        name: form.name.trim(),
        phone: form.phone.trim(),
        brandId: form.scope === "brand" ? brandId : null,
        agencyId: form.scope === "agency" ? agencyId : null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setForm(contactInitialForm());
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
          Add contact
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Add contact</SheetTitle>
        </SheetHeader>

        <form id="new-contact-form" onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6">
          <ContactFormFields idPrefix="new-contact" form={form} setForm={setForm} agencyName={agencyName} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" form="new-contact-form" className="flex-1" disabled={isPending || !form.name.trim()}>
            {isPending ? "Adding…" : "Add contact"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
