// The payment ledger's joins and rules: what each deal, renewal and invoice
// has received, as every reader sees it. Pure and client-safe.
//
// The repositories read the three stores (campaigns, invoices, payments) and
// hand them here; everything below is a function of those arrays alone, so it
// is exercised directly in lib/payments.test.ts and lib/ledgerParity.test.ts.
//
// Two rules keep a book written before the ledger reading exactly as it did:
//
//   * Virtual entries. While a target has no stored payment, its legacy
//     fields stand in for one: a stored "received" is one entry for the whole
//     amount, and an invoice advance on a target not yet received is one
//     entry for the advance. They are computed on every read and never
//     written. A single stored entry hides them all.
//   * Identity projection. A target's paymentStatus, paidDate, paymentMethod
//     and tdsAmount are only recomputed from the ledger once it has a stored
//     entry. Until then they are the stored values exactly, so the forty-odd
//     readers of those fields need no change.

import { campaignLabel, isCampaignCalledOff, toSheetDate } from "@/lib/campaigns";
import { isDayKey } from "@/lib/day";
import { financialYearStart } from "@/lib/financialYear";
import { buildInvoiceNumber, computeSubtotal, formatMoney } from "@/lib/invoice";
import { roundMoney, sumMoney } from "@/lib/money";
import { isPayer, isPaymentMethod, type Payer, type PaymentMethod } from "@/lib/payers";
import {
  campaignTypeHasBarter,
  campaignTypeHasCash,
  type Campaign,
  type CampaignPaymentStatus,
  type CampaignType,
  type UsageRenewal,
  type UsageRenewalRecord,
} from "@/repositories/campaigns";
import type { Invoice, InvoiceRecord, InvoiceStatus } from "@/repositories/invoices";
import {
  PAYMENT_NOTE_MAX,
  PAYMENT_REFERENCE_MAX,
  deriveBarterState,
  firstDayKey,
  isVirtualEntryId,
  legacyAdvanceEntry,
  legacyStatusEntry,
  paymentTargetKey,
  samePaymentTarget,
  settle,
  toLedgerEntry,
  type LedgerEntry,
  type PaymentInput,
  type PaymentRecord,
  type PaymentTarget,
  type Settlement,
} from "@/repositories/payments";

// --- Virtual legacy entries ------------------------------------------------

/** A non-void invoice's advance, or 0 when there is none to read. */
function invoiceAdvance(invoice: InvoiceRecord | null): number {
  if (!invoice || invoice.status === "void") return 0;
  return roundMoney(Math.max(0, Number(invoice.advance) || 0));
}

/**
 * The entries a deal's legacy fields stand for, for as long as it has no
 * stored payment. `linked` is the invoice that bills it, when the deal is
 * that invoice's owner.
 *
 * Called-off deals get theirs too, so the deal reads the same everywhere; the
 * reports that leave called-off money out keep doing so themselves.
 */
export function virtualDealEntries(campaign: Campaign, linked: InvoiceRecord | null): LedgerEntry[] {
  if (!campaignTypeHasCash(campaign.type) || campaign.cash <= 0) return [];
  const target: PaymentTarget = { kind: "deal", campaignId: campaign.id };
  if (campaign.storedPaymentStatus === "received") {
    return [
      legacyStatusEntry(target, {
        gross: campaign.cash,
        paidDate: campaign.paidDate,
        method: campaign.paymentMethod,
        tdsRate: campaign.tdsRate,
        tdsAmount: campaign.tdsAmount,
        bucketFallback: firstDayKey(campaign.uploadDate, campaign.date),
      }),
    ];
  }
  const advance = invoiceAdvance(linked);
  if (advance <= 0 || !linked) return [];
  return [legacyAdvanceEntry(target, advance, campaign.cash, firstDayKey(linked.issueDate))];
}

