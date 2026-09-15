"use client";

import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  isCampaignCancelled,
  paymentStatusLabel,
  type CampaignBrandOption,
} from "@/lib/campaigns";
import { addDays, todayKey } from "@/lib/day";
import { formatMoney } from "@/lib/invoice";
import { termDaysUntil, termEndDayKey } from "@/lib/usageRights";
import { cn } from "@/lib/utils";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type {
  CampaignPaymentStatus,
  CampaignStatus,
  CampaignType,
  UsageStatus,
} from "@/repositories/campaigns";

const NO_BRAND_LINK = "__none__";
const NO_VIDEO = "__none__";

export interface CampaignFormState {
  brand: string;
  brandId: string | null;
  campaign: string;
  type: CampaignType;
  reels: string;
  story: string;
  status: CampaignStatus;
  amount: string;
  barterValue: string;
  paymentStatus: CampaignPaymentStatus;
  date: string;
  uploadDate: string;
  paymentDue: string;
  paidDate: string;
  paymentMethod: string;
  /** The editing job behind the deal's video, or null when there wasn't one. */
  editorTransactionId: string | null;
  /** Kept as a string like the money fields, so the input can be left empty. */
  usageDays: string;
  /** Granted with no end date; the days field is ignored while set. */
  usageIndefinite: boolean;
  /** The latest renewal's length, "" on a licence never renewed. */
  usageRenewalDays: string;
  /** yyyy-mm-dd an ended licence was called off on, "" otherwise. */
  usageEndedOn: string;
  /** The part of the amount agreed for ad usage, as a string for the same reason. */
  usageFee: string;
}

/**
 * The money a form state actually means.
 *
 * A deal marked Barter is barter-only by definition, so its cash amount is
 * zero however much the Amount field still holds behind the scenes: carrying
 * cash on it is a contradiction the rest of the app would have to arbitrate,
 * with the table reading the deal as mixed and the reliability score taking it
 * back on.
 *
 * Settled here, at the point of saving, rather than by clearing the field as
 * the type changes. Both give the same record; only this one survives someone
 * flipping the type twice by accident, which on an existing deal would
 * otherwise wipe a real amount with nothing on screen to show it had gone.
 *
 * The ad usage fee follows the same rule: it is cash, so a barter-only deal
 * charges none however much the hidden field still holds.
 */
export function campaignAmounts(form: CampaignFormState): {
  amount: number;
  barterValue: number;
  usageFee: number;
} {
  const barterOnly = form.type === "Barter";
  return {
    amount: barterOnly ? 0 : Number(form.amount) || 0,
    barterValue: Number(form.barterValue) || 0,
    usageFee: barterOnly ? 0 : Math.max(0, Number(form.usageFee) || 0),
  };
}

/** "13/03/2026" for a yyyy-mm-dd day key, the app's written date format. */
function formatDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split("-");
  return year && month && day ? `${day}/${month}/${year}` : dayKey;
}

export function campaignInitialForm(): CampaignFormState {
  return {
    brand: "",
    brandId: null,
    campaign: "",
    type: "Barter",
    reels: REEL_OPTIONS[0],
    story: STORY_OPTIONS[0],
    status: "Scripting",
    amount: "",
    barterValue: "",
    paymentStatus: "unknown",
    date: new Date().toISOString().slice(0, 10),
    uploadDate: "",
    paymentDue: "",
    paidDate: "",
    paymentMethod: "",
    editorTransactionId: null,
    usageDays: "",
    usageIndefinite: false,
    usageRenewalDays: "",
    usageEndedOn: "",
    usageFee: "",
  };
}

/**
 * What the form needs to know about a licence that already exists, beyond the
 * fields it edits: which term the end date belongs to and where it counts from.
 * Absent on a new deal, which has no renewals, pauses or end yet.
 */
export interface CampaignLicenceContext {
  status: UsageStatus;
  pausedDays: number;
  /** yyyy-mm-dd the latest renewal runs from, or null when never renewed. */
  renewalStart: string | null;
  /** Renewal money received and pending, shown beside the deal's total (see renewalTotal). */
  renewalMoney: number;
}

interface CampaignFormFieldsProps {
  idPrefix: string;
  licence?: CampaignLicenceContext;
  form: CampaignFormState;
  setForm: React.Dispatch<React.SetStateAction<CampaignFormState>>;
  brandOptions?: CampaignBrandOption[];
  /** Videos already sent to an editor, for the picker. Empty hides it. */
  videoOptions?: EditorVideoOption[];
}

