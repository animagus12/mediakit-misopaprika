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
import { DEFAULT_EDITOR_NAME, EDITOR_TRANSACTION_STATUS_OPTIONS } from "@/lib/editorTransactions";
import type { Editor } from "@/repositories/editors";

export interface EditorTransactionFormState {
  video: string;
  videoDate: string;
  deliveryDate: string;
  amount: string;
  editor: string;
  status: string;
}

export function editorTransactionInitialForm(editors: Editor[] = []): EditorTransactionFormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    video: "",
    videoDate: today,
    deliveryDate: today,
    amount: "",
    editor: editors.find((e) => e.name === DEFAULT_EDITOR_NAME)?.name ?? editors[0]?.name ?? "",
    status: EDITOR_TRANSACTION_STATUS_OPTIONS[0],
  };
}

interface EditorTransactionFormFieldsProps {
  idPrefix: string;
  form: EditorTransactionFormState;
  setForm: React.Dispatch<React.SetStateAction<EditorTransactionFormState>>;
  editors: Editor[];
}

export function EditorTransactionFormFields({ idPrefix, form, setForm, editors }: EditorTransactionFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-video`}>Video</Label>
        <Input
          id={`${idPrefix}-video`}
          required
          autoFocus
          value={form.video}
          onChange={(event) => setForm((f) => ({ ...f, video: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-editor`}>Editor</Label>
        {editors.length === 0 ? (
          <p className="text-xs text-muted-foreground">No editors yet — add one first.</p>
        ) : (
          <Select value={form.editor} onValueChange={(value) => setForm((f) => ({ ...f, editor: value }))}>
            <SelectTrigger id={`${idPrefix}-editor`} className="w-full">
              <SelectValue placeholder="Select editor" />
            </SelectTrigger>
            <SelectContent>
              {editors.map((editor) => (
                <SelectItem key={editor.id} value={editor.name}>
                  {editor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-videoDate`}>Assigned date</Label>
          <Input
            id={`${idPrefix}-videoDate`}
            type="date"
            required
            value={form.videoDate}
            onChange={(event) => setForm((f) => ({ ...f, videoDate: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-deliveryDate`}>Date delivered</Label>
          <Input
            id={`${idPrefix}-deliveryDate`}
            type="date"
            required
            value={form.deliveryDate}
            onChange={(event) => setForm((f) => ({ ...f, deliveryDate: event.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-amount`}>Amount (₹)</Label>
          <Input
            id={`${idPrefix}-amount`}
            type="number"
            min={0}
            placeholder="0"
            value={form.amount}
            onChange={(event) => setForm((f) => ({ ...f, amount: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-status`}>Status</Label>
          <Select value={form.status} onValueChange={(value) => setForm((f) => ({ ...f, status: value }))}>
            <SelectTrigger id={`${idPrefix}-status`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDITOR_TRANSACTION_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );
}