/** The same for one renewal of a deal. */
export function virtualRenewalEntries(
  campaign: Pick<Campaign, "id">,
  renewal: UsageRenewalRecord & { storedPaymentStatus?: CampaignPaymentStatus },
  linked: InvoiceRecord | null
): LedgerEntry[] {
  if (renewal.amount <= 0) return [];
  const target: PaymentTarget = { kind: "renewal", campaignId: campaign.id, renewalId: renewal.id };
  const stored = renewal.storedPaymentStatus ?? renewal.paymentStatus;
  if (stored === "received") {
    return [
      legacyStatusEntry(target, {
        gross: renewal.amount,
        paidDate: renewal.paidDate,
        method: renewal.paymentMethod,
        tdsRate: renewal.tdsRate,
        tdsAmount: renewal.tdsAmount,
        bucketFallback: firstDayKey(renewal.startDate),
      }),
    ];
  }
  const advance = invoiceAdvance(linked);
  if (advance <= 0 || !linked) return [];
  return [legacyAdvanceEntry(target, advance, renewal.amount, firstDayKey(linked.issueDate))];
}

/**
 * The entries a standalone invoice's own fields stand for: "paid" is the
 * whole subtotal, otherwise an advance is what it says. A void invoice owes
 * nothing and has none. Never call this for a linked invoice: its money
 * belongs to the deal or renewal it bills.
 */
export function virtualInvoiceEntries(invoice: InvoiceRecord): LedgerEntry[] {
  if (invoice.status === "void") return [];
  const subtotal = roundMoney(computeSubtotal(invoice.items));
  if (subtotal <= 0) return [];
  const target: PaymentTarget = { kind: "invoice", invoiceId: invoice.id };
  const fallback = firstDayKey(invoice.issueDate);
  if (invoice.status === "paid") {
    return [
      legacyStatusEntry(target, {
        gross: subtotal,
        paidDate: "",
        method: "",
        tdsRate: null,
        tdsAmount: null,
        bucketFallback: fallback,
      }),
    ];
  }
  const advance = invoiceAdvance(invoice);
  return advance > 0 ? [legacyAdvanceEntry(target, advance, subtotal, fallback)] : [];
}

// --- Joins -----------------------------------------------------------------

/** Stored payments grouped by paymentTargetKey. */
export function indexPayments(records: PaymentRecord[]): Map<string, PaymentRecord[]> {
  const index = new Map<string, PaymentRecord[]>();
  for (const record of records) {
    const key = paymentTargetKey(record.target);
    const list = index.get(key);
    if (list) list.push(record);
    else index.set(key, [record]);
  }
  return index;
}

/**
 * Which deal or renewal owns each invoice, keyed by invoice id.
 *
 * A deal wins over a renewal, and the first of several deals wins (the rest
 * are reported by ledgerWarnings): one rupee belongs to one target, so an
 * invoice's advance is read onto its owner only.
 */
export function invoiceOwners(campaigns: Campaign[]): Map<string, PaymentTarget> {
  const owners = new Map<string, PaymentTarget>();
  for (const campaign of campaigns) {
    if (campaign.invoiceId && !owners.has(campaign.invoiceId)) {
      owners.set(campaign.invoiceId, { kind: "deal", campaignId: campaign.id });
    }
  }
  for (const campaign of campaigns) {
    for (const renewal of campaign.usage.renewals) {
      if (renewal.invoiceId && !owners.has(renewal.invoiceId)) {
        owners.set(renewal.invoiceId, { kind: "renewal", campaignId: campaign.id, renewalId: renewal.id });
      }
    }
  }
  return owners;
}

/** How many deals point at each invoice id; more than one is reported by ledgerWarnings. */
export function invoiceDealCounts(campaigns: Campaign[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const campaign of campaigns) {
    if (campaign.invoiceId) counts.set(campaign.invoiceId, (counts.get(campaign.invoiceId) ?? 0) + 1);
  }
  return counts;
}

function linkedInvoice(
  invoiceId: string | null | undefined,
  target: PaymentTarget,
  invoices: ReadonlyMap<string, InvoiceRecord>,
  owners: ReadonlyMap<string, PaymentTarget>
): InvoiceRecord | null {
  if (!invoiceId) return null;
  const owner = owners.get(invoiceId);
  if (!owner || !samePaymentTarget(owner, target)) return null;
  return invoices.get(invoiceId) ?? null;
}

