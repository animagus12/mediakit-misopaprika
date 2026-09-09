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
import { AFFILIATE_STATUS_LABELS, PAYOUT_SCHEDULE_LABELS } from "@/lib/affiliates";
import {
  AFFILIATE_STATUSES,
  COMMISSION_MODELS,
  PAYOUT_SCHEDULES,
  type AffiliatePartner,
  type AffiliateStatus,
  type CommissionModel,
  type PayoutSchedule,
} from "@/repositories/affiliatePartners";
import { toIsoDate } from "@/lib/editorTransactions";

// A card on the /links page, offered as the join target. Passed in already
// flattened by the page: the form has no business walking the links tree.
export interface LinkItemOption {
  id: string;
  label: string;
  section: string;
}

export interface BrandOption {
  id: string;
  name: string;
}

export interface PartnerFormState {
  name: string;
  code: string;
  brandId: string;
  trackingUrl: string;
  commissionModel: CommissionModel;
  commissionRate: string;
  status: AffiliateStatus;
  startDate: string;
  dashboardUrl: string;
  payoutSchedule: PayoutSchedule;
  linkItemId: string;
}

// <Select> cannot hold an empty string as a value, so "no brand" and "no
// card" need a sentinel. Converted back to null on submit by both callers.
export const NONE = "none";

export function partnerInitialForm(): PartnerFormState {
  return {
    name: "",
    code: "",
    brandId: NONE,
    trackingUrl: "",
    commissionModel: "percent",
    commissionRate: "",
    status: "active",
    startDate: new Date().toISOString().slice(0, 10),
    dashboardUrl: "",
    payoutSchedule: "monthly",
    linkItemId: NONE,
  };
}

export function partnerFormFrom(partner: AffiliatePartner): PartnerFormState {
  return {
    name: partner.name,
    code: partner.code,
    brandId: partner.brandId ?? NONE,
    trackingUrl: partner.trackingUrl,
    commissionModel: partner.commissionModel,
    commissionRate: partner.commissionRate ? String(partner.commissionRate) : "",
    status: partner.status,
    startDate: toIsoDate(partner.startDate),
    dashboardUrl: partner.dashboardUrl,
    payoutSchedule: partner.payoutSchedule,
    linkItemId: partner.linkItemId ?? NONE,
  };
}

interface PartnerFormFieldsProps {
  idPrefix: string;
  form: PartnerFormState;
  setForm: React.Dispatch<React.SetStateAction<PartnerFormState>>;
  brands: BrandOption[];
  linkItems: LinkItemOption[];
}

export function PartnerFormFields({
  idPrefix,
  form,
  setForm,
  brands,
  linkItems,
}: PartnerFormFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`}>Program</Label>
          <Input
            id={`${idPrefix}-name`}
            required
            autoFocus
            placeholder="Overblaze"
            value={form.name}
            onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-code`}>Code</Label>
          <Input
            id={`${idPrefix}-code`}
            required
            placeholder="PAPRIKA10"
            value={form.code}
            onChange={(event) => setForm((f) => ({ ...f, code: event.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-brand`}>Brand</Label>
        <Select
          value={form.brandId}
          onValueChange={(value) => setForm((f) => ({ ...f, brandId: value }))}
        >
          <SelectTrigger id={`${idPrefix}-brand`} className="w-full">
            <SelectValue placeholder="Not linked" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not linked</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[0.7rem] text-muted-foreground">
          Links the commission to a brand in the CRM, so it shows on that brand&apos;s payments tab.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-model`}>Commission model</Label>
          <Select
            value={form.commissionModel}
            onValueChange={(value) =>
              setForm((f) => ({ ...f, commissionModel: value as CommissionModel }))
            }
          >
            <SelectTrigger id={`${idPrefix}-model`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMISSION_MODELS.map((model) => (
                <SelectItem key={model} value={model}>
                  {model === "percent" ? "Percent of sales" : "Flat per sale"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-rate`}>
            {form.commissionModel === "percent" ? "Rate (%)" : "Rate (₹ per sale)"}
          </Label>
          <Input
            id={`${idPrefix}-rate`}
            type="number"
            min={0}
            step="0.01"
            placeholder="10"
            value={form.commissionRate}
            onChange={(event) => setForm((f) => ({ ...f, commissionRate: event.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-status`}>Status</Label>
          <Select
            value={form.status}
            onValueChange={(value) => setForm((f) => ({ ...f, status: value as AffiliateStatus }))}
          >
            <SelectTrigger id={`${idPrefix}-status`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AFFILIATE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {AFFILIATE_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-schedule`}>Payout schedule</Label>
          <Select
            value={form.payoutSchedule}
            onValueChange={(value) =>
              setForm((f) => ({ ...f, payoutSchedule: value as PayoutSchedule }))
            }
          >
            <SelectTrigger id={`${idPrefix}-schedule`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYOUT_SCHEDULES.map((schedule) => (
                <SelectItem key={schedule} value={schedule}>
                  {PAYOUT_SCHEDULE_LABELS[schedule]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-start`}>Start date</Label>
        <Input
          id={`${idPrefix}-start`}
          type="date"
          required
          value={form.startDate}
          onChange={(event) => setForm((f) => ({ ...f, startDate: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-linkItem`}>Links page card</Label>
        <Select
          value={form.linkItemId}
          onValueChange={(value) => setForm((f) => ({ ...f, linkItemId: value }))}
        >
          <SelectTrigger id={`${idPrefix}-linkItem`} className="w-full">
            <SelectValue placeholder="Not on the links page" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not on the links page</SelectItem>
            {linkItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
                <span className="text-muted-foreground"> · {item.section}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[0.7rem] text-muted-foreground">
          Joins the code to its card so clicks can be counted against sales. Without it there is no
          conversion rate.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-tracking`}>Tracking link</Label>
        <Input
          id={`${idPrefix}-tracking`}
          type="url"
          placeholder="https://"
          value={form.trackingUrl}
          onChange={(event) => setForm((f) => ({ ...f, trackingUrl: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-dashboard`}>Partner dashboard</Label>
        <Input
          id={`${idPrefix}-dashboard`}
          type="url"
          placeholder="https://"
          value={form.dashboardUrl}
          onChange={(event) => setForm((f) => ({ ...f, dashboardUrl: event.target.value }))}
        />
        <p className="text-[0.7rem] text-muted-foreground">
          Where the figures below are read from, so it is one click away when a period closes.
        </p>
      </div>
    </>
  );
}
