"use client";

import { useState, useTransition } from "react";
import { Phone, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { removeContact, updateContact } from "@/app/brands/actions";
import { ContactFormFields, type ContactFormState } from "./ContactFormFields";
import type { Contact } from "@/repositories/contacts";

function formFromContact(contact: Contact): ContactFormState {
  return {
    name: contact.name,
    phone: contact.phone,
    scope: contact.agencyId ? "agency" : "brand",
  };
}

interface ContactCardProps {
  contact: Contact;
  brandId: string;
  agencyId: string | null;
  agencyName: string | null;
}

export function ContactCard({ contact, brandId, agencyId, agencyName }: ContactCardProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ContactFormState>(() => formFromContact(contact));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formId = `edit-contact-${contact.id}`;
  const isAgencyContact = Boolean(contact.agencyId);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(formFromContact(contact));
      setError(null);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateContact({
        id: contact.id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        brandId: form.scope === "brand" ? brandId : null,
        agencyId: form.scope === "agency" ? agencyId : null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  function handleDelete(event: React.MouseEvent) {
    event.stopPropagation();
    if (!window.confirm(`Remove ${contact.name} from contacts?`)) return;
    startTransition(async () => {
      await removeContact(contact.id);
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {/* A <div> here, not a <button>: the delete button below is a real
          nested <button>, and <button> can't contain <button> in valid HTML
          (React 19 warns and fails to hydrate it). */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleOpenChange(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleOpenChange(true);
          }
        }}
        className="block w-full cursor-pointer text-left"
      >
        <Card size="sm" className="transition hover:ring-2 hover:ring-primary/20">
          <CardContent className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <span className="truncate font-heading text-sm font-medium">{contact.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                disabled={isPending}
                onClick={handleDelete}
                aria-label={`Remove ${contact.name}`}
              >
                <Trash2 />
              </Button>
            </div>

            {contact.phone && (
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Phone className="size-3 shrink-0" />
                {contact.phone}
              </p>
            )}

            {isAgencyContact && agencyName && (
              <Badge variant="outline" className="mt-1">
                Agency: {agencyName}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Edit contact</SheetTitle>
        </SheetHeader>

        <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6">
          <ContactFormFields idPrefix={formId} form={form} setForm={setForm} agencyName={agencyName} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

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