function ledgerEntries(stored: PaymentRecord[] | undefined, fallback: string, virtual: () => LedgerEntry[]): LedgerEntry[] {
  return stored && stored.length > 0 ? stored.map((record) => toLedgerEntry(record, fallback)) : virtual();
}

interface ProjectedPaymentFields {
  paymentStatus: CampaignPaymentStatus;
  paidDate: string;
  paymentMethod: string;
  tdsAmount: number | null;
}

/**
 * The legacy payment fields as the ledger reads them. The stored values
 * exactly while there is no stored entry; computed from the settlement once
 * there is.
 */
export function projectPaymentFields(
  settlement: Settlement,
  stored: ProjectedPaymentFields & { tdsRate: number | null }
): ProjectedPaymentFields {
  if (!settlement.hasStored) {
    return {
      paymentStatus: stored.paymentStatus,
      paidDate: stored.paidDate,
      paymentMethod: stored.paymentMethod,
      tdsAmount: stored.tdsAmount,
    };
  }
  const paid = settlement.status === "paid";
  return {
    paymentStatus: paid ? "received" : "pending",
    paidDate: paid && settlement.paidOn ? toSheetDate(settlement.paidOn) : "",
    paymentMethod: settlement.method,
    tdsAmount: settlement.tds > 0 || stored.tdsRate !== null ? settlement.tds : null,
  };
}

function settleRenewal(
  campaign: Campaign,
  renewal: UsageRenewal,
  invoices: ReadonlyMap<string, InvoiceRecord>,
  owners: ReadonlyMap<string, PaymentTarget>,
  payments: ReadonlyMap<string, PaymentRecord[]>
): UsageRenewal {
  const target: PaymentTarget = { kind: "renewal", campaignId: campaign.id, renewalId: renewal.id };
  const linked = linkedInvoice(renewal.invoiceId, target, invoices, owners);
  const entries = ledgerEntries(payments.get(paymentTargetKey(target)), firstDayKey(renewal.startDate), () =>
    virtualRenewalEntries(campaign, renewal, linked)
  );
  const stored = renewal.storedPaymentStatus;
  const settlement = settle(target, renewal.amount, entries, stored);
  return {
    ...renewal,
    ...projectPaymentFields(settlement, {
      paymentStatus: stored,
      paidDate: renewal.paidDate,
      paymentMethod: renewal.paymentMethod,
      tdsAmount: renewal.tdsAmount,
      tdsRate: renewal.tdsRate,
    }),
    settlement,
  };
}

/**
 * Every deal and renewal settled against the ledger: stored payments when it
 * has any, its virtual legacy entries otherwise, and its payment fields
 * projected from the result.
 *
 * Takes deals as toCampaign produced them (whose `storedPaymentStatus` is
 * what was stored) and is safe to run on its own output again.
 */
export function attachSettlements(
  campaigns: Campaign[],
  invoices: InvoiceRecord[],
  payments: PaymentRecord[]
): Campaign[] {
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const owners = invoiceOwners(campaigns);
  const index = indexPayments(payments);

  return campaigns.map((campaign) => {
    const usage = {
      ...campaign.usage,
      renewals: campaign.usage.renewals.map((renewal) =>
        settleRenewal(campaign, renewal, invoiceById, owners, index)
      ),
    };
    const stored = campaign.storedPaymentStatus;
    if (!campaignTypeHasCash(campaign.type)) {
      return { ...campaign, usage, settlement: null };
    }

    const target: PaymentTarget = { kind: "deal", campaignId: campaign.id };
    const linked = linkedInvoice(campaign.invoiceId, target, invoiceById, owners);
    const entries = ledgerEntries(
      index.get(paymentTargetKey(target)),
      firstDayKey(campaign.uploadDate, campaign.date),
      () => virtualDealEntries(campaign, linked)
    );
    const settlement = settle(target, campaign.cash, entries, stored);
    return {
      ...campaign,
      ...projectPaymentFields(settlement, {
        paymentStatus: stored,
        paidDate: campaign.paidDate,
        paymentMethod: campaign.paymentMethod,
        tdsAmount: campaign.tdsAmount,
        tdsRate: campaign.tdsRate,
      }),
      usage,
      settlement,
      barterState: barterState(campaign.type, stored, campaign.barterStatus, settlement),
    };
  });
}

