"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createBrand } from "@/app/brands/actions";
import { BrandFormFields, brandInitialForm } from "./BrandFormFields";
import type { Agency } from "@/repositories/agencies";
import type { Contact } from "@/repositories/contacts";

interface NewBrandButtonProps {
  agencies: Agency[];
  contacts: Contact[];
  // Defaults to the primary solid button: /brands' own "Add brand" CTA.
  // Dashboard QuickActions passes "outline" so New campaign stays the one
  // prominent action in that row.
  variant?: VariantProps<typeof buttonVariants>["variant"];
}

export function NewBrandButton({ agencies, contacts, variant = "default" }: NewBrandButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <NewBrandSheet
      open={open}
      onOpenChange={setOpen}
      agencies={agencies}
      contacts={contacts}
      trigger={
        <Button size="sm" variant={variant}>
          <Plus className="size-3.5" />
          Add brand
        </Button>
      }
    />
  );
}

interface NewBrandSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens it, when it has one. The shell's New menu opens it without. */
  trigger?: React.ReactElement;
  agencies: Agency[];
  contacts: Contact[];
}

// Controlled, so the page's own button and the shell's New menu open the one form.
export function NewBrandSheet({ open, onOpenChange, trigger, agencies, contacts }: NewBrandSheetProps) {
  const router = useRouter();
  const [form, setForm] = useState(brandInitialForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createBrand({
        name: form.name.trim(),
        logoUrl: form.logoUrl,
        website: form.website.trim(),
        instagram: form.instagram.trim(),
        agencyId: form.agencyId,
        primaryContactId: form.primaryContactId,
        status: form.status,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setForm(brandInitialForm());
      handleOpenChange(false);
      router.push(`/brands/${result.id}`);
    });
  }

  // Cleared on the way out: an opening from the New menu never passes through here.
  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Add brand</SheetTitle>
        </SheetHeader>

        <form id="new-brand-form" onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6">
          <BrandFormFields
            idPrefix="new-brand"
            form={form}
            setForm={setForm}
            agencies={agencies}
            contacts={contacts}
            onUploadError={setError}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" form="new-brand-form" className="flex-1" disabled={isPending || !form.name.trim()}>
            {isPending ? "Adding…" : "Add brand"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
