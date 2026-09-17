"use client";

import { CountStepper } from "@/components/common/CountStepper";
import { OptionToggle } from "@/components/common/OptionToggle";
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
  /**
   * "create" leaves out what a job only learns once it comes back: when it was
   * delivered, how many revisions it took and whether it has been paid for.
   * "edit" asks for everything, since any of it can be the thing being logged.
   */
  mode?: "create" | "edit";
  form: EditorTransactionFormState;
  setForm: React.Dispatch<React.SetStateAction<EditorTransactionFormState>>;
  editors: Editor[];
}

export function EditorTransactionFormFields({
  idPrefix,
  mode = "edit",
  form,
  setForm,
  editors,
}: EditorTransactionFormFieldsProps) {
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
      {/* What the job is and who has it: the two things true the moment a
          video is handed over. */}
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

      <div className="grid grid-cols-2 gap-3">
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
      </div>

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

      {/* A job just handed over hasn't come back, been revised or been paid
          for, so the create sheet doesn't ask: it is delivered on no date,
          at no revisions, and Pending (see editorTransactionInitialForm).
          The edit sheet is where all three are answered. */}
      {mode === "edit" && (
        <>
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-2">
              <Label id={`${idPrefix}-status-label`}>Status</Label>
              <OptionToggle
                value={form.status}
                onChange={(status) => setForm((f) => ({ ...f, status }))}
                options={EDITOR_TRANSACTION_STATUS_OPTIONS}
                labelledBy={`${idPrefix}-status-label`}
                columns={3}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label id={`${idPrefix}-revisions-label`}>Revisions</Label>
            <div className="flex items-center gap-3">
              <CountStepper
                value={form.revisions}
                onStep={stepRevisions}
                labelledBy={`${idPrefix}-revisions-label`}
                decrementLabel="Remove a revision"
                incrementLabel="Add a revision"
              />
              <p className="text-[11px] text-muted-foreground">
                {stepRate > 0
                  ? `${formatMoney(stepRate)} each, added to the amount`
                  : `No revision rate set for ${form.editor || "this editor"}`}
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
