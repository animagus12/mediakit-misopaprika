"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { CountStepper } from "@/components/common/CountStepper";
import { FieldGroup } from "@/components/common/FieldGroup";
import { OptionToggle } from "@/components/common/OptionToggle";
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CAMPAIGN_TYPES,
  DELIVERABLE_MAX,
  STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  isCampaignCancelled,
  paymentStatusLabel,
  type CampaignBrandOption,
} from "@/lib/campaigns";
import { todayKey } from "@/lib/day";
import { formatMoney } from "@/lib/invoice";
import type { EditorVideoOption } from "@/lib/contentPlan";
import {
  campaignTypeHasBarter,
  campaignTypeHasCash,
  type CampaignPaymentStatus,
  type CampaignStatus,
  type CampaignType,
  type UsageStatus,
} from "@/repositories/campaigns";

// Radix Select can't take "" as an item value, so "add a brand that isn't in
// the list" needs a sentinel of its own. Same for the editor picker's "no job".
const NEW_BRAND = "__new__";
const NO_VIDEO = "__none__";

export interface CampaignFormState {
  brand: string;
  brandId: string | null;
  campaign: string;
  type: CampaignType;
  reels: number;
  story: number;
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
 * A deal is paid in what its type says it is paid in: a Barter deal carries no
 * cash and a Paid one carries no goods, however much the other field still
 * holds behind the scenes. Carrying both would be a contradiction the rest of
 * the app has to arbitrate, with the table reading the deal as mixed and the
 * reliability score taking a barter deal back on.
 *
 * Settled here, at the point of saving, rather than by clearing the fields as
 * the type changes. Both give the same record; only this one survives someone
 * flipping the type twice by accident, which on an existing deal would
 * otherwise wipe a real amount with nothing on screen to show it had gone.
 *
 * The ad usage fee follows the cash rule: it is money, so a barter-only deal
 * charges none.
 */
export function campaignAmounts(form: CampaignFormState): {
  amount: number;
  barterValue: number;
  usageFee: number;
} {
  const cash = campaignTypeHasCash(form.type);
  return {
    amount: cash ? Number(form.amount) || 0 : 0,
    barterValue: campaignTypeHasBarter(form.type) ? Number(form.barterValue) || 0 : 0,
    usageFee: cash ? Math.max(0, Number(form.usageFee) || 0) : 0,
  };
}

/**
 * The payment status a deal's own dates imply, for the flows that don't ask.
 *
 * A deal just struck has nothing to say about payment: it is unknown until
 * money is promised or lands. Filling "Paid on" is what makes it received (on
 * a barter deal that field is "Delivered on", which is the same day and the
 * same field), and cash with a date it is owed by is pending. The edit sheet
 * keeps the select, since a deal already on the books sometimes needs one of
 * the three said outright.
 */
export function derivedPaymentStatus(form: CampaignFormState): CampaignPaymentStatus {
  if (form.paidDate.trim()) return "received";
  const { amount, usageFee } = campaignAmounts(form);
  if (form.paymentDue.trim() && amount + usageFee > 0) return "pending";
  return "unknown";
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
    reels: 1,
    story: 0,
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
 * fields it edits: which term is the one being edited, and where it runs from.
 * Absent on a new deal, which has no renewals or end yet.
 */
export interface CampaignLicenceContext {
  status: UsageStatus;
  /** yyyy-mm-dd the latest renewal runs from, or null when never renewed. */
  renewalStart: string | null;
  /** Renewal money received and pending, shown beside the deal's total (see renewalTotal). */
  renewalMoney: number;
}

interface CampaignFormFieldsProps {
  idPrefix: string;
  /**
   * "create" leaves out what a deal being struck can't know yet: its payment
   * status, which its dates imply (see derivedPaymentStatus). "edit" asks for
   * everything, since any of it can be the thing being corrected.
   */
  mode?: "create" | "edit";
  licence?: CampaignLicenceContext;
  form: CampaignFormState;
  setForm: React.Dispatch<React.SetStateAction<CampaignFormState>>;
  brandOptions?: CampaignBrandOption[];
  /** Videos already sent to an editor, for the picker. Empty hides it. */
  videoOptions?: EditorVideoOption[];
  /** The invoice setting this deal's payment due date (yyyy-mm-dd), which locks the field. */
  dueInvoice?: CampaignDueInvoice | null;
}

export interface CampaignDueInvoice {
  /** "MSP-INV-0014" */
  number: string;
  dueDate: string;
}

// Shared by NewCampaignButton (create) and EditCampaignSheet (edit) so the
// two flows can't drift apart on field order/options. idPrefix keeps
// <label htmlFor> ids unique since several of these can be mounted in the DOM
// at once (one per campaign card), even while closed.
//
// The order is the order a deal is agreed in: who it's with and what it's for,
// what it pays, where it has got to. Everything a deal only learns later (when
// the money lands, when the post goes up, who cut it) is folded away, because
// on a new deal all of it is blank and on an existing one most of it is set by
// something other than this form.
export function CampaignFormFields({
  idPrefix,
  mode = "edit",
  licence,
  form,
  setForm,
  brandOptions = [],
  videoOptions = [],
  dueInvoice = null,
}: CampaignFormFieldsProps) {
  const linkedBrand = form.brandId ? brandOptions.find((option) => option.id === form.brandId) : undefined;
  const linkedVideo = form.editorTransactionId
    ? videoOptions.find((option) => option.id === form.editorTransactionId)
    : undefined;

  // One Brand field, not two: the picker is the field, and the name box
  // appears under it only for a brand that isn't in the CRM yet. A deal that
  // already carries a name with no link is such a brand, so it opens typed in.
  const [namingBrand, setNamingBrand] = useState(
    () => !form.brandId && form.brand.trim() !== ""
  );
  const typingBrand = brandOptions.length === 0 || (!form.brandId && namingBrand);

  // A deal is paid in what its type says (see campaignAmounts), so the form
  // only asks for the halves it has: no cash on a barter deal, no goods on a
  // paid one. The licence is asked for either way, since a barter deal can
  // grant ad usage as readily as a paid one.
  const hasCash = campaignTypeHasCash(form.type);
  const hasBarter = campaignTypeHasBarter(form.type);
  const amounts = campaignAmounts(form);

  // A licence is edited as a length in days, never as an end date: the end is
  // the upload date plus that length (see usageTerm), so a second field for it
  // was the same fact written twice and something for a save to disagree with.
  // A renewed licence's editable length is the renewal's, which runs from its
  // own start rather than from the upload date.
  const status = licence?.status ?? "active";
  const renewed = licence?.renewalStart != null;
  const termStart = renewed ? licence?.renewalStart || form.uploadDate : form.uploadDate;
  // A renewal's length is only worth showing while the licence still runs; an
  // ended one shows the day it was called off instead.
  const showRenewalDays = !form.usageIndefinite && status === "active" && renewed;
  const showEndedOn = status === "ended";
  const total = amounts.amount + amounts.usageFee + amounts.barterValue;
  const renewalMoney = licence?.renewalMoney ?? 0;

  // The money fields, built once and laid out below: which of them a deal has
  // depends on its type, so the rows they sit in change shape with it.
  const amountField = (
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
  );

  const barterField = (
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
  );

  const usageFeeField = (
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
  );

  const usageDaysField = (
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
  );

  return (
    <>
      <FieldGroup title="Deal">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-${typingBrand ? "brand" : "brandId"}`}>Brand</Label>
          {brandOptions.length > 0 && (
            <Select
              value={form.brandId ?? (namingBrand ? NEW_BRAND : "")}
              onValueChange={(value) => {
                if (value === NEW_BRAND) {
                  setNamingBrand(true);
                  setForm((f) => ({ ...f, brandId: null }));
                  return;
                }
                const option = brandOptions.find((o) => o.id === value);
                setNamingBrand(false);
                setForm((f) => ({ ...f, brandId: value, brand: option?.name ?? f.brand }));
              }}
            >
              <SelectTrigger id={`${idPrefix}-brandId`} className="w-full">
                <SelectValue placeholder="Pick a brand" />
              </SelectTrigger>
              <SelectContent>
                {/* First and set apart from the names below it, because it is
                    the one option here that isn't a brand: it opens the name
                    box instead of choosing anything. */}
                <SelectItem
                  value={NEW_BRAND}
                  className="font-medium text-primary focus:text-primary focus:**:text-primary"
                >
                  <Plus />
                  Add a new brand
                </SelectItem>
                <SelectSeparator />
                {brandOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {typingBrand && (
            <Input
              id={`${idPrefix}-brand`}
              required
              autoFocus
              placeholder="Brand name"
              value={form.brand}
              onChange={(event) => setForm((f) => ({ ...f, brand: event.target.value }))}
            />
          )}
          {/* A link whose brand has since been deleted would otherwise show as
              the empty placeholder, reading as "not linked" when it is. */}
          {form.brandId && !linkedBrand && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Linked brand no longer exists: pick another, or type the name.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-campaign`}>Campaign</Label>
          <Input
            id={`${idPrefix}-campaign`}
            placeholder={form.brand.trim() || "What the deal is for"}
            value={form.campaign}
            onChange={(event) => setForm((f) => ({ ...f, campaign: event.target.value }))}
          />
        </div>

        {/* Buttons rather than a menu: there are four, they decide which money
            fields the form asks for, and seeing all four at once is what makes
            that switch obvious. */}
        <div className="space-y-2">
          <Label id={`${idPrefix}-type-label`}>Type</Label>
          <OptionToggle
            value={form.type}
            onChange={(type) => setForm((f) => ({ ...f, type }))}
            options={CAMPAIGN_TYPES}
            labelledBy={`${idPrefix}-type-label`}
          />
        </div>

        {/* Counts rather than a menu: a deal can promise any number of either,
            and a deliverable it doesn't include is 0 rather than a "None" to
            pick. The step is clamped by the stepper, so nothing here can go
            below none. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label id={`${idPrefix}-reels-label`}>Reels</Label>
            <CountStepper
              value={form.reels}
              onStep={(delta) => setForm((f) => ({ ...f, reels: f.reels + delta }))}
              labelledBy={`${idPrefix}-reels-label`}
              decrementLabel="One reel fewer"
              incrementLabel="One reel more"
              max={DELIVERABLE_MAX}
            />
          </div>
          <div className="space-y-2">
            <Label id={`${idPrefix}-story-label`}>Stories</Label>
            <CountStepper
              value={form.story}
              onStep={(delta) => setForm((f) => ({ ...f, story: f.story + delta }))}
              labelledBy={`${idPrefix}-story-label`}
              decrementLabel="One story fewer"
              incrementLabel="One story more"
              max={DELIVERABLE_MAX}
            />
          </div>
        </div>
      </FieldGroup>

      <FieldGroup title="Value">
        {/* Two per row, and never one field left hanging beside a gap: a deal
            with cash puts what it pays on the first row and what the licence
            costs and runs for on the second, and a barter deal, which has no
            fee, puts its goods beside the licence's length. The fee and the
            length stay together wherever they land: they are one agreement,
            and pricing a licence without saying how long it runs is the half
            that gets forgotten. */}
        {hasCash ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {/* A paid deal has no goods beside the amount, so it takes the
                  whole row rather than sitting next to a gap. */}
              <div className={hasBarter ? undefined : "col-span-2"}>{amountField}</div>
              {hasBarter && barterField}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {usageFeeField}
              {usageDaysField}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {barterField}
            {usageDaysField}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-usageIndefinite`}
            checked={form.usageIndefinite}
            onCheckedChange={(checked) =>
              setForm((f) => ({ ...f, usageIndefinite: checked === true }))
            }
          />
          <Label htmlFor={`${idPrefix}-usageIndefinite`} className="text-xs font-normal">
            Indefinite: no end date
          </Label>
        </div>

        {/* The fee is the one figure here that adds to another rather than
            standing alone, so the total is spelled out. */}
        <p className="text-[11px] text-muted-foreground">
          {total > 0 || renewalMoney > 0 ? (
            <>
              Total value {formatMoney(total)}
              {amounts.usageFee > 0 ? ", including the ad usage fee" : ""}
              {/* Beside the total rather than in it: see renewalTotal. */}
              {renewalMoney > 0 ? ` · ${formatMoney(total + renewalMoney)} with renewals` : ""}.{" "}
            </>
          ) : null}
          {form.usageIndefinite
            ? "The brand may run this as an ad for as long as it likes."
            : "Ad usage runs from the upload date. 0 when there is no licence."}
        </p>
      </FieldGroup>

      <FieldGroup title="Progress">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-date`}>Deal date</Label>
            <Input
              id={`${idPrefix}-date`}
              type="date"
              required
              value={form.date}
              onChange={(event) => setForm((f) => ({ ...f, date: event.target.value }))}
            />
          </div>
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
        </div>
      </FieldGroup>

      <Collapsible>
        <CollapsibleTrigger className="group/trigger flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted">
          {hasCash ? "Payment, delivery & editor" : "Delivery & editor"}
          <ChevronDown className="size-3.5 transition group-data-[state=open]/trigger:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          {mode === "create" && (
            <p className="text-[11px] text-muted-foreground">
              A deal being struck rarely knows these yet. Payment status follows what you fill in:
              a date in {hasCash ? "Paid on" : "Delivered on"} marks it received.
            </p>
          )}

