"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AgencyFormState {
  name: string;
}

export function agencyInitialForm(): AgencyFormState {
  return { name: "" };
}

interface AgencyFormFieldsProps {
  idPrefix: string;
  form: AgencyFormState;
  setForm: React.Dispatch<React.SetStateAction<AgencyFormState>>;
}

export function AgencyFormFields({ idPrefix, form, setForm }: AgencyFormFieldsProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-name`}>Agency name</Label>
      <Input
        id={`${idPrefix}-name`}
        required
        autoFocus
        value={form.name}
        onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
      />
    </div>
  );
}
