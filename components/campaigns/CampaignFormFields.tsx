"use client";

import { useState } from "react";
import { ChevronDown, Lock, Plus, Unlink } from "lucide-react";
import { CountStepper } from "@/components/common/CountStepper";
import { AMOUNT_PATTERN, MoneyInput } from "@/components/common/MoneyInput";
import { OptionToggle } from "@/components/common/OptionToggle";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CAMPAIGN_TYPES,
  DELIVERABLE_MAX,
  STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  isCampaignCancelled,
  paymentStatusLabel,
  CAMPAIGN_REEL_TYPES,
  type CampaignBrandOption,
} from "@/lib/campaigns";
import { addDays, todayKey } from "@/lib/day";
import { formatMoney } from "@/lib/invoice";
import { formatFormAmount, parseFormAmount } from "@/lib/paymentForm";
import { estimateTdsFromRateInput } from "@/lib/tds";
import { cn } from "@/lib/utils";
import type { EditorVideoOption } from "@/lib/contentPlan";
import {
  campaignTypeHasBarter,
  campaignTypeHasCash,
  type CampaignPaymentStatus,
  type CampaignReelType,
  type CampaignStatus,
  type CampaignType,
  type UsageStatus,
} from "@/repositories/campaigns";
import { CAMPAIGN_STATUS_DOTS } from "./campaignStatusStyle";

// Radix Select can't take "" as an item value, so "add a brand that isn't in
// the list" needs a sentinel of its own. Same for the editor picker's "no job".
const NEW_BRAND = "__new__";
const NO_VIDEO = "__none__";

// How far after the deal date a payment is usually due. One tap each, since
// brands mostly pay on one of these terms.
const DUE_OFFSETS = [15, 30, 45] as const;

export interface CampaignFormState {
  brand: string;
  brandId: string | null;
  campaign: string;
  type: CampaignType;
  reels: number;
  reelTypes: CampaignReelType[];
  story: number;
  status: CampaignStatus;
  /** As typed, grouping commas and all ("45,000"); read with parseFormAmount. */
  amount: string;
  barterValue: string;
  /**
   * On a deal with cash: "unknown" (not tracked) or "pending" (expected); the
   * money itself is recorded as payments. A "received" here is one stored
   * before payments were recorded, shown and kept as it is. On a barter-only
   * deal: the barter's own status.
   */
  paymentStatus: CampaignPaymentStatus;
  /** Whether a Barter+Paid deal's barter half was delivered. */
  barterStatus: CampaignPaymentStatus;
  date: string;
  uploadDate: string;
  paymentDue: string;
  paidDate: string;
  paymentMethod: string;
  tdsRate: string;
  tdsAmount: string;
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

/** A form amount as a number, 0 for blank or unreadable (the input's pattern refuses the latter). */
function amountOf(text: string): number {
  return parseFormAmount(text) || 0;
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
    amount: cash ? amountOf(form.amount) : 0,
    barterValue: campaignTypeHasBarter(form.type) ? amountOf(form.barterValue) : 0,
    usageFee: cash ? Math.max(0, amountOf(form.usageFee)) : 0,
  };
}

/** What a deal is worth in all: its cash, its ad usage fee and its goods. */
export function campaignTotal(form: CampaignFormState): number {
  const { amount, barterValue, usageFee } = campaignAmounts(form);
  return amount + usageFee + barterValue;
}

/**
 * The payment status a deal's own dates imply, for the flows that don't ask.
 *
 * A deal just struck has nothing to say about payment: it is unknown until
 * money is promised or lands. Cash with a date it is owed by is expected
 * (pending); cash that already arrived is recorded as a payment ("Already
 * received"), never as a status. A barter-only deal is received once
 * "Delivered on" is filled. The edit sheet keeps the select, since a deal
 * already on the books sometimes needs it said outright.
 */