          {mode === "edit" && (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-paymentStatus`}>
                {hasCash ? "Payment status" : "Barter status"}
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
          )}

          {hasCash ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}-paymentDue`}>Payment due</Label>
                  <Input
                    id={`${idPrefix}-paymentDue`}
                    type="date"
                    value={dueInvoice ? dueInvoice.dueDate : form.paymentDue}
                    disabled={dueInvoice !== null}
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
                {dueInvoice && `Payment due comes from ${dueInvoice.number}; change it on the invoice. `}
                The gap between these two is what the brand&apos;s payment record is built from.
              </p>

              {/* No invoice number field: a deal shows an invoice number only
                  once a real invoice is linked to it (the edit sheet's Invoice
                  section), so a typed number can't claim one that doesn't exist. */}
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-paymentMethod`}>Payment method</Label>
                <Input
                  id={`${idPrefix}-paymentMethod`}
                  placeholder="UPI, bank transfer, ..."
                  value={form.paymentMethod}
                  onChange={(event) => setForm((f) => ({ ...f, paymentMethod: event.target.value }))}
                />
              </div>
            </>
          ) : (
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
          )}

          {/* The day the licence counts from, since it starts when the post
              goes up rather than when the deal was struck. Beside it: the
              renewal's length on a renewed licence, or the day an ended one
              was called off. */}
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
            {showRenewalDays && (
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
            {showEndedOn && (
              <div className="space-y-2">
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
          {showRenewalDays && (
            <p className="text-[11px] text-muted-foreground">
              Renewed from {formatDayKey(termStart)}, so Renewal (days) is the term running now.
              Ad usage (days) above is the original term.
            </p>
          )}

          {/* Kept with the dates rather than up with the pipeline stage: which
              job cut the video is something the workspace answers, and a deal
              is usually linked to it after the fact. Unlike the content form's
              copy of this picker, nothing on the deal is renamed by the
              choice: a campaign is called what the brand calls it, not what
              the job was filed under. */}
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
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