// Shared by NewCampaignButton (create) and EditCampaignSheet (edit) so the
// two flows can't drift apart on field order/options. idPrefix keeps
// <label htmlFor> ids unique since several of these can be mounted in the DOM
// at once (one per campaign card), even while closed.
export function CampaignFormFields({
  idPrefix,
  licence,
  form,
  setForm,
  brandOptions = [],
  videoOptions = [],
}: CampaignFormFieldsProps) {
  const linkedBrand = form.brandId ? brandOptions.find((option) => option.id === form.brandId) : undefined;
  const linkedVideo = form.editorTransactionId
    ? videoOptions.find((option) => option.id === form.editorTransactionId)
    : undefined;

  // A barter-only deal has no cash side, so the form stops asking for one: no
  // amount, no due date, no invoice, no payment method. What it owes is a
  // parcel, and the only date worth recording is the day that arrived. The
  // same rule the campaigns table reads by (see paymentTiming, which refuses
  // to score a deal with no cash in it).
  const barterOnly = form.type === "Barter";
  const amounts = campaignAmounts(form);

  // The licence's end date is a second way to write its length, not a value of
  // its own: shown as start + length and turned back into a length when
  // picked, so the two can never disagree and Save changes writes one number.
  // After a renewal the length being edited is the renewal's, counted from its
  // own start; before one, the base term's, counted from the upload date.
  const status = licence?.status ?? "active";
  const pausedDays = licence?.pausedDays ?? 0;
  const renewed = licence?.renewalStart != null;
  const termStart = renewed ? licence?.renewalStart || form.uploadDate : form.uploadDate;
  const termDaysField: "usageRenewalDays" | "usageDays" = renewed ? "usageRenewalDays" : "usageDays";
  const endsOn = termEndDayKey(termStart, Number(form[termDaysField]) || 0, pausedDays);
  // A paused licence's end moves forward every day until it is resumed, so it
  // has no fixed date to pick; an ended one shows the day it ended instead.
  const showEndsOn = !form.usageIndefinite && status === "active";
  const showEndedOn = status === "ended";
  const total = amounts.amount + amounts.usageFee + amounts.barterValue;
  const renewalMoney = licence?.renewalMoney ?? 0;

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

      <div className={cn("grid gap-3", barterOnly ? "grid-cols-1" : "grid-cols-2")}>
        {!barterOnly && (
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
        )}
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
        {/* Third in the grid so it wraps to sit directly under Amount, the
            price it is charged on top of. Cash only, like the amount. */}
        {!barterOnly && (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-usageFee`}>Ad usage fee (₹)</Label>
            <Input
              id={`${idPrefix}-usageFee`}
              type="number"
              min={0}
              placeholder="0"
              value={form.usageFee}
              onChange={(event) => setForm((f) => ({ ...f, usageFee: event.target.value }))}
            />
          </div>
        )}
      </div>
      {/* Spelled out because the fee is the one figure here that adds to
          another rather than standing alone. */}
      {(total > 0 || renewalMoney > 0) && (
        <p className="text-[11px] text-muted-foreground">
          Total value {formatMoney(total)}
          {amounts.usageFee > 0 ? ", including the ad usage fee" : ""}
          {/* Beside the total rather than in it: see renewalTotal. */}
          {renewalMoney > 0 ? ` · ${formatMoney(total + renewalMoney)} with renewals` : ""}.
          {amounts.usageFee > 0 ? " The fee also counts as licensing income." : ""}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-status`}>Status</Label>
        <Select
          value={form.status}
          onValueChange={(value) => setForm((f) => ({ ...f, status: value as CampaignStatus }))}
        >
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

      {/* Beside the pipeline stage rather than in the payment section: who is
          cutting the video is a production fact, and the deal is usually
          linked to its job at the point the status moves to Editing. Unlike
          the content form's copy of this picker, nothing on the deal is
          renamed by the choice: a campaign is called what the brand calls it,
          not what the job was filed under. */}
      {videoOptions.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-video`}>From your editors</Label>
          <Select
            value={form.editorTransactionId ?? NO_VIDEO}
            onValueChange={(value) =>
              setForm((f) => ({
                ...f,
                editorTransactionId: value === NO_VIDEO ? null : value,
              }))
            }
          >
            <SelectTrigger id={`${idPrefix}-video`} className="w-full">
              <SelectValue placeholder="Not sent to an editor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_VIDEO}>Not sent to an editor</SelectItem>
              {videoOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.video}
                  <span className="text-muted-foreground">
                    {" "}
                    {option.editor}
                    {option.linked ? " · already linked" : ""}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* A link whose job has since been deleted would otherwise show as
              the empty placeholder, reading as "not linked" when it is. */}
          {form.editorTransactionId && !linkedVideo && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              The editing job behind this is gone. Pick another, or set it to not sent to an editor.
            </p>
          )}
        </div>
      )}

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
          {barterOnly ? "Delivery & usage rights" : "Invoice, payment & usage rights"}
          <ChevronDown className="size-3.5 transition group-data-[state=open]/trigger:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-paymentStatus`}>
              {barterOnly ? "Barter status" : "Payment status"}
            </Label>
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
            {/* "Cancelled" is not one of the options because it is not one of
                the stored values: it is read off the deal's own status (see
                paymentDisplayStatus). Said here so that leaving this on "Not
                tracked" does not look like something left unfinished. */}
            {isCampaignCancelled(form.status) && form.paymentStatus !== "received" && (
              <p className="text-[11px] text-muted-foreground">
                A cancelled deal reads as Cancelled here. Set this to Received only if the money
                actually landed.
              </p>
            )}
          </div>

          {barterOnly ? (
            <>
              {/* One date, not a pair: "due" and "paid" describe a cash
                  schedule this deal never had. Stored in paidDate, which is
                  the field the day-the-thing-arrived has always lived in, so
                  nothing downstream needs a second date to look at. */}
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-paidDate`}>Delivered on</Label>
                <Input
                  id={`${idPrefix}-paidDate`}
                  type="date"
                  value={form.paidDate}
                  onChange={(event) => setForm((f) => ({ ...f, paidDate: event.target.value }))}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                The day the barter actually arrived. A barter deal is never scored on payment
                timing, so there is no due date to be early or late against.
              </p>
            </>
          ) : (
            <>
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

              {/* No invoice number field: a deal shows an invoice number only
                  once a real invoice is linked to it (the edit sheet's Invoice
                  section), so a typed number can't claim one that doesn't exist. */}
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-paymentMethod`}>Payment method</Label>
                <Input
                  id={`${idPrefix}-paymentMethod`}
                  placeholder="UPI, Barter, ..."
                  value={form.paymentMethod}
                  onChange={(event) => setForm((f) => ({ ...f, paymentMethod: event.target.value }))}
                />
              </div>
            </>
          )}

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
              <Label htmlFor={`${idPrefix}-usageDays`}>Ad usage (days)</Label>
              <Input
                id={`${idPrefix}-usageDays`}
                type="number"
                min={0}
                step={1}
                placeholder={form.usageIndefinite ? "No end" : "0"}
                disabled={form.usageIndefinite}
                value={form.usageIndefinite ? "" : form.usageDays}
                onChange={(event) => setForm((f) => ({ ...f, usageDays: event.target.value }))}
              />
            </div>
          </div>
          {/* Paired with the upload date on purpose: the licence counts from
              the day the post goes up, not from the day the deal was struck,
              so the two fields belong on the same row. */}
          {(showEndsOn || showEndedOn) && (
            <div className="grid grid-cols-2 gap-3">
              {showEndsOn && renewed && (
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}-usageRenewalDays`}>Renewal (days)</Label>
                  <Input
                    id={`${idPrefix}-usageRenewalDays`}
                    type="number"
                    min={1}
                    step={1}
                    value={form.usageRenewalDays}
                    onChange={(event) =>
                      setForm((f) => ({ ...f, usageRenewalDays: event.target.value }))
                    }
                  />
                </div>
              )}
              {showEndsOn && (
                <div className="col-start-2 space-y-2">
                  <Label htmlFor={`${idPrefix}-usageEndsOn`}>Ends on</Label>
                  <Input
                    id={`${idPrefix}-usageEndsOn`}
                    type="date"
                    disabled={!termStart}
                    min={termStart ? addDays(termStart, pausedDays + 1) : undefined}
                    value={endsOn}
                    onChange={(event) => {
                      const picked = event.target.value;
                      if (!picked || !termStart) return;
                      setForm((f) => ({
                        ...f,
                        [termDaysField]: String(termDaysUntil(termStart, picked, pausedDays)),
                      }));
                    }}
                  />
                </div>
              )}
              {showEndedOn && (
                <div className="col-start-2 space-y-2">
                  <Label htmlFor={`${idPrefix}-usageEndedOn`}>Ended on</Label>
                  <Input
                    id={`${idPrefix}-usageEndedOn`}
                    type="date"
                    min={form.uploadDate || form.date || undefined}
                    max={todayKey()}
                    value={form.usageEndedOn}
                    onChange={(event) => setForm((f) => ({ ...f, usageEndedOn: event.target.value }))}
                  />
                </div>
              )}
            </div>
          )}
          {showEndsOn && !termStart && (
            <p className="text-[11px] text-muted-foreground">
              Set the upload date to pick an end date: the licence counts from the day it posts.
            </p>
          )}
          {showEndsOn && renewed && (
            <p className="text-[11px] text-muted-foreground">
              Renewed from {formatDayKey(termStart)}, so the end date moves the latest renewal.
              Ad usage (days) above is the original term.
            </p>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id={`${idPrefix}-usageIndefinite`}
              checked={form.usageIndefinite}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, usageIndefinite: checked === true }))
              }
            />
            <Label htmlFor={`${idPrefix}-usageIndefinite`} className="font-normal">
              Indefinite: no end date
            </Label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {form.usageIndefinite
              ? "The brand may run this as an ad for as long as it likes. It never expires or needs renewing."
              : "How long the brand may keep running this as an ad, counted from the upload date. Leave at 0 if there is no licence to track."}
          </p>

        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
