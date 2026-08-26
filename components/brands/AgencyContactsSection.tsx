"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createContact, removeContact } from "@/app/brands/actions";
import type { Contact } from "@/repositories/contacts";

interface AgencyContactsSectionProps {
  agencyId: string;
  contacts: Contact[]; // pre-filtered to this agency
}

// Lets a creator add contacts (name + phone, for now) straight from the
// agency itself — previously the only way to create an agency-scoped
// contact was via a brand's Contacts tab.
export function AgencyContactsSection({ agencyId, contacts }: AgencyContactsSectionProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createContact({ name: name.trim(), phone: phone.trim(), brandId: null, agencyId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setName("");
      setPhone("");
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await removeContact(id);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-foreground">Contacts</p>

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="agency-contact-name" className="text-xs">
            Name
          </Label>
          <Input id="agency-contact-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor="agency-contact-phone" className="text-xs">
            Phone
          </Label>
          <Input
            id="agency-contact-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending || !name.trim()}>
          Add
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {contacts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No contacts yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-xs"
            >
              <span>
                {contact.name}
                {contact.phone && <span className="text-muted-foreground"> · {contact.phone}</span>}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                disabled={isPending}
                onClick={() => handleDelete(contact.id)}
                aria-label={`Remove ${contact.name}`}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
