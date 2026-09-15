"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditorQrUploadField } from "./EditorQrUploadField";

export interface EditorFormState {
  name: string;
  phone: string;
  email: string;
  upi: string;
  qrImage: string | null;
  revisionRate: string;
}

export function editorInitialForm(): EditorFormState {
  return { name: "", phone: "", email: "", upi: "", qrImage: null, revisionRate: "" };
}

interface EditorFormFieldsProps {
  idPrefix: string;
  form: EditorFormState;
  setForm: React.Dispatch<React.SetStateAction<EditorFormState>>;
  onUploadError: (message: string) => void;
}

export function EditorFormFields({ idPrefix, form, setForm, onUploadError }: EditorFormFieldsProps) {
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
        <Label htmlFor={`${idPrefix}-revisionRate`}>Revision rate (₹)</Label>
        <Input
          id={`${idPrefix}-revisionRate`}
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="0"
          aria-describedby={`${idPrefix}-revisionRate-hint`}
          value={form.revisionRate}
          onChange={(event) => setForm((f) => ({ ...f, revisionRate: event.target.value }))}
        />
        <p id={`${idPrefix}-revisionRate-hint`} className="text-[11px] text-muted-foreground">
          Added to a video&apos;s amount for each revision.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-phone`}>Phone number</Label>
        <Input
          id={`${idPrefix}-phone`}
          type="tel"
          value={form.phone}
          onChange={(event) => setForm((f) => ({ ...f, phone: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={form.email}
          onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-upi`}>UPI ID</Label>
        <Input
          id={`${idPrefix}-upi`}
          placeholder="name@bank"
          value={form.upi}
          onChange={(event) => setForm((f) => ({ ...f, upi: event.target.value }))}
        />
      </div>

      <EditorQrUploadField
        value={form.qrImage}
        onChange={(qrImage) => setForm((f) => ({ ...f, qrImage }))}
        onError={onUploadError}
      />
    </>
  );
}
