"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
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
import { updateBrand } from "@/app/brands/actions";
import { BrandFormFields, type BrandFormState } from "./BrandFormFields";
import type { Agency } from "@/repositories/agencies";
import type { Brand } from "@/repositories/brands";
import type { Contact } from "@/repositories/contacts";

function formFromBrand(brand: Brand): BrandFormState {
  return {
    name: brand.name,
    logoUrl: brand.logoUrl,
    website: brand.website,
    instagram: brand.instagram,
    agencyId: brand.agencyId,
    primaryContactId: brand.primaryContactId,
    status: brand.status,
  };
}

interface EditBrandButtonProps {
  brand: Brand;
  agencies: Agency[];
  contacts: Contact[];
}

export function EditBrandButton({ brand, agencies, contacts }: EditBrandButtonProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BrandFormState>(() => formFromBrand(brand));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formId = `edit-brand-${brand.id}`;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(formFromBrand(brand));
      setError(null);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateBrand({
        id: brand.id,
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
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Edit brand</SheetTitle>
        </SheetHeader>

        <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6">
          <BrandFormFields
            idPrefix={formId}
            brandId={brand.id}
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
          <Button type="submit" form={formId} className="flex-1" disabled={isPending || !form.name.trim()}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
