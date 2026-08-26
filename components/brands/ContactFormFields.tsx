"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ContactScope = "brand" | "agency";

export interface ContactFormState {
  name: string;
  phone: string;
  scope: ContactScope;
}

export function contactInitialForm(): ContactFormState {
  return {
    name: "",
    phone: "",
    scope: "brand",
  };
}

interface ContactFormFieldsProps {
  idPrefix: string;
  form: ContactFormState;
  setForm: React.Dispatch<React.SetStateAction<ContactFormState>>;
  agencyName: string | null;
}

export function ContactFormFields({ idPrefix, form, setForm, agencyName }: ContactFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          required
          autoFocus
          value={form.name}
          onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-phone`}>Phone</Label>
        <Input
          id={`${idPrefix}-phone`}
          type="tel"
          value={form.phone}
          onChange={(event) => setForm((f) => ({ ...f, phone: event.target.value }))}
        />
      </div>

      {agencyName && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-scope`}
            checked={form.scope === "agency"}
            onCheckedChange={(checked) => setForm((f) => ({ ...f, scope: checked === true ? "agency" : "brand" }))}
          />
          <Label htmlFor={`${idPrefix}-scope`} className="font-normal">
            Agency contact — also shows on {agencyName}&apos;s other brands
          </Label>
        </div>
      )}
    </>
  );
}
