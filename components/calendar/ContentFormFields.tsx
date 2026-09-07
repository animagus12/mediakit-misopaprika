"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTENT_FORMATS,
  CONTENT_STATUSES,
  type ContentFormValues,
  type EditorVideoOption,
} from "@/lib/contentPlan";
import type { ContentFormat, ContentStatus } from "@/repositories/contentPlan";

// A <Select> cannot carry "" as an item value, so the "not one of these"
// choice needs a sentinel: same shape as CampaignFormFields' NO_BRAND_LINK.
const NO_VIDEO = "__none__";

export function contentInitialForm(postDate = ""): ContentFormValues {
  return {
    title: "",
    editorTransactionId: null,
    format: "Reel",
    // A new entry starts where the work starts. Nothing else in the pipeline
    // is a sensible default: claiming "Ready" for a reel that has not been
    // thought of yet would be the one status that suppresses its own warning.
    status: "Idea",
    postDate,
    notes: "",
  };
}

interface ContentFormFieldsProps {
  idPrefix: string;
  form: ContentFormValues;
  setForm: React.Dispatch<React.SetStateAction<ContentFormValues>>;
  /** Videos already sent to an editor, for the picker. Empty hides it. */
  videoOptions?: EditorVideoOption[];
}

// Shared by NewContentButton (create) and EditContentSheet (edit) so the two
// flows can't drift apart on field order or options: the same split
// CampaignFormFields draws. idPrefix keeps <label htmlFor> ids unique, since
// several of these can be mounted at once, one per row, even while closed.
export function ContentFormFields({
  idPrefix,
  form,
  setForm,
  videoOptions = [],
}: ContentFormFieldsProps) {
  const linked = form.editorTransactionId
    ? videoOptions.find((option) => option.id === form.editorTransactionId)
    : undefined;

  return (
    <>
      {videoOptions.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-video`}>From your editors</Label>
          <Select
            value={form.editorTransactionId ?? NO_VIDEO}
            onValueChange={(value) => {
              if (value === NO_VIDEO) {
                // Unlinking leaves the title alone: it has been typed by now,
                // and silently blanking it would lose work.
                setForm((f) => ({ ...f, editorTransactionId: null }));
                return;
              }
              const option = videoOptions.find((o) => o.id === value);
              setForm((f) => ({
                ...f,
                editorTransactionId: value,
                // The video's name becomes the title, and stays editable: the
                // point of the picker is not retyping what the editor was
                // already given.
                title: option?.video ?? f.title,
              }));
            }}
          >
            <SelectTrigger id={`${idPrefix}-video`} className="w-full">
              <SelectValue placeholder="Not from an editor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_VIDEO}>Not from an editor</SelectItem>
              {videoOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.video}
                  <span className="text-muted-foreground">
                    {" "}
                    {option.editor}
                    {option.planned ? " · already planned" : ""}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* A link whose job has since been deleted would otherwise show as
              the empty placeholder, reading as "not linked" when it is. */}
          {form.editorTransactionId && !linked && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              The editing job behind this is gone. Pick another, or set it to not from an editor.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          autoFocus
          placeholder="Katana unboxing"
          value={form.title}
          onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-format`}>Format</Label>
          <Select
            value={form.format}
            onValueChange={(value) => setForm((f) => ({ ...f, format: value as ContentFormat }))}
          >
            <SelectTrigger id={`${idPrefix}-format`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_FORMATS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-status`}>Status</Label>
          <Select
            value={form.status}
            onValueChange={(value) => setForm((f) => ({ ...f, status: value as ContentStatus }))}
          >
            <SelectTrigger id={`${idPrefix}-status`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_STATUSES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-postDate`}>Posting date</Label>
        <Input
          id={`${idPrefix}-postDate`}
          type="date"
          value={form.postDate}
          onChange={(event) => setForm((f) => ({ ...f, postDate: event.target.value }))}
        />
        <p className="text-[11px] text-muted-foreground">
          Leave empty to keep it in the ideas list until you pick a day.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          placeholder="Hook, shot list, audio…"
          value={form.notes}
          onChange={(event) => setForm((f) => ({ ...f, notes: event.target.value }))}
        />
      </div>
    </>
  );
}