/** A standalone invoice settled from its stored payments, or its own fields while it has none. */
export function invoiceOwnSettlement(invoice: InvoiceRecord, stored: PaymentRecord[]): Settlement {
  const target: PaymentTarget = { kind: "invoice", invoiceId: invoice.id };
  const owed = invoice.status === "void" ? 0 : roundMoney(computeSubtotal(invoice.items));
  const entries = ledgerEntries(stored, firstDayKey(invoice.issueDate), () => virtualInvoiceEntries(invoice));
  return settle(target, owed, entries, invoice.status === "paid" ? "received" : "pending");
}

function ownerSettlement(owner: PaymentTarget, campaigns: ReadonlyMap<string, Campaign>): Settlement | null {
  if (owner.kind === "invoice") return null;
  const campaign = campaigns.get(owner.campaignId);
  if (!campaign) return null;
  if (owner.kind === "deal") {
    // A barter-only deal owes no cash, so its invoice settles nothing.
    return campaign.settlement ?? settle(owner, 0, [], campaign.storedPaymentStatus);
  }
  return campaign.usage.renewals.find((renewal) => renewal.id === owner.renewalId)?.settlement ?? null;
}

/** The status an invoice reads as once its settlement is projected onto it. */
export function projectInvoiceStatus(storedStatus: InvoiceStatus, settlement: Settlement): InvoiceStatus {
  if (storedStatus === "void") return "void";
  if (settlement.status === "paid") return "paid";
  if (storedStatus === "paid") return "sent";
  return storedStatus;
}

/**
 * Every invoice with its owner and settlement joined on, and its status and
 * balance derived from that settlement: a paid invoice owes nothing, and a
 * linked invoice follows the deal or renewal it bills.
 */
export function attachInvoiceSettlements(
  invoices: Invoice[],
  campaigns: Campaign[],
  payments: PaymentRecord[]
): Invoice[] {
  const owners = invoiceOwners(campaigns);
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const index = indexPayments(payments);

  return invoices.map((invoice) => {
    const owner = owners.get(invoice.id) ?? null;
    const settlement =
      (owner && ownerSettlement(owner, campaignById)) ??
      invoiceOwnSettlement(invoice, index.get(paymentTargetKey({ kind: "invoice", invoiceId: invoice.id })) ?? []);
    const storedStatus = invoice.storedStatus;
    const status = projectInvoiceStatus(storedStatus, settlement);
    const balanceDue =
      status === "paid" || status === "void" ? 0 : Math.max(0, roundMoney(invoice.subtotal - settlement.settled));
    return { ...invoice, owner, settlement, status, balanceDue };
  });
}

/** Whether a payment's target still exists among the live deals and invoices. */
export function isPaymentTargetLive(
  target: PaymentTarget,
  campaigns: Pick<Campaign, "id" | "usage">[],
  invoices: Pick<InvoiceRecord, "id">[]
): boolean {
  if (target.kind === "invoice") return invoices.some((invoice) => invoice.id === target.invoiceId);
  const campaign = campaigns.find((entry) => entry.id === target.campaignId);
  if (!campaign) return false;
  if (target.kind === "deal") return true;
  return campaign.usage.renewals.some((renewal) => renewal.id === target.renewalId);
}

/** Stored payments whose deal, renewal or invoice no longer exists. */
export function findOrphanPayments(
  payments: PaymentRecord[],
  campaigns: Campaign[],
  invoices: InvoiceRecord[]
): PaymentRecord[] {
  return payments.filter((payment) => !isPaymentTargetLive(payment.target, campaigns, invoices));
}

// --- The book as rows -----------------------------------------------------------

