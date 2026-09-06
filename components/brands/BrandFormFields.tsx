"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BRAND_STATUS_OPTIONS } from "@/lib/brands";
import { contactsForBrand } from "@/lib/contacts";
import type { Agency } from "@/repositories/agencies";
import type { BrandStatus } from "@/repositories/brands";
import type { Contact } from "@/repositories/contacts";
import { BrandLogoUploadField } from "./BrandLogoUploadField";

export interface BrandFormState {
  name: string;
  logoUrl: string | null;
  website: string;
  instagram: string;
  agencyId: string | null;
  primaryContactId: string | null;
  status: BrandStatus;
}

export function brandInitialForm(): BrandFormState {
  return {
    name: "",
    logoUrl: null,
    website: "",
    instagram: "",
    agencyId: null,
    primaryContactId: null,
    status: "Lead",
  };
}

const NO_AGENCY = "__none__";

interface BrandFormFieldsProps {
  idPrefix: string;
  brandId?: string; // omitted for a not-yet-created brand, limits the contact picker to the selected agency's contacts
  form: BrandFormState;
  setForm: React.Dispatch<React.SetStateAction<BrandFormState>>;
  agencies: Agency[];
  contacts: Contact[];
  onUploadError: (message: string) => void;
}

export function BrandFormFields({
  idPrefix,
  brandId,
  form,
  setForm,
  agencies,
  contacts,
  onUploadError,
}: BrandFormFieldsProps) {
  // Same contact set the brands table would show for this brand (own direct
  // contacts + the selected agency's): lets a creator pick which one to
  // surface there when more than one applies.
  const eligibleContacts = contactsForBrand(
    { id: brandId ?? "", agencyId: form.agencyId },
    contacts
  );

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Brand name</Label>
        <Input
          id={`${idPrefix}-name`}
          required
          autoFocus
          value={form.name}
          onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
        />
      </div>

      <BrandLogoUploadField
        value={form.logoUrl}
        onChange={(logoUrl) => setForm((f) => ({ ...f, logoUrl }))}
        onError={onUploadError}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-status`}>Status</Label>
          <Select
            value={form.status}
            onValueChange={(value) => setForm((f) => ({ ...f, status: value as BrandStatus }))}
          >
            <SelectTrigger id={`${idPrefix}-status`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BRAND_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-agency`}>Agency</Label>
          <Select
            value={form.agencyId ?? NO_AGENCY}
            onValueChange={(value) =>
              setForm((f) => ({
                ...f,
                agencyId: value === NO_AGENCY ? null : value,
                primaryContactId: null,
              }))
            }
          >
            <SelectTrigger id={`${idPrefix}-agency`} className="w-full">
              <SelectValue placeholder="No agency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_AGENCY}>No agency (direct)</SelectItem>
              {agencies.map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {eligibleContacts.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-primary-contact`}>Contact shown on table</Label>
          <Select
            value={form.primaryContactId ?? eligibleContacts[0].id}
            onValueChange={(value) => setForm((f) => ({ ...f, primaryContactId: value }))}
          >
            <SelectTrigger id={`${idPrefix}-primary-contact`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eligibleContacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.name}
                  {contact.phone ? ` · ${contact.phone}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-website`}>Website</Label>
        <Input
          id={`${idPrefix}-website`}
          type="url"
          placeholder="https://"
          value={form.website}
          onChange={(event) => setForm((f) => ({ ...f, website: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-instagram`}>Instagram</Label>
        <Input
          id={`${idPrefix}-instagram`}
          value={form.instagram}
          onChange={(event) => setForm((f) => ({ ...f, instagram: event.target.value }))}
        />
      </div>

    </>
  );
}
