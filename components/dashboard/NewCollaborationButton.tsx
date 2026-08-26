"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
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
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createCollaboration } from "@/app/(dashboard)/actions";
import {
  COLLABORATION_TYPES,
  REEL_OPTIONS,
  STORY_OPTIONS,
  STATUS_OPTIONS,
  type CollaborationType,
} from "@/lib/collaborations";

interface FormState {
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

function initialForm(): FormState {
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

export function NewCollaborationButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCollaboration({
        brand: form.brand.trim(),
        campaign: form.campaign.trim(),
        type: form.type,
        reels: form.reels,
        story: form.story,
        status: form.status,
        amount: Number(form.amount) || 0,
        barterValue: Number(form.barterValue) || 0,
        date: form.date,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setForm(initialForm());
      setOpen(false);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-3.5" />
          New collaboration
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>New collaboration</SheetTitle>
          <SheetDescription>
            Adds a row to the campaigns sheet. Payment status and method are
            left blank — fill those in once the deal is actually paid out.
          </SheetDescription>
        </SheetHeader>

        <form
          id="new-collaboration-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-6"
        >
          <div className="space-y-2">
            <Label htmlFor="brand">Brand</Label>
            <Input
              id="brand"
              required
              autoFocus
              value={form.brand}
              onChange={(event) => setForm((f) => ({ ...f, brand: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign">Campaign</Label>
            <Input
              id="campaign"
              value={form.campaign}
              onChange={(event) => setForm((f) => ({ ...f, campaign: event.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="reels">Reels</Label>
              <Select value={form.reels} onValueChange={(value) => setForm((f) => ({ ...f, reels: value }))}>
                <SelectTrigger id="reels" className="w-full">
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
              <Label htmlFor="story">Story</Label>
              <Select value={form.story} onValueChange={(value) => setForm((f) => ({ ...f, story: value }))}>
                <SelectTrigger id="story" className="w-full">
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
            <Label htmlFor="type">Type</Label>
            <Select
              value={form.type}
              onValueChange={(value) => setForm((f) => ({ ...f, type: value as CollaborationType }))}
            >
              <SelectTrigger id="type" className="w-full">
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
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                placeholder="0"
                value={form.amount}
                onChange={(event) => setForm((f) => ({ ...f, amount: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barterValue">Barter value (₹)</Label>
              <Input
                id="barterValue"
                type="number"
                min={0}
                placeholder="0"
                value={form.barterValue}
                onChange={(event) => setForm((f) => ({ ...f, barterValue: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm((f) => ({ ...f, status: value }))}
            >
              <SelectTrigger id="status" className="w-full">
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
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              required
              value={form.date}
              onChange={(event) => setForm((f) => ({ ...f, date: event.target.value }))}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="submit"
            form="new-collaboration-form"
            className="flex-1"
            disabled={isPending || !form.brand.trim()}
          >
            {isPending ? "Adding…" : "Add collaboration"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