/** One payment as the Payments page and the year's export list it. */
export interface LedgerRow {
  paymentId: string;
  target: PaymentTarget;
  /** Start year of the financial year it is filed in; null when it has no date to file by. */
  fy: number | null;
  /** The day the money arrived, or "" for an undated payment from an earlier record. */
  date: string;
  /** `date`, else the day its deal, renewal or invoice is filed under. */
  bucketDate: string;
  brand: string;
  /** "IG Page", "IG Page · usage renewal", "Invoice MSP-INV-0009". */
  targetLabel: string;
  /** The deal a deal or renewal row belongs to, by the name the campaigns table finds it under; null for an invoice. */
  deal: string | null;
  gross: number;
  tds: number;
  fee: number;
  net: number;
  receivedInto: Payer | null;
  method: PaymentMethod | null;
  reference: string;
  /** "legacy" for a payment from an earlier record, stored or not. */
  origin: PaymentRecord["origin"];
  source: LedgerEntry["source"];
}

function toLedgerRow(entry: LedgerEntry, brand: string, targetLabel: string, deal: string | null): LedgerRow {
  return {
    paymentId: entry.id,
    target: entry.target,
    fy: entry.bucketDate ? financialYearStart(entry.bucketDate) : null,
    date: entry.date,
    bucketDate: entry.bucketDate,
    brand,
    targetLabel,
    deal,
    gross: entry.gross,
    tds: entry.tds,
    fee: entry.bankFee,
    net: entry.net,
    receivedInto: entry.receivedInto,
    method: entry.method,
    reference: entry.reference,
    origin: entry.origin,
    source: entry.source,
  };
}

/**
 * Every payment the book counts as income, newest first: the same entries,
 * under the same rules, as summarizeEarnings counts in `paid`, so a year's
 * rows always add up to that year's earnings.
 *
 * So a called-off deal lists only payments recorded against it, and a
 * standalone invoice only its recorded ones, never an old "Paid" set by hand.
 * A linked invoice has no rows of its own: its money is its deal's.
 */
export function ledgerRows(campaigns: Campaign[], invoices: Invoice[]): LedgerRow[] {
  const rows: LedgerRow[] = [];
  const add = (
    settlement: Settlement | null,
    storedOnly: boolean,
    brand: string,
    targetLabel: string,
    deal: string | null
  ) => {
    for (const entry of settlement?.entries ?? []) {
      if (storedOnly && entry.source !== "stored") continue;
      rows.push(toLedgerRow(entry, brand, targetLabel, deal));
    }
  };

  for (const campaign of campaigns) {
    const calledOff = isCampaignCalledOff(campaign.status);
    const name = campaignLabel(campaign.campaign, campaign.brand);
    add(campaign.settlement, calledOff, campaign.brand, name, name);
    for (const renewal of campaign.usage.renewals) {
      if (renewal.amount <= 0) continue;
      add(renewal.settlement, calledOff, campaign.brand, `${name} · usage renewal`, name);
    }
  }
  for (const invoice of invoices) {
    if (invoice.owner) continue;
    const label = `Invoice ${buildInvoiceNumber(invoice.invoiceNo)}`;
    add(invoice.settlement, true, invoice.client.name.trim() || label, label, null);
  }

  return rows.sort(
    (a, b) => b.bucketDate.localeCompare(a.bucketDate) || a.targetLabel.localeCompare(b.targetLabel)
  );
}

/** What a set of rows adds up to: the totals line of the Payments page and the export. */
export function sumLedgerRows(rows: LedgerRow[]): { gross: number; tds: number; fee: number; net: number } {
  return {
    gross: sumMoney(rows.map((row) => row.gross)),
    tds: sumMoney(rows.map((row) => row.tds)),
    fee: sumMoney(rows.map((row) => row.fee)),
    net: sumMoney(rows.map((row) => row.net)),
  };
}

// --- Barter and display ------------------------------------------------------

