"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ellipsis, FileText, Trash2, Unlink, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { unlinkCampaignInvoice, updateCampaign } from "@/app/(dashboard)/actions";
import { deleteCampaign } from "@/app/campaigns/actions";
import { restoreTrashItem } from "@/app/trash/actions";
import { SheetFormFooter, SheetFormFooterFigure } from "@/components/common/SheetFormFooter";
import { showUndoToast } from "@/components/common/undo-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, type CampaignInvoiceOption } from "@/lib/invoice";
import { todayKey } from "@/lib/day";
import { DealCosts } from "@/components/expenses/DealCosts";
import { PaymentHistory } from "@/components/payments/PaymentHistory";
import {
  CampaignFormFields,
  amountFieldText,
  campaignAmounts,
  campaignTotal,
  focusBrandField,
  type CampaignDueInvoice,
  type CampaignFormState,
  type CampaignLicenceContext,
} from "./CampaignFormFields";
import { CAMPAIGN_STATUS_STYLES } from "./campaignStatusStyle";
import { UsageRightsPanel } from "./UsageRightsPanel";
import {
  CAMPAIGN_TYPES,
  isCampaignCalledOff,
  campaignLabel,
  toIsoDate,
  type CampaignBrandOption,
} from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import { renewalTotal } from "@/lib/usageRights";
import { campaignTypeHasCash, type Campaign } from "@/repositories/campaigns";
import { notifyCreatedBrand } from "@/components/dashboard/createdBrandToast";

// Radix Select can't take "" as an item value, so "not linked" needs its own.
const NO_INVOICE_LINK = "__none__";

type SheetTab = "details" | "money" | "usage";

function latestRenewal(campaign: Campaign) {
  const { renewals } = campaign.usage;
  return renewals.length > 0 ? renewals[renewals.length - 1] : null;
}

function licenceContext(campaign: Campaign): CampaignLicenceContext {
  const renewal = latestRenewal(campaign);
  return {
    status: campaign.usage.status,
    renewalStart: renewal ? toIsoDate(renewal.startDate) : null,
  };
}

// On a deal with cash the paid date, method and actual TDS belong to its
// payments now (see the Payments tab), so the form only carries them for a
// barter-only deal, where "paid date" is the day the goods arrived.
function formFromCampaign(campaign: Campaign): CampaignFormState {
  const renewal = latestRenewal(campaign);
  const barterOnly = !campaignTypeHasCash(campaign.type);
  return {
    brand: campaign.brand,
    brandId: campaign.brandId,
    campaign: campaign.campaign,
    type: CAMPAIGN_TYPES.includes(campaign.type as (typeof CAMPAIGN_TYPES)[number])
      ? (campaign.type as CampaignFormState["type"])
      : "Barter",
    reels: campaign.reels,
    reelTypes: campaign.reelTypes,
    story: campaign.story,
    status: campaign.status,
    amount: amountFieldText(campaign.amount),
    barterValue: amountFieldText(campaign.barterValue),
    paymentStatus: campaign.storedPaymentStatus,
    barterStatus: campaign.barterState ?? "pending",
    date: toIsoDate(campaign.date) || todayKey(),
    uploadDate: toIsoDate(campaign.uploadDate),
    paymentDue: toIsoDate(campaign.paymentDue),
    paidDate: barterOnly ? toIsoDate(campaign.paidDate) : "",
    paymentMethod: barterOnly ? campaign.paymentMethod : "",
    tdsRate: campaign.tdsRate === null ? "" : String(campaign.tdsRate),
    tdsAmount: barterOnly && campaign.tdsAmount !== null ? String(campaign.tdsAmount) : "",
    editorTransactionId: campaign.editorTransactionId,
    usageDays: campaign.usage.days > 0 ? String(campaign.usage.days) : "",
    usageIndefinite: campaign.usage.indefinite,
    usageRenewalDays: renewal ? String(renewal.days) : "",
    usageEndedOn: toIsoDate(campaign.usage.endedOn),
    usageFee: amountFieldText(campaign.usage.fee),
  };
}

/** Said at the top of the tabs whose controls write on click rather than on Save. */
function SavesAsYouGo() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Zap className="size-3.5 shrink-0 text-primary" aria-hidden />
      Changes on this tab save as you make them.
    </p>
  );
}

