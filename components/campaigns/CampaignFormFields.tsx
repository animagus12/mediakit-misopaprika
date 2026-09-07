"use client";

import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CAMPAIGN_TYPES,
  REEL_OPTIONS,
  STORY_OPTIONS,
  STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  paymentStatusLabel,
  type CampaignBrandOption,
} from "@/lib/campaigns";
import type { CampaignPaymentStatus, CampaignType } from "@/repositories/campaigns";

const NO_BRAND_LINK = "__none__";

export interface CampaignFormState {
  brand: string;
  brandId: string | null;
  campaign: string;
  type: CampaignType;
  reels: string;
  story: string;
  status: string;
  amount: string;
  barterValue: string;
  paymentStatus: CampaignPaymentStatus;
  date: string;
  uploadDate: string;
  invoiceId: string;
  paymentDue: string;
  paidDate: string;
  paymentMethod: string;
  /** Kept as a string like the money fields, so the input can be left empty. */
  usageMonths: string;
}

export function campaignInitialForm(): CampaignFormState {
  return {
    brand: "",
    brandId: null,
    campaign: "",
    type: "Barter",
    reels: REEL_OPTIONS[0],
    story: STORY_OPTIONS[0],
    status: "Brainstorming",
    amount: "",
    barterValue: "",
    paymentStatus: "unknown",
    date: new Date().toISOString().slice(0, 10),
    uploadDate: "",
    invoiceId: "",
    paymentDue: "",
    paidDate: "",
    paymentMethod: "",
    usageMonths: "",
  };
}

interface CampaignFormFieldsProps {
  idPrefix: string;
  form: CampaignFormState;
  setForm: React.Dispatch<React.SetStateAction<CampaignFormState>>;
  brandOptions?: CampaignBrandOption[];
}

// Shared by NewCampaignButton (create) and EditCampaignSheet (edit) so the
// two flows can't drift apart on field order/options. idPrefix keeps
// <label htmlFor> ids unique since several of these can be mounted in the DOM
// at once (one per campaign card), even while closed.
export function CampaignFormFields({ idPrefix, form, setForm, brandOptions = [] }: CampaignFormFieldsProps) {
  const linkedBrand = form.brandId ? brandOptions.find((option) => option.id === form.brandId) : undefined;

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

      {brandOptions.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-brandId`}>Link to brand</Label>
          <Select
            value={form.brandId ?? NO_BRAND_LINK}
            onValueChange={(value) => {
              if (value === NO_BRAND_LINK) {
                setForm((f) => ({ ...f, brandId: null }));
                return;
              }
              const option = brandOptions.find((o) => o.id === value);
              setForm((f) => ({ ...f, brandId: value, brand: option?.name ?? f.brand }));
            }}
          >
            <SelectTrigger id={`${idPrefix}-brandId`} className="w-full">
              <SelectValue placeholder="No brand (one-off)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_BRAND_LINK}>No brand (one-off)</SelectItem>
              {brandOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.brandId && !linkedBrand && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Linked brand no longer exists: pick another or set it to one-off.
            </p>
          )}
        </div>
      )}

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
          onValueChange={(value) => setForm((f) => ({ ...f, type: value as CampaignType }))}
        >
          <SelectTrigger id={`${idPrefix}-type`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_TYPES.map((option) => (
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

      <Collapsible>
        <CollapsibleTrigger className="group/trigger flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted">
          Invoice, payment &amp; usage rights
          <ChevronDown className="size-3.5 transition group-data-[state=open]/trigger:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-paymentStatus`}>Payment status</Label>
            <Select
              value={form.paymentStatus}
              onValueChange={(value) => setForm((f) => ({ ...f, paymentStatus: value as CampaignPaymentStatus }))}
            >
              <SelectTrigger id={`${idPrefix}-paymentStatus`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {paymentStatusLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-paymentDue`}>Payment due</Label>
              <Input
                id={`${idPrefix}-paymentDue`}
                type="date"
                value={form.paymentDue}
                onChange={(event) => setForm((f) => ({ ...f, paymentDue: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-paidDate`}>Paid on</Label>
              <Input
                id={`${idPrefix}-paidDate`}
                type="date"
                value={form.paidDate}
                onChange={(event) => setForm((f) => ({ ...f, paidDate: event.target.value }))}
              />
            </div>
          </div>
          {/* The pair above is the whole of the payment-reliability record:
              when it was promised, and when it arrived. Said here rather than
              left to be inferred, because a blank "Paid on" is what makes a
              settled deal count for nothing either way. */}
          <p className="text-[11px] text-muted-foreground">
            The gap between these two is what the brand&apos;s payment record is built from.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-invoiceId`}>Invoice ID</Label>
              <Input
                id={`${idPrefix}-invoiceId`}
                placeholder="MSP-INV-0011"
                value={form.invoiceId}
                onChange={(event) => setForm((f) => ({ ...f, invoiceId: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-paymentMethod`}>Payment method</Label>
              <Input
                id={`${idPrefix}-paymentMethod`}
                placeholder="UPI, Barter, ..."
                value={form.paymentMethod}
                onChange={(event) => setForm((f) => ({ ...f, paymentMethod: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-uploadDate`}>Upload date</Label>
              <Input
                id={`${idPrefix}-uploadDate`}
                type="date"
                value={form.uploadDate}
                onChange={(event) => setForm((f) => ({ ...f, uploadDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-usageMonths`}>Ad usage (months)</Label>
              <Input
                id={`${idPrefix}-usageMonths`}
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={form.usageMonths}
                onChange={(event) => setForm((f) => ({ ...f, usageMonths: event.target.value }))}
              />
            </div>
          </div>
          {/* Paired with the upload date on purpose: the licence counts from
              the day the post goes up, not from the day the deal was struck,
              so the two fields belong on the same row. */}
          <p className="text-[11px] text-muted-foreground">
            How long the brand may keep running this as an ad, counted from the upload date.
            Leave at 0 if there is no licence to track.
          </p>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
