"use client";

import { useRouter } from "next/navigation";
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
import { createBrand } from "@/app/brands/actions";
import { BrandFormFields, brandInitialForm } from "./BrandFormFields";
import type { Agency } from "@/repositories/agencies";

interface NewBrandButtonProps {
  agencies: Agency[];
}

export function NewBrandButton({ agencies }: NewBrandButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
        status: form.status,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setForm(brandInitialForm());
      setOpen(false);
      router.push(`/brands/${result.id}`);
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
        <Button size="sm">
          <Plus className="size-3.5" />
          Add brand
        </Button>
      </SheetTrigger>
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