/** Whether a deal's barter half was delivered; see deriveBarterState. */
export function barterState(
  type: CampaignType,
  storedPaymentStatus: CampaignPaymentStatus,
  barterStatus: CampaignPaymentStatus | undefined,
  cash: Settlement | null
): CampaignPaymentStatus | null {
  return deriveBarterState(
    campaignTypeHasCash(type),
    campaignTypeHasBarter(type),
    storedPaymentStatus,
    barterStatus,
    cash
  );
}

// Lives with the other invoice status helpers; re-exported for the ledger's callers.
export { invoiceDisplayStatus } from "@/lib/invoice";

const SETTLEMENT_LABELS: Record<Settlement["status"], string> = {
  paid: "Paid",
  partial: "Partially paid",
  pending: "Pending",
  unknown: "Not tracked",
};

export function settlementLabel(settlement: Pick<Settlement, "status">): string {
  return SETTLEMENT_LABELS[settlement.status];
}

/** "₹ 20,000 of ₹ 50,000 received". */
export function settlementSummary(settlement: Pick<Settlement, "settled" | "owed">): string {
  return `${formatMoney(settlement.settled)} of ${formatMoney(settlement.owed)} received`;
}

export type LedgerWarningCode =
  | "overpaid"
  | "invoice-total-differs"
  | "void-invoice-has-payments"
  | "double-owner"
  | "no-payer";

export interface LedgerWarning {
  code: LedgerWarningCode;
  message: string;
}

/** What the owner should look at on a target, in the order it matters. */
export function ledgerWarnings(args: {
  settlement: Settlement;
  invoice?: Pick<Invoice, "status" | "storedStatus" | "subtotal" | "owner">;
  /** How many deals point at the invoice, when `invoice` is given. */
  invoiceDealCount?: number;
}): LedgerWarning[] {
  const { settlement, invoice } = args;
  const warnings: LedgerWarning[] = [];
  if (settlement.overpaid > 0) {
    warnings.push({
      code: "overpaid",
      message: `${formatMoney(settlement.overpaid)} more was received than this is worth. Fix the amount or note why.`,
    });
  }
  if (invoice) {
    const isVoid = invoice.storedStatus === "void";
    if (isVoid && settlement.target.kind === "invoice" && settlement.hasStored) {
      warnings.push({ code: "void-invoice-has-payments", message: "This invoice is void but has payments recorded." });
    }
    if (!isVoid && invoice.owner && roundMoney(invoice.subtotal) !== settlement.owed) {
      warnings.push({
        code: "invoice-total-differs",
        message: `The invoice totals ${formatMoney(invoice.subtotal)} but ${formatMoney(settlement.owed)} is owed.`,
      });
    }
    if ((args.invoiceDealCount ?? 0) > 1) {
      warnings.push({ code: "double-owner", message: "More than one deal is linked to this invoice." });
    }
  }
  if (settlement.entries.some((entry) => entry.source === "stored" && entry.receivedInto === null)) {
    warnings.push({ code: "no-payer", message: "A payment doesn't say whose account it landed in." });
  }
  return warnings;
}

// --- Suggestions and validation ----------------------------------------------

/**
 * What a one-click "received" or a fresh payment form starts from: today, the
 * whole remaining amount, TDS at the expected rate, and the account and
 * method last used (Business funds when there is none).
 */
export function suggestPayment(
  settlement: Pick<Settlement, "remaining">,
  expectedTdsRate: number | null,
  last: { receivedInto: Payer | null; method: PaymentMethod | null } | null,
  today: string
): Omit<PaymentInput, "id" | "target"> {
  const gross = roundMoney(settlement.remaining);
  const rate = expectedTdsRate !== null && Number.isFinite(expectedTdsRate) && expectedTdsRate > 0 ? expectedTdsRate : 0;
  return {
    date: today,
    gross,
    tds: roundMoney((gross * rate) / 100),
    bankFee: 0,
    receivedInto: last?.receivedInto ?? "business",
    method: last?.method ?? null,
    reference: "",
    note: "",
  };
}

export const ALREADY_PAID_IN_FULL = "Already paid in full";