export function EditCampaignSheet({
  campaign,
  trigger,
  brandOptions = [],
  videoOptions = [],
  invoiceOptions = [],
}: {
  campaign: Campaign;
  trigger: ReactNode;
  brandOptions?: CampaignBrandOption[];
  videoOptions?: EditorVideoOption[];
  /** The invoices this deal can be linked to. Left empty, the sheet offers no picker and keeps the link. */
  invoiceOptions?: CampaignInvoiceOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SheetTab>("details");
  const [form, setForm] = useState<CampaignFormState>(() => formFromCampaign(campaign));
  // The form as it was opened, so the footer can say whether anything changed.
  const [openedForm, setOpenedForm] = useState<CampaignFormState>(() => formFromCampaign(campaign));
  const [invoiceId, setInvoiceId] = useState<string | null>(campaign.invoiceId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Only invoices no other deal is linked to, plus this deal's own so the
  // picker can show it and unlink it. No choices left means no picker.
  const availableInvoices = invoiceOptions.filter(
    (option) => !option.linkedCampaignId || option.linkedCampaignId === campaign.id
  );
  const pickedInvoice = invoiceId ? availableInvoices.find((option) => option.id === invoiceId) : undefined;
  // The invoice the due date will be read from once saved. The picked one when
  // the sheet has a picker, so switching invoices shows the new date before
  // saving; otherwise the link already saved, which the read has applied.
  const dueInvoice: CampaignDueInvoice | null = pickedInvoice
    ? pickedInvoice.dueDate
      ? { number: pickedInvoice.number, dueDate: pickedInvoice.dueDate }
      : null
    : invoiceId && invoiceId === campaign.invoiceId && campaign.paymentDueFromInvoice
      ? { number: campaign.invoiceRef || "the linked invoice", dueDate: toIsoDate(campaign.paymentDue) }
      : null;
  const [error, setError] = useState<string | null>(null);
  const [brandMissing, setBrandMissing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isUnlinking, startUnlinkTransition] = useTransition();

  // Lowering the amount below what has already arrived would leave the deal
  // overpaid; said before saving rather than discovered on the dashboard.
  const formAmounts = campaignAmounts(form);
  const formCash = formAmounts.amount + formAmounts.usageFee;
  const settled = campaign.settlement?.settled ?? 0;
  const overpaidAfterSave = campaignTypeHasCash(form.type) ? Math.max(0, settled - formCash) : 0;
  const dirty =
    invoiceId !== campaign.invoiceId || JSON.stringify(form) !== JSON.stringify(openedForm);
  // Renewal money is shown beside the deal's total rather than in it: see renewalTotal.
  const total = campaignTotal(form);
  const renewalMoney = renewalTotal(campaign.usage);

  // The payments and costs are shown for the deal as last saved: a deal turned
  // barter only in the form still has its payments until it is saved.
  const showPayments = Boolean(campaign.settlement && campaign.cash > 0);
  const showCosts = Boolean(campaign.costs);

  const formId = `edit-campaign-${campaign.id}`;
  const label = campaignLabel(campaign.campaign, campaign.brand);
  const statusStyle = CAMPAIGN_STATUS_STYLES[form.status];
  // A deal linked to its invoice opens it. One that isn't gets the editor
  // prefilled from the deal, unless there is nothing to bill: a called-off deal
  // is owed nothing, and a deal with no value has no line to put a price on.
  // A deal whose invoice is only matched by its typed number still lands on
  // that invoice, since /invoices/new redirects to it rather than raise another.
  const invoiceHref = campaign.invoiceId
    ? `/invoices/${campaign.invoiceId}`
    : !isCampaignCalledOff(campaign.status) && campaign.total > 0
      ? `/invoices/new?campaignId=${encodeURIComponent(campaign.id)}`
      : null;
  const invoiceActionLabel = campaign.invoiceId ? "View invoice" : "Create invoice";

  // Writes on click rather than on Save, like the licence panel: undoing a
  // wrong link shouldn't wait on the rest of the form being valid.
  function unlinkInvoice() {
    startUnlinkTransition(async () => {
      const result = await unlinkCampaignInvoice(campaign.id);
      if (!result.success) {
        toast.error("Couldn't unlink the invoice", { description: result.error });
        return;
      }
      setInvoiceId(null);
      toast.success("Invoice unlinked");
      router.refresh();
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!form.brand.trim()) {
      setBrandMissing(true);
      setTab("details");
      // After the Details tab is back on screen, or the focus has nowhere to go.
      requestAnimationFrame(() => focusBrandField(formId));
      return;
    }
    startTransition(async () => {
      const result = await updateCampaign({
        id: campaign.id,
        brand: form.brand.trim(),
        brandId: form.brandId,
        campaign: form.campaign.trim(),
        type: form.type,
        reels: form.reels,
        reelTypes: form.reelTypes,
        story: form.story,
        status: form.status,
        ...campaignAmounts(form),
        paymentStatus: form.paymentStatus,
        ...(form.type === "Barter+Paid" ? { barterStatus: form.barterStatus } : {}),
        date: form.date,
        uploadDate: form.uploadDate,
        paymentDue: dueInvoice ? dueInvoice.dueDate : form.paymentDue,
        paidDate: form.paidDate,
        paymentMethod: form.paymentMethod.trim(),
        tdsRate: form.tdsRate.trim() ? Number(form.tdsRate) : null,
        tdsAmount: form.tdsAmount.trim() ? Number(form.tdsAmount) : null,
        editorTransactionId: form.editorTransactionId,
        usageDays: Number(form.usageDays) || 0,
        usageIndefinite: form.usageIndefinite,
        // Sent only where they mean something, so an unrenewed or live licence
        // never has a renewal length or end date written onto it.
        ...(campaign.usage.renewals.length > 0 && Number(form.usageRenewalDays) > 0
          ? { usageRenewalDays: Number(form.usageRenewalDays) }
          : {}),
        ...(campaign.usage.status === "ended" && form.usageEndedOn
          ? { usageEndedOn: form.usageEndedOn }
          : {}),
        // Only from a sheet that offered the picker, so a sheet without one
        // can't unlink a deal it never showed the invoice for.
        ...(availableInvoices.length > 0 ? { invoiceId } : {}),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      notifyCreatedBrand(result.createdBrand, router);
      setOpen(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCampaign(campaign.id);
      showUndoToast(label, result, restoreTrashItem);
      if (result.success) {
        setDeleteOpen(false);
        setOpen(false);
      }
    });
  }

  // With the schedule, since a linked invoice sets the payment due date. The
  // picker is saved with the form; Unlink writes straight away.
  const invoiceSlot =
    invoiceHref || availableInvoices.length > 0 ? (
      <Field>
        {availableInvoices.length > 0 ? (
          <FieldLabel htmlFor={`${formId}-invoiceId`}>Invoice</FieldLabel>
        ) : (
          <FieldTitle>Invoice</FieldTitle>
        )}
        <div className="flex items-center gap-2">
          {availableInvoices.length > 0 && (
            <Select
              value={invoiceId ?? NO_INVOICE_LINK}
              onValueChange={(value) => setInvoiceId(value === NO_INVOICE_LINK ? null : value)}
            >
              <SelectTrigger id={`${formId}-invoiceId`} className="min-w-0 flex-1">
                <SelectValue placeholder="Not linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_INVOICE_LINK}>Not linked</SelectItem>
                {availableInvoices.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <span className="truncate">
                      {option.number}
                      {option.detail && ` · ${option.detail}`}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {invoiceHref && (
            <Button asChild variant="outline" className="h-9 shrink-0">
              <Link href={invoiceHref}>
                <FileText />
                {invoiceActionLabel}
              </Link>
            </Button>
          )}
          {campaign.invoiceId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-9 shrink-0"
                  aria-label="Unlink invoice"
                  disabled={isUnlinking}
                  onClick={unlinkInvoice}
                >
                  <Unlink />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Unlink invoice</TooltipContent>
            </Tooltip>
          )}
        </div>
        <FieldDescription>
          {invoiceId !== campaign.invoiceId
            ? pickedInvoice
              ? `Saving links ${pickedInvoice.number} and shows it on the campaigns table.`
              : "Saving unlinks the invoice from this deal."
            : campaign.invoiceId
              ? "Already raised for this deal."
              : "Create invoice fills in the brand, deliverables, amounts and due date from this deal as last saved."}
        </FieldDescription>
      </Field>
    ) : undefined;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const opened = formFromCampaign(campaign);
          setForm(opened);
          setOpenedForm(opened);
          setInvoiceId(campaign.invoiceId);
          setTab("details");
          setError(null);
          setBrandMissing(false);
        }
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex flex-col gap-0 data-[side=right]:sm:max-w-xl">
        {/* Room on the right for the menu and the sheet's own close button. */}
        <SheetHeader className="gap-1 pr-24 pb-4 pointer-coarse:pr-30">
          <SheetTitle className="truncate text-base">{label}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant={statusStyle.variant} className={statusStyle.className}>
              {form.status}
            </Badge>
            <span className="min-w-0 truncate">
              {campaign.campaign.trim() ? `${campaign.brand} · ` : ""}
              {form.type === "Barter+Paid" ? "Barter + Paid" : form.type}
            </span>
          </SheetDescription>
        </SheetHeader>

        {/* Deleting sits here, away from Save, and asks first. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="More actions"
              className="absolute top-4 right-12 pointer-coarse:right-16"
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {invoiceHref && (
              <>
                <DropdownMenuItem asChild>
                  <Link href={invoiceHref}>
                    <FileText />
                    {invoiceActionLabel}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              variant="destructive"
              disabled={isPending}
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 />
              Delete campaign…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
              <AlertDialogDescription>
                This moves the campaign to Trash, where it can be restored. Its linked invoices and
                editor records won&apos;t be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isPending}>
                Delete campaign
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Details is the form Save submits. The other tabs hold what writes on
            click (payments, costs, the licence), which used to share one
            scroll with the form and invite the two to be confused. */}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as SheetTab)}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="border-b border-border px-6">
            <TabsList variant="line" className="gap-4 px-0">
              <TabsTrigger value="details" className="flex-none px-1">
                Details
              </TabsTrigger>
              {(showPayments || showCosts) && (
                <TabsTrigger value="money" className="flex-none px-1">
                  {showPayments ? "Payments" : "Costs"}
                </TabsTrigger>
              )}
              <TabsTrigger value="usage" className="flex-none px-1">
                Usage
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Kept mounted while another tab shows, so Save in the footer
                still has its form to submit. */}
            <TabsContent value="details" forceMount className="px-6 py-6 data-[state=inactive]:hidden">
              {/* A field the browser refuses has to be on screen to say so. */}
              <form id={formId} onSubmit={handleSubmit} onInvalidCapture={() => setTab("details")}>
                <CampaignFormFields
                  idPrefix={formId}
                  licence={licenceContext(campaign)}
                  form={form}
                  setForm={setForm}
                  brandOptions={brandOptions}
                  videoOptions={videoOptions}
                  dueInvoice={dueInvoice}
                  brandError={brandMissing && !form.brand.trim()}
                  invoiceSlot={invoiceSlot}
                />
              </form>
            </TabsContent>

            {(showPayments || showCosts) && (
              <TabsContent value="money" className="flex flex-col gap-6 px-6 py-6">
                <SavesAsYouGo />
                {campaign.settlement && showPayments && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Payments</p>
                    <PaymentHistory
                      settlement={campaign.settlement}
                      targetLabel={label}
                      expectedTdsRate={campaign.tdsRate}
                    />
                  </div>
                )}
                {showCosts && <DealCosts campaign={campaign} />}
              </TabsContent>
            )}

            <TabsContent value="usage" className="flex flex-col gap-4 px-6 py-6">
              <SavesAsYouGo />
              <div className="space-y-2">
                <p className="text-xs font-medium">Ad usage rights</p>
                <UsageRightsPanel campaign={campaign} />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <SheetFormFooter
          formId={formId}
          submitLabel="Save campaign"
          pendingLabel="Saving…"
          isPending={isPending}
          dirty={dirty}
          error={error}
          warning={
            overpaidAfterSave > 0
              ? `${formatMoney(settled)} already received; saving at ${formatMoney(formCash)} leaves ${formatMoney(overpaidAfterSave)} overpaid.`
              : null
          }
          summary={
            <SheetFormFooterFigure
              value={formatMoney(total)}
              label="deal total"
              note={renewalMoney > 0 ? `${formatMoney(total + renewalMoney)} with renewals` : undefined}
            />
          }
        />
      </SheetContent>
    </Sheet>
  );
}
