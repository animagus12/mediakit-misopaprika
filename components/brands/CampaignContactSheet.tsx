"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { assignCampaignContact, createContact } from "@/app/brands/actions";
import type { Contact } from "@/repositories/contacts";

const UNASSIGNED = "__unassigned__";

interface CampaignContactSheetProps {
  campaignId: string;
  campaignName: string;
  brandId: string;
  contactId: string | null;
  contacts: Contact[]; // this brand's contacts (direct + its agency's)
}

// Trigger shows the current assignment as plain text — the Edit button opens
// a Sheet to either reassign to an existing contact or add a brand-new one
// (discovered specifically through this campaign) and assign it in one step.
export function CampaignContactSheet({ campaignId, campaignName, brandId, contactId, contacts }: CampaignContactSheetProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(contactId ?? UNASSIGNED);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentContact = contacts.find((contact) => contact.id === contactId) ?? null;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSelected(contactId ?? UNASSIGNED);
      setNewName("");
      setNewPhone("");
      setError(null);
    }
  }

  function handleSelectChange(value: string) {
    setSelected(value);
    setError(null);
    startTransition(async () => {
      const result = await assignCampaignContact(campaignId, brandId, value === UNASSIGNED ? null : value);
      if (!result.success) setError(result.error);
    });
  }

  function handleAddAndAssign(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    startTransition(async () => {
      const created = await createContact({
        name: newName.trim(),
        phone: newPhone.trim(),
        brandId,
        agencyId: null,
      });
      if (!created.success) {
        setError(created.error);
        return;
      }
      const assigned = await assignCampaignContact(campaignId, brandId, created.id);
      if (!assigned.success) {
        setError(assigned.error);
        return;
      }
      setSelected(created.id);
      setNewName("");
      setNewPhone("");
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <div className="flex items-center gap-1">
        <span className={cn("truncate", !currentContact && "text-muted-foreground")}>
          {currentContact?.name ?? "Unassigned"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => handleOpenChange(true)}
          aria-label={`Edit contact for ${campaignName || "this campaign"}`}
        >
          <Pencil className="size-3" />
        </Button>
      </div>

      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>{campaignName || "Campaign"} contact</SheetTitle>
          <SheetDescription>Assign who handled this specific campaign, or add someone new.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6">
          <div className="space-y-2">
            <Label>Contact</Label>
            {contacts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No contacts yet — add one below.</p>
            ) : (
              <Select value={selected} onValueChange={handleSelectChange} disabled={isPending}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          <form onSubmit={handleAddAndAssign} className="space-y-2">
            <Label>Add a new contact</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
              <Input
                type="tel"
                placeholder="Phone"
                value={newPhone}
                onChange={(event) => setNewPhone(event.target.value)}
              />
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={isPending || !newName.trim()}>
              <Plus className="size-3.5" />
              Add & assign
            </Button>
          </form>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <SheetFooter>
          <SheetClose asChild>
            <Button type="button" variant="outline" className="w-full">
              Close
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
