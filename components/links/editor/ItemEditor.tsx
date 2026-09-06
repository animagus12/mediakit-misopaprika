"use client";

import { ChevronDown, Eye, EyeOff, GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LINK_KIND_LABELS, LINK_VARIANT_LABELS } from "@/lib/links";
import {
  LINK_KINDS,
  LINK_VARIANTS,
  type LinkItem,
  type LinkKind,
  type LinkVariant,
} from "@/repositories/links";
import { StatTokenHint } from "./StatTokenHint";
import type { LinksEditorActions } from "./types";
import { useSortableRow } from "./SortableList";

interface ItemEditorProps {
  item: LinkItem;
  sectionId: string;
  actions: LinksEditorActions;
}

// <input type="datetime-local"> speaks local wall-clock time while the model
// stores UTC ISO strings, so both directions convert explicitly rather than
// slicing the ISO string (which would silently shift the time by the offset).
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function ItemEditor({ item, sectionId, actions }: ItemEditorProps) {
  const { ref, style, handleProps } = useSortableRow(item.id);
  const uploading = actions.uploadingSlot === item.id;
  const patch = (changes: Parameters<LinksEditorActions["updateItem"]>[2]) =>
    actions.updateItem(sectionId, item.id, changes);


  return (
    <Collapsible
      ref={ref}
      style={style}
      className={`rounded-md border ${item.enabled ? "" : "opacity-60"}`}
    >
      <div className="flex flex-wrap items-center gap-2 p-2">
        <span
          className="text-muted-foreground cursor-grab touch-none active:cursor-grabbing"
          title="Drag to reorder"
          {...handleProps}
        >
          <GripVertical size={16} />
        </span>

        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-label={`Edit ${item.label}`}
          >
            <ChevronDown size={14} className="shrink-0 transition-transform [[data-state=open]_&]:rotate-180" />
            <span className="truncate font-medium">{item.label || "Untitled"}</span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {LINK_KIND_LABELS[item.kind]} · {LINK_VARIANT_LABELS[item.variant]}
            </span>
          </button>
        </CollapsibleTrigger>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={item.enabled ? `Hide ${item.label}` : `Show ${item.label}`}
          title={item.enabled ? "Hide this link" : "Show this link"}
          onClick={() => patch({ enabled: !item.enabled })}
        >
          {item.enabled ? <Eye /> : <EyeOff />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete ${item.label}`}
          onClick={() => actions.removeItem(sectionId, item.id)}
        >
          <Trash2 />
        </Button>
      </div>

      <CollapsibleContent className="flex flex-col gap-3 border-t p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${item.id}-kind`}>Type</Label>
            <Select value={item.kind} onValueChange={(value) => patch({ kind: value as LinkKind })}>
              <SelectTrigger id={`${item.id}-kind`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {LINK_KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${item.id}-variant`}>Layout</Label>
            <Select
              value={item.variant}
              onValueChange={(value) => patch({ variant: value as LinkVariant })}
            >
              <SelectTrigger id={`${item.id}-variant`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_VARIANTS.map((variant) => (
                  <SelectItem key={variant} value={variant}>
                    {LINK_VARIANT_LABELS[variant]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${item.id}-label`}>Label</Label>
          <Input
            id={`${item.id}-label`}
            value={item.label}
            onChange={(event) => patch({ label: event.target.value })}
          />
          {item.kind === "social" && item.variant === "thumbnail" && !item.image ? (
            <p className="text-muted-foreground text-xs">
              With no image set, the label picks the icon — name it Instagram, YouTube, TikTok, X or
              Discord to get that mark.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${item.id}-sublabel`}>Sub-label</Label>
          <Input
            id={`${item.id}-sublabel`}
            placeholder="misopaprika · 6.5K followers"
            value={item.sublabel}
            onChange={(event) => patch({ sublabel: event.target.value })}
          />
          <StatTokenHint />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${item.id}-url`}>Link</Label>
            <Input
              id={`${item.id}-url`}
              placeholder="https://… or mailto:…"
              value={item.url}
              onChange={(event) => patch({ url: event.target.value })}
            />
            <p className="text-muted-foreground text-xs">
              Leave empty for a card that isn’t clickable — useful for a code with no shop link.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${item.id}-badge`}>Badge</Label>
            <Input
              id={`${item.id}-badge`}
              placeholder="NEW"
              value={item.badge}
              onChange={(event) => patch({ badge: event.target.value })}
            />
          </div>
        </div>

        {item.kind === "code" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${item.id}-code`}>Creator code</Label>
            <Input
              id={`${item.id}-code`}
              placeholder="PAPRIKA10"
              value={item.code}
              onChange={(event) => patch({ code: event.target.value })}
            />
            <p className="text-muted-foreground text-xs">
              Shown as a tap-to-copy button. Leave empty and the card renders without one.
            </p>
          </div>
        ) : null}

        {item.variant === "row" ? null : (
          <div className="flex flex-col gap-2">
            <Label>Image</Label>
            <div className="flex items-center gap-3">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  className={
                    item.variant === "banner"
                      ? "bg-muted h-16 w-28 rounded-md object-cover"
                      : "bg-muted size-12 rounded-full object-cover"
                  }
                />
              ) : (
                <div
                  className={
                    item.variant === "banner"
                      ? "bg-muted h-16 w-28 rounded-md"
                      : "bg-muted size-12 rounded-full"
                  }
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => actions.openPicker({ kind: "image", sectionId, itemId: item.id })}
              >
                {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                {item.image ? "Replace" : "Upload"}
              </Button>
              {item.image ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => patch({ image: "" })}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">
              {item.image
                ? "The same image is kept when you switch layout — it's cropped round for Small image and shown full width for Banner."
                : "Without an image, Banner falls back to the text-only layout rather than rendering an empty frame."}
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${item.id}-starts`}>Show from</Label>
            <Input
              id={`${item.id}-starts`}
              type="datetime-local"
              value={toLocalInput(item.startsAt)}
              onChange={(event) => patch({ startsAt: fromLocalInput(event.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${item.id}-ends`}>Hide after</Label>
            <Input
              id={`${item.id}-ends`}
              type="datetime-local"
              value={toLocalInput(item.endsAt)}
              onChange={(event) => patch({ endsAt: fromLocalInput(event.target.value) })}
            />
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Optional. Leave both empty to always show. Times are your local time.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