export function derivedPaymentStatus(form: CampaignFormState): CampaignPaymentStatus {
  const { amount, usageFee } = campaignAmounts(form);
  if (!campaignTypeHasCash(form.type)) return form.paidDate.trim() ? "received" : "unknown";
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
    reelTypes: ["Organic Reel"],
    story: 0,
    status: "Scripting",
    amount: "",
    barterValue: "",
    paymentStatus: "unknown",
    barterStatus: "pending",
    date: todayKey(),
    uploadDate: "",
    paymentDue: "",
    paidDate: "",
    paymentMethod: "",
    tdsRate: "",
    tdsAmount: "",
    editorTransactionId: null,
    usageDays: "",
    usageIndefinite: false,
    usageRenewalDays: "",
    usageEndedOn: "",
    usageFee: "",
  };
}

/** A stored amount as the money field shows it: "" for none, grouped otherwise. */
export function amountFieldText(amount: number): string {
  return amount > 0 ? formatFormAmount(String(amount)) : "";
}

/**
 * Moves focus to the Brand field, which scrolls it into view. For a sheet
 * whose save was refused for want of a brand, since the field is at the top
 * and the button that was pressed is at the bottom.
 */
export function focusBrandField(idPrefix: string) {
  const field =
    document.getElementById(`${idPrefix}-brandId`) ?? document.getElementById(`${idPrefix}-brand`);
  field?.focus();
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
}

interface CampaignFormFieldsProps {
  idPrefix: string;
  /**
   * "create" leaves out what a deal being struck can't know yet: its payment
   * status, which its dates imply (see derivedPaymentStatus), and folds what
   * it only learns later under More details. "edit" shows everything, since
   * any of it can be the thing being corrected.
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
  /** Set when a save was refused for want of a brand; cleared by naming one. */
  brandError?: boolean;
  /** The edit sheet's invoice link, shown with the schedule since it sets the due date. */
  invoiceSlot?: React.ReactNode;
  /** A new deal's "Already received" payment fields, shown under More details. */
  paymentSlot?: React.ReactNode;
}

export interface CampaignDueInvoice {
  /** "MSP-INV-0014" */
  number: string;
  dueDate: string;
}

/** The quiet "Optional" beside a label. Required fields say nothing. */
function OptionalTag() {
  return <span className="font-normal text-muted-foreground">Optional</span>;
}

/**
 * One titled run of fields. A real legend, so a screen reader gets the form's
 * shape. Wrapped, because the rule between sections can't go on the fieldset
 * itself: a browser draws a fieldset's legend inside its top border.
 */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <FieldSet>
        <FieldLegend>{title}</FieldLegend>
        {description && <FieldDescription>{description}</FieldDescription>}
        <FieldGroup>{children}</FieldGroup>
      </FieldSet>
    </div>
  );
}