/** Refuses a payment that settles more than is owed, saying by how much. */
export function overpayMessage(excess: number, remaining: number): string {
  return `That is ${formatMoney(excess)} more than the ${formatMoney(remaining)} still owed. Raise the deal amount first if the brand paid more.`;
}

export interface PaymentValidationContext {
  mode: "create" | "update";
  targetState: "ok" | "missing" | "no-cash" | "linked-invoice" | "void-invoice";
  owed: number;
  settledExcludingThis: number;
  /** The gross being replaced; 0 on create. */
  previousGross: number;
  /** yyyy-mm-dd, IST. */
  today: string;
  existingTarget: PaymentTarget | null;
}

/** The earliest day a payment can be dated: the start of FY 2015-16. */
export const EARLIEST_PAYMENT_DAY = "2015-04-01";
/** One crore: no single payment to a creator is larger, so anything above is a typo. */
export const MAX_PAYMENT_GROSS = 1_00_00_000;

function isRoundedAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && roundMoney(value) === value;
}

function targetStateError(input: PaymentInput, ctx: PaymentValidationContext): string | null {
  switch (ctx.targetState) {
    case "missing":
      return "This deal, renewal or invoice no longer exists";
    case "no-cash":
      return input.target.kind === "renewal"
        ? "This renewal was free"
        : "This deal is barter only: there is no cash to record";
    case "linked-invoice":
      return "This invoice belongs to a deal. Record the payment on the deal.";
    case "void-invoice":
      return "This invoice is void";
    case "ok":
      break;
  }
  if (ctx.mode === "update" && ctx.existingTarget && !samePaymentTarget(ctx.existingTarget, input.target)) {
    return "A payment can't be moved to another deal";
  }
  return null;
}

/**
 * The first thing wrong with a payment, as a sentence to show beside the
 * form, or null when it can be saved. Shared by the form and the server, so
 * both refuse the same things in the same order.
 */
export function validatePayment(input: PaymentInput, ctx: PaymentValidationContext): string | null {
  const targetError = targetStateError(input, ctx);
  if (targetError) return targetError;

  if (!isDayKey(input.date)) return "Pick the date the money arrived";
  if (input.date > ctx.today) return "Payments can't be dated in the future";
  if (input.date < EARLIEST_PAYMENT_DAY) return "That date is too early";

  const { gross, tds, bankFee } = input;
  if (!isRoundedAmount(gross) || gross <= 0 || gross > MAX_PAYMENT_GROSS) {
    return "Enter the amount settled, up to two decimals";
  }
  if (!isRoundedAmount(tds) || !isRoundedAmount(bankFee)) {
    return "Enter TDS and charges as zero or more, up to two decimals";
  }
  if (roundMoney(tds + bankFee) > gross) return "TDS and charges can't be more than the amount settled";

  const excess = roundMoney(ctx.settledExcludingThis + gross - ctx.owed);
  if (excess > 0 && (ctx.mode === "create" || gross > ctx.previousGross)) {
    const remaining = Math.max(0, roundMoney(ctx.owed - ctx.settledExcludingThis));
    if (remaining <= 0 && ctx.mode === "create") return ALREADY_PAID_IN_FULL;
    return overpayMessage(excess, remaining);
  }

  if (!isPayer(input.receivedInto)) return "Choose whose account it landed in";
  if (input.method !== null && !isPaymentMethod(input.method)) return "Choose a payment method from the list";

  if (input.reference.length > PAYMENT_REFERENCE_MAX) {
    return `Keep the reference to ${PAYMENT_REFERENCE_MAX} characters`;
  }
  if (input.note.length > PAYMENT_NOTE_MAX) return `Keep the note to ${PAYMENT_NOTE_MAX} characters`;
  return null;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Server only: a new payment's id must be the client's UUID v4, never a
 * virtual entry's id. The id is what makes a double tap save once.
 */
export function validateNewPaymentId(id: string): string | null {
  if (isVirtualEntryId(id) || !UUID_V4.test(id)) return "This payment's id isn't valid. Reopen the form and try again.";
  return null;
}
