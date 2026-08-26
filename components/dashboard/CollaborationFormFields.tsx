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
import {
  COLLABORATION_TYPES,
  REEL_OPTIONS,
  STORY_OPTIONS,
  STATUS_OPTIONS,
  type CollaborationType,
} from "@/lib/collaborations";

export interface CollaborationFormState {
  brand: string;
  campaign: string;
  type: CollaborationType;
  reels: string;
  story: string;
  status: string;
  amount: string;
  barterValue: string;
  date: string;
}

export function collaborationInitialForm(): CollaborationFormState {
  return {
    brand: "",
    campaign: "",
    type: "Barter",
    reels: REEL_OPTIONS[0],
    story: STORY_OPTIONS[0],
    status: "Brainstorming",
    amount: "",
    barterValue: "",
    date: new Date().toISOString().slice(0, 10),
  };
}

interface CollaborationFormFieldsProps {
  idPrefix: string;
  form: CollaborationFormState;
  setForm: React.Dispatch<React.SetStateAction<CollaborationFormState>>;
}

// Shared by NewCollaborationButton (create) and EditCollaborationSheet (edit)
// so the two flows can't drift apart on field order/options. idPrefix keeps
// <label htmlFor> ids unique since several of these can be mounted in the DOM
// at once (one per collaboration card), even while closed.
export function CollaborationFormFields({ idPrefix, form, setForm }: CollaborationFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-brand`}>Brand</Label>
        <Input
          id={`${idPrefix}-brand`}
          required
          autoFocus
          value={form.brand}
          onChange={(event) => setForm((f) => ({ ...f, brand: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-campaign`}>Campaign</Label>
        <Input
          id={`${idPrefix}-campaign`}
          value={form.campaign}
          onChange={(event) => setForm((f) => ({ ...f, campaign: event.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-reels`}>Reels</Label>
          <Select value={form.reels} onValueChange={(value) => setForm((f) => ({ ...f, reels: value }))}>
            <SelectTrigger id={`${idPrefix}-reels`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REEL_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-story`}>Story</Label>
          <Select value={form.story} onValueChange={(value) => setForm((f) => ({ ...f, story: value }))}>
            <SelectTrigger id={`${idPrefix}-story`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STORY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-type`}>Type</Label>
        <Select
          value={form.type}
          onValueChange={(value) => setForm((f) => ({ ...f, type: value as CollaborationType }))}
        >
          <SelectTrigger id={`${idPrefix}-type`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLLABORATION_TYPES.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <Label htmlFor={`${idPrefix}-barterValue`}>Barter value (₹)</Label>
          <Input
            id={`${idPrefix}-barterValue`}
            type="number"
            min={0}
            placeholder="0"
            value={form.barterValue}
            onChange={(event) => setForm((f) => ({ ...f, barterValue: event.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-status`}>Status</Label>
        <Select value={form.status} onValueChange={(value) => setForm((f) => ({ ...f, status: value }))}>
          <SelectTrigger id={`${idPrefix}-status`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-date`}>Date</Label>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          required
          value={form.date}
          onChange={(event) => setForm((f) => ({ ...f, date: event.target.value }))}
        />
      </div>
    </>
  );
}
