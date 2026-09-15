"use client";

import { Minus, Plus } from "lucide-react";
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
import {
  applyRevisionChange,
  DEFAULT_EDITOR_NAME,
  DEFAULT_EDITOR_TRANSACTION_AMOUNT,
  DEFAULT_EDITOR_TRANSACTION_STATUS,
  EDITOR_TRANSACTION_STATUS_OPTIONS,
} from "@/lib/editorTransactions";
import { formatMoney } from "@/lib/invoice";
import type { NewEditorTransaction } from "@/repositories/editorTransactions";
import type { Editor } from "@/repositories/editors";

export interface EditorTransactionFormState {
  video: string;
  videoDate: string;
  deliveryDate: string;
  amount: string;
  editor: string;
  status: string;
  revisions: number;
  revisionRate: number | null;
}

export function editorTransactionInitialForm(editors: Editor[] = []): EditorTransactionFormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    video: "",
    videoDate: today,
    deliveryDate: "",
    amount: String(DEFAULT_EDITOR_TRANSACTION_AMOUNT),
    editor: editors.find((e) => e.name === DEFAULT_EDITOR_NAME)?.name ?? editors[0]?.name ?? "",
    status: DEFAULT_EDITOR_TRANSACTION_STATUS,
    revisions: 0,
    revisionRate: null,
  };
}

// What both the create and the edit sheet send.
export function editorTransactionInputFromForm(form: EditorTransactionFormState): NewEditorTransaction {
  return {
    video: form.video.trim(),
    videoDate: form.videoDate,
    deliveryDate: form.deliveryDate,
    amount: form.amount === "" ? null : Number(form.amount),
    editor: form.editor.trim(),
    status: form.status,
    revisions: form.revisions,
    revisionRate: form.revisionRate,
  };
}

interface EditorTransactionFormFieldsProps {
  idPrefix: string;
  form: EditorTransactionFormState;
  setForm: React.Dispatch<React.SetStateAction<EditorTransactionFormState>>;
  editors: Editor[];
}

export function EditorTransactionFormFields({ idPrefix, form, setForm, editors }: EditorTransactionFormFieldsProps) {
  const editorRate = editors.find((e) => e.name === form.editor)?.revisionRate ?? 0;
  // The rate the next step will charge: pinned once a revision is on the
  // transaction, the selected editor's own rate before that.
  const stepRate = form.revisions > 0 && form.revisionRate != null ? form.revisionRate : editorRate;

  function stepRevisions(delta: 1 | -1) {
    setForm((f) => {
      const next = applyRevisionChange(
        { amount: f.amount === "" ? null : Number(f.amount), revisions: f.revisions, revisionRate: f.revisionRate },
        delta,
        editorRate
      );
      return {
        ...f,
        amount: next.amount == null ? "" : String(next.amount),
        revisions: next.revisions,
        revisionRate: next.revisionRate,
      };
    });
  }

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
          <p className="text-xs text-muted-foreground">No editors yet. Add one first.</p>
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
            min={form.videoDate}
            value={form.deliveryDate}
            onChange={(event) => setForm((f) => ({ ...f, deliveryDate: event.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label id={`${idPrefix}-revisions-label`}>Revisions</Label>
        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-labelledby={`${idPrefix}-revisions-label`}
            className="flex items-center rounded-md border border-input"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => stepRevisions(-1)}
              disabled={form.revisions === 0}
              aria-label="Remove a revision"
            >
              <Minus />
            </Button>
            <output aria-live="polite" className="min-w-8 text-center text-xs font-medium tabular-nums">
              {form.revisions}
            </output>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => stepRevisions(1)}
              aria-label="Add a revision"
            >
              <Plus />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {stepRate > 0
              ? `${formatMoney(stepRate)} each, added to the amount`
              : `No revision rate set for ${form.editor || "this editor"}`}
          </p>
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
