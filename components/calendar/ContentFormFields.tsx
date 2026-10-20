"use client";

import { Unlink } from "lucide-react";
import { OptionToggle } from "@/components/common/OptionToggle";
import { Button } from "@/components/ui/button";
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
import type { ContentStatus } from "@/repositories/contentPlan";

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
  const linkedVideoIsClaimed = Boolean(form.editorTransactionId && linked?.linked);
  const linkedVideoIsMissing = Boolean(form.editorTransactionId && !linked);
  const availableVideoOptions = videoOptions.filter((option) => !option.linked);

  return (
    <>
      {/* The title first, because it is the thing: everything under it says
          when and in what shape. */}
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

      {(videoOptions.length > 0 || form.editorTransactionId) && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-video`}>From your editors</Label>
          <Select
            value={
              form.editorTransactionId && linked && !linked.linked
                ? form.editorTransactionId
                : NO_VIDEO
            }
            onValueChange={(value) => {
              if (value === NO_VIDEO) {
                if (!linkedVideoIsClaimed) {
                  setForm((f) => ({ ...f, editorTransactionId: null }));
                }
                return;
              }
              const option = availableVideoOptions.find((o) => o.id === value);
              setForm((f) => ({
                ...f,
                editorTransactionId: value,
                // The video's name fills the title, so what the editor was
                // given isn't typed twice. A title already typed is left
                // alone, since the picker now sits under it and overwriting
                // would take back what was just written.
                title: f.title.trim() === "" ? option?.video ?? f.title : f.title,
              }));
            }}
          >
            <SelectTrigger id={`${idPrefix}-video`} className="w-full">
              <SelectValue placeholder="Not from an editor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_VIDEO} disabled={linkedVideoIsClaimed}>
                {linkedVideoIsClaimed || linkedVideoIsMissing
                  ? "Choose another video"
                  : "Not from an editor"}
              </SelectItem>
              {availableVideoOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.video}
                  <span className="text-muted-foreground">
                    {" "}
                    {option.editor}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.editorTransactionId && (
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[11px] text-muted-foreground">
                {linked
                  ? `Linked: ${linked.video} · ${linked.editor}`
                  : "This video link is no longer available."}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => setForm((f) => ({ ...f, editorTransactionId: null }))}
              >
                <Unlink />
                Unlink
              </Button>
            </div>
          )}
          {/* A link whose job has since been deleted would otherwise show as
              the empty placeholder, reading as "not linked" when it is. */}
          {linkedVideoIsMissing && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              The editing job behind this is gone. Unlink it or choose another video.
            </p>
          )}
        </div>
      )}

      {/* Buttons rather than a menu: there are four, and which one it is
          decides what the post is, so all four are worth seeing. */}
      <div className="space-y-2">
        <Label id={`${idPrefix}-format-label`}>Format</Label>
        <OptionToggle
          value={form.format}
          onChange={(format) => setForm((f) => ({ ...f, format }))}
          options={CONTENT_FORMATS}
          labelledBy={`${idPrefix}-format-label`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-postDate`}>Posting date</Label>
          <Input
            id={`${idPrefix}-postDate`}
            type="date"
            value={form.postDate}
            onChange={(event) => setForm((f) => ({ ...f, postDate: event.target.value }))}
          />
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
      <p className="text-[11px] text-muted-foreground">
        No posting date keeps it in the ideas list until you pick a day.
      </p>

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