// Shared by NewCampaignSheet (create) and EditCampaignSheet (edit) so the two
// flows can't drift apart on field order/options. idPrefix keeps
// <label htmlFor> ids unique since several of these can be mounted in the DOM
// at once (one per campaign card), even while closed.
//
// The order is the order a deal is agreed in: who it's with and what it's for,
// what it pays, where it has got to and when the money is owed. What a deal
// only learns later (when the post goes up, who cut it, money that already
// landed) comes last, and on a new deal is folded under More details, since
// there all of it is blank.
export function CampaignFormFields({
  idPrefix,
  mode = "edit",
  licence,
  form,
  setForm,
  brandOptions = [],
  videoOptions = [],
  dueInvoice = null,
  brandError = false,
  invoiceSlot,
  paymentSlot,
}: CampaignFormFieldsProps) {
  const linkedBrand = form.brandId ? brandOptions.find((option) => option.id === form.brandId) : undefined;
  const linkedVideo = form.editorTransactionId
    ? videoOptions.find((option) => option.id === form.editorTransactionId)
    : undefined;
  const linkedVideoIsClaimed = Boolean(form.editorTransactionId && linkedVideo?.linked);
  const linkedVideoIsMissing = Boolean(form.editorTransactionId && !linkedVideo);
  const availableVideoOptions = videoOptions.filter((option) => !option.linked);
  const { amount: cashAmount, usageFee } = campaignAmounts(form);

  // One Brand field, not two: the picker is the field, and the name box
  // appears under it only for a brand that isn't in the CRM yet. A deal that
  // already carries a name with no link is such a brand, so it opens typed in.
  const [namingBrand, setNamingBrand] = useState(
    () => !form.brandId && form.brand.trim() !== ""
  );
  const typingBrand = brandOptions.length === 0 || (!form.brandId && namingBrand);
  const [moreOpen, setMoreOpen] = useState(false);

  // A deal is paid in what its type says (see campaignAmounts), so the form
  // only asks for the halves it has: no cash on a barter deal, no goods on a
  // paid one. The licence is asked for either way, since a barter deal can
  // grant ad usage as readily as a paid one.
  const hasCash = campaignTypeHasCash(form.type);
  const hasBarter = campaignTypeHasBarter(form.type);
  const estimatedTds = estimateTdsFromRateInput(form.tdsRate, cashAmount + usageFee);

  // A licence is edited as a length in days, never as an end date: the end is
  // the day it was started plus that length (see usageTerm), so a second field
  // for it was the same fact written twice and something for a save to
  // disagree with. A renewed licence's editable length is the renewal's, which
  // runs from its own start rather than the licence's.
  const status = licence?.status ?? "active";
  const renewed = licence?.renewalStart != null;
  const termStart = renewed ? licence?.renewalStart || form.uploadDate : form.uploadDate;
  // A renewal's length is only worth showing while the licence still runs; an
  // ended one shows the day it was called off instead.
  const showRenewalDays = !form.usageIndefinite && status === "active" && renewed;
  const showEndedOn = status === "ended";

  function stepReels(delta: number) {
    setForm((current) => {
      const reels = Math.max(0, Math.min(DELIVERABLE_MAX, current.reels + delta));
      const reelTypes = current.reelTypes.slice(0, reels);
      while (reelTypes.length < reels) reelTypes.push("Organic Reel");
      return { ...current, reels, reelTypes };
    });
  }

  // The amount fields, built once and laid out below: which of them a deal has
  // depends on its type, so the rows they sit in change shape with it. Each
  // regroups its figure ("1,25,000") when it is left.
  function moneyField(
    key: "amount" | "barterValue" | "usageFee",
    label: string,
    optional = false
  ) {
    const id = `${idPrefix}-${key}`;
    return (
      <Field>
        <FieldLabel htmlFor={id}>
          {label}
          {optional && <OptionalTag />}
        </FieldLabel>
        <MoneyInput
          id={id}
          pattern={AMOUNT_PATTERN}
          title="An amount in rupees, like 45,000"
          placeholder="0"
          value={form[key]}
          onChange={(event) => setForm((f) => ({ ...f, [key]: event.target.value }))}
          onBlur={(event) => setForm((f) => ({ ...f, [key]: formatFormAmount(event.target.value) }))}
        />
      </Field>
    );
  }

  const amountField = moneyField("amount", "Amount");
  const barterField = moneyField("barterValue", "Barter value");
  const usageFeeField = moneyField("usageFee", "Ad usage fee", true);

  const usageDaysField = (
    <Field data-disabled={form.usageIndefinite || undefined}>
      <FieldLabel htmlFor={`${idPrefix}-usageDays`}>Usage licence</FieldLabel>
      <InputGroup data-disabled={form.usageIndefinite || undefined}>
        <InputGroupInput
          id={`${idPrefix}-usageDays`}
          inputMode="numeric"
          pattern="[0-9]*"
          title="A whole number of days"
          autoComplete="off"
          placeholder={form.usageIndefinite ? "No end" : "0"}
          disabled={form.usageIndefinite}
          value={form.usageIndefinite ? "" : form.usageDays}
          onChange={(event) => setForm((f) => ({ ...f, usageDays: event.target.value }))}
        />
        <InputGroupAddon align="inline-end">days</InputGroupAddon>
      </InputGroup>
    </Field>
  );

  const tdsField = (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-tdsRate`}>
        Expected TDS
        <OptionalTag />
      </FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={`${idPrefix}-tdsRate`}
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          title="A rate from 0 to 100"
          autoComplete="off"
          placeholder="0"
          value={form.tdsRate}
          onChange={(event) => setForm((f) => ({ ...f, tdsRate: event.target.value }))}
        />
        <InputGroupAddon align="inline-end">%</InputGroupAddon>
      </InputGroup>
      {/* The rate the brand is expected to withhold. Each payment records
          what was actually withheld. */}
      <FieldDescription>
        {estimatedTds !== null ? `About ${formatMoney(estimatedTds)} withheld` : "What the brand deducts"}
      </FieldDescription>
    </Field>
  );

  const indefiniteField = (
    <Field orientation="horizontal">
      <Switch
        id={`${idPrefix}-usageIndefinite`}
        checked={form.usageIndefinite}
        onCheckedChange={(checked) => setForm((f) => ({ ...f, usageIndefinite: checked }))}
      />
      <FieldLabel htmlFor={`${idPrefix}-usageIndefinite`} className="font-normal">
        Licence has no end date
      </FieldLabel>
    </Field>
  );

  // Payment tracking, the upload date and the editor: the parts of a deal
  // that are mostly set by something other than this form. Its own section
  // when editing, folded under More details on a new deal.
  const deliveryFields = (
    <>
      {mode === "edit" && !hasCash && (
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-paymentStatus`}>Barter status</FieldLabel>
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
        </Field>
      )}

      {/* On a deal with cash the money is recorded as payments (the sheet's
          Payments tab), so this only says whether it is tracked. A "received"
          stored before payments were recorded is kept as it is and shown, not
          offered as a choice. */}
      {mode === "edit" && hasCash && (
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-paymentStatus`}>Payment tracking</FieldLabel>
          {form.paymentStatus === "received" ? (
            <FieldDescription>
              Marked received before payments were recorded. Edit it on the Payments tab to add the
              date, TDS and account it landed in.
            </FieldDescription>
          ) : (
            <Select
              value={form.paymentStatus}
              onValueChange={(value) => setForm((f) => ({ ...f, paymentStatus: value as CampaignPaymentStatus }))}
            >
              <SelectTrigger id={`${idPrefix}-paymentStatus`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Not tracked</SelectItem>
                <SelectItem value="pending">Expected</SelectItem>
              </SelectContent>
            </Select>
          )}
          {/* "Cancelled" is not one of the options because it is not one of
              the stored values: it is read off the deal's own status (see
              paymentDisplayStatus). */}
          {isCampaignCancelled(form.status) && form.paymentStatus !== "received" && (
            <FieldDescription>
              A cancelled deal reads as Cancelled here. Record a payment only if money actually landed.
            </FieldDescription>
          )}
        </Field>
      )}

      {/* The day the post went up. Beside it: the renewal's length on a
          renewed licence, or the day an ended one was called off. */}
      <div className="grid grid-cols-1 gap-4 @xs/field-group:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-uploadDate`}>
            Upload date
            <OptionalTag />
          </FieldLabel>
          <Input
            id={`${idPrefix}-uploadDate`}
            type="date"
            value={form.uploadDate}
            onChange={(event) => setForm((f) => ({ ...f, uploadDate: event.target.value }))}
          />
        </Field>
        {showRenewalDays && (
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-usageRenewalDays`}>Renewal</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id={`${idPrefix}-usageRenewalDays`}
                inputMode="numeric"
                pattern="[1-9][0-9]*"
                title="A whole number of days, at least 1"
                autoComplete="off"
                value={form.usageRenewalDays}
                onChange={(event) => setForm((f) => ({ ...f, usageRenewalDays: event.target.value }))}
              />
              <InputGroupAddon align="inline-end">days</InputGroupAddon>
            </InputGroup>
          </Field>
        )}
        {showEndedOn && (
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-usageEndedOn`}>Ended on</FieldLabel>
            <Input
              id={`${idPrefix}-usageEndedOn`}
              type="date"
              min={form.uploadDate || form.date || undefined}
              max={todayKey()}
              value={form.usageEndedOn}
              onChange={(event) => setForm((f) => ({ ...f, usageEndedOn: event.target.value }))}
            />
          </Field>
        )}
      </div>
      {showRenewalDays && (
        <FieldDescription className="-mt-2">
          Renewed from {formatDayKey(termStart)}, so Renewal is the term running now. Usage licence
          above is the original term.
        </FieldDescription>
      )}

      {/* Which job cut the video is something the workspace answers, and a
          deal is usually linked to it after the fact. Unlike the content
          form's copy of this picker, nothing on the deal is renamed by the
          choice: a campaign is called what the brand calls it, not what the
          job was filed under. */}
      {(videoOptions.length > 0 || form.editorTransactionId) && (
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-video`}>
            From your editors
            <OptionalTag />
          </FieldLabel>
          <div className="flex items-center gap-2">
            <Select
              value={
                form.editorTransactionId && linkedVideo && !linkedVideo.linked
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
                if (availableVideoOptions.some((option) => option.id === value)) {
                  setForm((f) => ({ ...f, editorTransactionId: value }));
                }
              }}
            >
              <SelectTrigger id={`${idPrefix}-video`} className="min-w-0 flex-1">
                <SelectValue placeholder="Not sent to an editor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VIDEO} disabled={linkedVideoIsClaimed}>
                  {linkedVideoIsClaimed || linkedVideoIsMissing
                    ? "Choose another video"
                    : "Not sent to an editor"}
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
              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={() => setForm((f) => ({ ...f, editorTransactionId: null }))}
              >
                <Unlink />
                Unlink
              </Button>
            )}
          </div>
          {form.editorTransactionId && (
            <FieldDescription className="truncate">
              {linkedVideo
                ? `Linked: ${linkedVideo.video} · ${linkedVideo.editor}`
                : "This video link is no longer available."}
            </FieldDescription>
          )}
          {/* A link whose job has since been deleted would otherwise show as
              the empty placeholder, reading as "not linked" when it is. */}
          {linkedVideoIsMissing && (
            <FieldDescription className="text-amber-600 dark:text-amber-400">
              The editing job behind this is gone. Unlink it or choose another video.
            </FieldDescription>
          )}
        </Field>
      )}

      {paymentSlot}
    </>
  );

  return (
    <div className="flex flex-col gap-6 [&>*+*]:border-t [&>*+*]:pt-6">
      <Section title="Deal" description="Who it is with and what it promises.">
        <div className="grid grid-cols-1 gap-4 @md/field-group:grid-cols-2">
          <Field data-invalid={brandError || undefined}>
            <FieldLabel htmlFor={`${idPrefix}-${typingBrand ? "brand" : "brandId"}`}>Brand</FieldLabel>
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
                <SelectTrigger
                  id={`${idPrefix}-brandId`}
                  className="w-full"
                  aria-invalid={(brandError && !typingBrand) || undefined}
                >
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
                autoFocus
                placeholder="Brand name"
                aria-invalid={brandError || undefined}
                value={form.brand}
                onChange={(event) => setForm((f) => ({ ...f, brand: event.target.value }))}
              />
            )}
            {/* A link whose brand has since been deleted would otherwise show as
                the empty placeholder, reading as "not linked" when it is. */}
            {form.brandId && !linkedBrand && (
              <FieldDescription className="text-amber-600 dark:text-amber-400">
                Linked brand no longer exists: pick another, or type the name.
              </FieldDescription>
            )}
            {brandError && (
              <FieldError>
                {brandOptions.length > 0 ? "Pick a brand, or add a new one." : "Enter the brand's name."}
              </FieldError>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor={`${idPrefix}-campaign`}>
              Campaign
              <OptionalTag />
            </FieldLabel>
            <Input
              id={`${idPrefix}-campaign`}
              placeholder={form.brand.trim() || "What the deal is for"}
              value={form.campaign}
              onChange={(event) => setForm((f) => ({ ...f, campaign: event.target.value }))}
            />
          </Field>
        </div>

        {/* Buttons rather than a menu: there are four, they decide which money
            fields the form asks for, and seeing all four at once is what makes
            that switch obvious. */}
        <Field>
          <FieldTitle id={`${idPrefix}-type-label`}>Deal type</FieldTitle>
          <OptionToggle
            value={form.type}
            onChange={(type) => setForm((f) => ({ ...f, type }))}
            options={CAMPAIGN_TYPES}
            labelledBy={`${idPrefix}-type-label`}
            className="@md/field-group:grid-cols-4"
          />
        </Field>

        {/* Counts rather than a menu: a deal can promise any number of either,
            and a deliverable it doesn't include is 0 rather than a "None" to
            pick. The step is clamped by the stepper, so nothing here can go
            below none. */}
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldTitle id={`${idPrefix}-reels-label`}>Reels</FieldTitle>
            <CountStepper
              value={form.reels}
              onStep={stepReels}
              labelledBy={`${idPrefix}-reels-label`}
              decrementLabel="One reel fewer"
              incrementLabel="One reel more"
              max={DELIVERABLE_MAX}
              className="justify-between"
            />
          </Field>
          <Field>
            <FieldTitle id={`${idPrefix}-story-label`}>Stories</FieldTitle>
            <CountStepper
              value={form.story}
              onStep={(delta) => setForm((f) => ({ ...f, story: f.story + delta }))}
              labelledBy={`${idPrefix}-story-label`}
              decrementLabel="One story fewer"
              incrementLabel="One story more"
              max={DELIVERABLE_MAX}
              className="justify-between"
            />
          </Field>
        </div>

        {/* One row per reel, each a two-way choice, so the mix is visible
            without opening anything. Scrolls past a handful of reels. */}
        {form.reels > 0 && (
          <div
            role="group"
            aria-label="Video type per reel"
            className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3"
          >
            {form.reelTypes.map((type, index) => (
              <Field
                key={`${idPrefix}-reel-type-${index}`}
                orientation="horizontal"
                className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3"
              >
                <FieldTitle id={`${idPrefix}-reel-type-${index}`} className="font-normal text-muted-foreground">
                  Reel {index + 1}
                </FieldTitle>
                <OptionToggle
                  value={type}
                  options={CAMPAIGN_REEL_TYPES}
                  labelledBy={`${idPrefix}-reel-type-${index}`}
                  onChange={(next) =>
                    setForm((current) => ({
                      ...current,
                      reelTypes: current.reelTypes.map((currentType, currentIndex) =>
                        currentIndex === index ? next : currentType
                      ),
                    }))
                  }
                />
              </Field>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Money"
        description={
          hasCash
            ? "What the brand pays. Payments record the money as it lands."
            : "What the brand sends instead of cash."
        }
      >
        {/* Two per row. The fee and the licence's length stay together where
            they can: they are one agreement, and pricing a licence without
            saying how long it runs is the half that gets forgotten. */}
        {hasCash && !hasBarter && (
          <>
            <div className="grid grid-cols-2 gap-4">
              {amountField}
              {usageFeeField}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {usageDaysField}
              {tdsField}
            </div>
          </>
        )}
        {hasCash && hasBarter && (
          <>
            <div className="grid grid-cols-2 gap-4">
              {amountField}
              {barterField}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {usageFeeField}
              {usageDaysField}
            </div>
            <div className="grid grid-cols-2 gap-4">{tdsField}</div>
          </>
        )}
        {!hasCash && (
          <div className="grid grid-cols-2 gap-4">
            {barterField}
            {usageDaysField}
          </div>
        )}
        {indefiniteField}
        <FieldDescription className="-mt-2">
          {form.usageIndefinite
            ? "The brand may run it as an ad for as long as it likes."
            : mode === "create"
              ? "Ad usage counts from the day you start it, once the deal is saved. 0 for no licence."
              : "Ad usage counts from the day you start it on the Usage tab. 0 for no licence."}
        </FieldDescription>
      </Section>

      <Section title="Schedule" description="Where the deal has got to and when it pays.">
        <div className="grid grid-cols-1 gap-4 @xs/field-group:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-date`}>Deal date</FieldLabel>
            <Input
              id={`${idPrefix}-date`}
              type="date"
              required
              value={form.date}
              onChange={(event) => setForm((f) => ({ ...f, date: event.target.value }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-status`}>Status</FieldLabel>
            <Select
              value={form.status}
              onValueChange={(value) => setForm((f) => ({ ...f, status: value as CampaignStatus }))}
            >
              <SelectTrigger id={`${idPrefix}-status`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.filter((option) => option !== "On Hold").map((option) => (
                  <SelectItem key={option} value={option}>
                    <StatusDot status={option} />
                    {option}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value="On Hold">
                  <StatusDot status="On Hold" />
                  On Hold
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        {invoiceSlot}

        {hasCash ? (
          <>
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-paymentDue`}>
                Payment due
                <OptionalTag />
              </FieldLabel>
              {/* Chips beside the date where the sheet is wide, on a row of
                  their own under it on a phone. */}
              <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center">
                <Input
                  id={`${idPrefix}-paymentDue`}
                  type="date"
                  className="min-w-0 @md/field-group:flex-1"
                  value={dueInvoice ? dueInvoice.dueDate : form.paymentDue}
                  disabled={dueInvoice !== null}
                  onChange={(event) => setForm((f) => ({ ...f, paymentDue: event.target.value }))}
                />
                {!dueInvoice && (
                  <div className="flex gap-2">
                    {DUE_OFFSETS.map((days) => {
                      const due = addDays(form.date || todayKey(), days);
                      const active = form.paymentDue === due;
                      return (
                        <Button
                          key={days}
                          type="button"
                          variant={active ? "secondary" : "outline"}
                          className="rounded-full"
                          aria-pressed={active}
                          onClick={() => setForm((f) => ({ ...f, paymentDue: due }))}
                        >
                          +{days} days
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
              <FieldDescription className={cn(dueInvoice && "flex items-center gap-1.5")}>
                {dueInvoice ? (
                  <>
                    <Lock className="size-3 shrink-0" aria-hidden />
                    Set by {dueInvoice.number}. Change it on the invoice.
                  </>
                ) : mode === "create" ? (
                  "Chips count from the deal date. A due date marks the money as expected."
                ) : (
                  "Chips count from the deal date."
                )}
              </FieldDescription>
            </Field>

            {hasBarter && (
              <Field>
                <FieldLabel htmlFor={`${idPrefix}-barterStatus`}>Barter delivered</FieldLabel>
                <Select
                  value={form.barterStatus}
                  onValueChange={(value) => setForm((f) => ({ ...f, barterStatus: value as CampaignPaymentStatus }))}
                >
                  <SelectTrigger id={`${idPrefix}-barterStatus`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Not tracked</SelectItem>
                    <SelectItem value="pending">Not yet</SelectItem>
                    <SelectItem value="received">Delivered</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </>
        ) : (
          // One date, not a pair: "due" and "paid" describe a cash schedule
          // this deal never had. Stored in paidDate, which is the field the
          // day-the-thing-arrived has always lived in, so nothing downstream
          // needs a second date to look at. A barter deal is never scored on
          // payment timing, so there is no due date to be early or late against.
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-paidDate`}>
              Delivered on
              <OptionalTag />
            </FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id={`${idPrefix}-paidDate`}
                type="date"
                className="min-w-0 flex-1"
                value={form.paidDate}
                onChange={(event) => setForm((f) => ({ ...f, paidDate: event.target.value }))}
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setForm((f) => ({ ...f, paidDate: todayKey() }))}
              >
                Today
              </Button>
            </div>
            <FieldDescription>The day the barter arrived. Filling it marks it received.</FieldDescription>
          </Field>
        )}
      </Section>

      {mode === "edit" ? (
        <Section title="Delivery" description="Tracking, the post and the editor behind it.">
          {deliveryFields}
        </Section>
      ) : (
        <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-between gap-3 px-0 py-1 text-left hover:bg-transparent pointer-coarse:h-auto"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">More details</span>
                <span className="block truncate font-normal text-muted-foreground">
                  {hasCash ? "Upload date, editor, money already received" : "Upload date and editor"}
                </span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", moreOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <FieldGroup className="pt-4">{deliveryFields}</FieldGroup>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

/** The status's badge colour as a dot, beside its name in the picker. */
function StatusDot({ status }: { status: CampaignStatus }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", CAMPAIGN_STATUS_DOTS[status])} />;
}
