import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { campaignLabel } from "@/lib/campaigns";
import { todayKey } from "@/lib/day";
import { buildInvoiceNumber, formatMoney } from "@/lib/invoice";
import {
  attachInvoiceSettlements,
  validateNewPaymentId,
  validatePayment,
  type PaymentValidationContext,
} from "@/lib/payments";
import { payerLabel, type Payer, type PaymentMethod } from "@/lib/payers";
import type { RecordChange } from "@/lib/activityDiff";
import type { ActivityEntity } from "./activity";
import { campaignTypeHasCash } from "./campaigns";
import {
  demoteCampaignLegacyPayment,
  readCampaignLedger,
  type CampaignLedger,
} from "./campaigns.writer.server";
import { toInvoice } from "./invoices";
import { clearInvoiceLegacyPayment } from "./invoices.writer.server";
import {
  parseVirtualEntryId,
  paymentNet,
  paymentTargetKey,
  samePaymentTarget,
  settle,
  type LedgerEntry,
  type LegacyKind,
  type PaymentInput,
  type PaymentRecord,
  type PaymentTarget,
  type Settlement,
} from "./payments";
import { insertPayments, removePayment, replacePayment } from "./payments.writer.server";

// The one module that writes payments together with the deals, renewals and
// invoices they settle. Nothing imports it but the server actions.
//
// A target that has never had a payment recorded reads its legacy fields (a
// stored "received", an invoice advance) as virtual entries (lib/payments.ts).
// The first time one of its payments is recorded, edited or deleted, those
// virtual entries are written into the ledger as real records ("legacy"
// origin), and then the legacy fields are cleared so they cannot come back.
// That clearing is the only write to those fields outside the forms, and it
// only follows a user action on the same target. If it fails, the legacy
// fields stay but have no effect: a target with any stored payment never
// reads its virtual entries (see ledgerEntries in lib/payments.ts).

export interface TargetContext {
  target: PaymentTarget;
  settlement: Settlement;
  /** How the target is named in activity: "IG Page", "IG Page · renewal R0002", "Invoice MSP-INV-0009". */
  label: string;
  brand: string;
  brandId: string | null;
  expectedTdsRate: number | null;
  state: PaymentValidationContext["targetState"];
  /** The deal or invoice the payment belongs to, for activity. */
  parent: ActivityEntity;
  /** The invoice whose advance a virtual entry stands for, if any. */
  advanceInvoiceId: string | null;
}

export const LEGACY_DEMOTION_WARNING =
  "Saved. The old payment status couldn't be cleared; it has no effect while this payment exists.";

function missingContext(target: PaymentTarget, ledger: CampaignLedger): TargetContext {
  const campaign = target.kind === "invoice" ? undefined : ledger.campaigns.find((entry) => entry.id === target.campaignId);
  return {
    target,
    settlement: settle(target, 0, [], "unknown"),
    label: campaign ? campaignLabel(campaign.campaign, campaign.brand) : "a deleted record",
    brand: campaign?.brand ?? "",
    brandId: campaign?.brandId ?? null,
    expectedTdsRate: null,
    state: "missing",
    parent: { type: target.kind === "invoice" ? "invoice" : "campaign", id: null, label: "a deleted record" },
    advanceInvoiceId: null,
  };
}

/** Everything the actions need to know about where a payment goes, read in one pass. */
export function targetContext(target: PaymentTarget, ledger: CampaignLedger): TargetContext {
  if (target.kind === "invoice") {
    const invoices = attachInvoiceSettlements(ledger.invoices.map(toInvoice), ledger.campaigns, ledger.payments);
    const invoice = invoices.find((entry) => entry.id === target.invoiceId);
    if (!invoice) return missingContext(target, ledger);
    const label = `Invoice ${buildInvoiceNumber(invoice.invoiceNo)}`;
    return {
      target,
      settlement: invoice.settlement,
      label,
      brand: invoice.client.name,
      brandId: invoice.brandId,
      expectedTdsRate: null,
      state: invoice.owner ? "linked-invoice" : invoice.storedStatus === "void" ? "void-invoice" : "ok",
      parent: { type: "invoice", id: invoice.id, label },
      advanceInvoiceId: invoice.id,
    };
  }

  const campaign = ledger.campaigns.find((entry) => entry.id === target.campaignId);
  if (!campaign) return missingContext(target, ledger);
  const dealLabel = campaignLabel(campaign.campaign, campaign.brand);
  const parent: ActivityEntity = { type: "campaign", id: campaign.id, label: dealLabel };

  if (target.kind === "deal") {
    const settlement = campaign.settlement;
    return {
      target,
      settlement: settlement ?? settle(target, 0, [], campaign.storedPaymentStatus),
      label: dealLabel,
      brand: campaign.brand,
      brandId: campaign.brandId,
      expectedTdsRate: campaign.tdsRate,
      state: campaignTypeHasCash(campaign.type) && campaign.cash > 0 ? "ok" : "no-cash",
      parent,
      advanceInvoiceId: campaign.invoiceId,
    };
  }

  const renewal = campaign.usage.renewals.find((entry) => entry.id === target.renewalId);
  if (!renewal) return missingContext(target, ledger);
  return {
    target,
    settlement: renewal.settlement,
    label: `${dealLabel} · renewal ${renewal.id}`,
    brand: campaign.brand,
    brandId: campaign.brandId,
    expectedTdsRate: renewal.tdsRate ?? campaign.tdsRate,
    state: renewal.amount > 0 ? "ok" : "no-cash",
    parent,
    advanceInvoiceId: renewal.invoiceId || null,
  };
}

export async function loadTargetContext(target: PaymentTarget): Promise<TargetContext> {
  return targetContext(target, await readCampaignLedger());
}

// A virtual entry's stored copy always gets the same id, derived from the
// virtual one: two overlapping saves (a double tap, a second tab) then write
// the same record, which insertPayments treats as one, rather than two copies
// of the same old payment. Formatted as a UUID v4 like every other id.
function materialisedId(virtualId: string): string {
  const hex = createHash("sha256").update(virtualId).digest("hex");
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function fromInput(input: PaymentInput, origin: PaymentRecord["origin"]): PaymentRecord {
  return {
    id: input.id,
    target: input.target,
    date: input.date,
    gross: input.gross,
    tds: input.tds,
    bankFee: input.bankFee,
    receivedInto: input.receivedInto,
    method: input.method,
    reference: input.reference.trim(),
    note: input.note.trim(),
    origin,
    createdAt: "",
    updatedAt: "",
  };
}

interface Materialised {
  records: PaymentRecord[];
  /** Stored id for each virtual entry's id. */
  ids: Map<string, string>;
  kinds: Set<LegacyKind>;
}

/**
 * The target's virtual entries as stored records, or none when the target
 * already has stored payments. `edited` replaces the values of the virtual
 * entry with its id, keeping it marked as from an earlier record.
 */
function materialise(ctx: TargetContext, edited?: PaymentInput): Materialised {
  const result: Materialised = { records: [], ids: new Map(), kinds: new Set() };
  if (ctx.settlement.hasStored) return result;
  for (const entry of ctx.settlement.entries) {
    if (entry.source !== "virtual") continue;
    const id = materialisedId(entry.id);
    result.ids.set(entry.id, id);
    if (entry.legacyKind) result.kinds.add(entry.legacyKind);
    result.records.push(
      edited && edited.id === entry.id
        ? fromInput({ ...edited, id, target: ctx.target }, "legacy")
        : {
            id,
            target: ctx.target,
            date: entry.date,
            gross: entry.gross,
            tds: entry.tds,
            bankFee: 0,
            receivedInto: null,
            method: entry.method,
            reference: "",
            note: "",
            origin: "legacy",
            createdAt: "",
            updatedAt: "",
          }
    );
  }
  return result;
}

/** Clears the legacy fields the target's virtual entries stood for; a warning when that fails. */
async function demoteLegacySources(ctx: TargetContext, kinds: ReadonlySet<LegacyKind>): Promise<string | undefined> {
  if (kinds.size === 0) return undefined;
  try {
    const { target } = ctx;
    if (kinds.has("status")) {
      if (target.kind === "deal") await demoteCampaignLegacyPayment(target.campaignId, null);
      else if (target.kind === "renewal") await demoteCampaignLegacyPayment(target.campaignId, target.renewalId);
    }
    const invoiceId = target.kind === "invoice" ? target.invoiceId : ctx.advanceInvoiceId;
    if (invoiceId && (kinds.has("advance") || (target.kind === "invoice" && kinds.has("status")))) {
      await clearInvoiceLegacyPayment(invoiceId, {
        advance: kinds.has("advance"),
        paid: target.kind === "invoice" && kinds.has("status"),
      });
    }
    return undefined;
  } catch {
    return LEGACY_DEMOTION_WARNING;
  }
}

function owedMap(ctx: TargetContext): Map<string, number> {
  return new Map([[paymentTargetKey(ctx.target), ctx.settlement.owed]]);
}

function assertValid(input: PaymentInput, ctx: TargetContext, entry: LedgerEntry | null): void {
  const error = validatePayment(input, {
    mode: entry ? "update" : "create",
    targetState: ctx.state,
    owed: ctx.settlement.owed,
    settledExcludingThis: ctx.settlement.settled - (entry?.gross ?? 0),
    previousGross: entry?.gross ?? 0,
    today: todayKey(),
    existingTarget: entry?.target ?? null,
  });
  if (error) throw new Error(error);
}

export interface PaymentWrite<T> {
  result: T;
  ctx: TargetContext;
  warning?: string;
}

/** Records a new payment. Saving the same id twice answers the first save. */
export async function recordTargetPayment(input: PaymentInput): Promise<PaymentWrite<PaymentRecord>> {
  const idError = validateNewPaymentId(input.id);
  if (idError) throw new Error(idError);

  const ledger = await readCampaignLedger();
  const ctx = targetContext(input.target, ledger);
  const already = ledger.payments.find((record) => record.id === input.id);
  if (already) {
    if (!samePaymentTarget(already.target, input.target)) throw new Error("This payment was already saved for another deal");
    return { result: already, ctx };
  }

  assertValid(input, ctx, null);
  const legacy = materialise(ctx);
  // One write: the old payments and the new one land together or not at all.
  const saved = (await insertPayments([...legacy.records, fromInput(input, "recorded")], { owed: owedMap(ctx) })).at(-1);
  if (!saved) throw new Error("The payment couldn't be saved");
  const warning = await demoteLegacySources(ctx, legacy.kinds);
  return { result: saved, ctx, warning };
}

/** Edits a payment; editing a virtual entry first writes the target's old payments into the ledger. */
export async function editTargetPayment(input: PaymentInput): Promise<PaymentWrite<RecordChange<PaymentRecord>>> {
  const ledger = await readCampaignLedger();
  const ctx = targetContext(input.target, ledger);
  const entry = ctx.settlement.entries.find((candidate) => candidate.id === input.id) ?? null;
  if (!entry) throw new Error("This payment no longer exists");
  assertValid(input, ctx, entry);

  if (entry.source === "virtual") {
    const legacy = materialise(ctx, input);
    const saved = await insertPayments(legacy.records, { owed: owedMap(ctx) });
    const after = saved.find((record) => record.id === legacy.ids.get(entry.id));
    if (!after) throw new Error("The payment couldn't be saved");
    const warning = await demoteLegacySources(ctx, legacy.kinds);
    return { result: { before: entry, after }, ctx, warning };
  }

  const stored = ledger.payments.find((record) => record.id === entry.id);
  if (!stored) throw new Error("This payment no longer exists");
  const change = await replacePayment({ ...fromInput(input, stored.origin), createdAt: stored.createdAt });
  if (!change) throw new Error("This payment no longer exists");
  return { result: change, ctx };
}

/**
 * Deletes a payment and answers the record removed, for Trash. Deleting a
 * virtual entry writes the target's other old payments into the ledger first,
 * so only the one deleted goes.
 */
export async function deleteTargetPayment(id: string): Promise<PaymentWrite<PaymentRecord>> {
  const ledger = await readCampaignLedger();
  const stored = ledger.payments.find((record) => record.id === id);
  const target = stored?.target ?? parseVirtualEntryId(id)?.target;
  if (!target) throw new Error("This payment no longer exists");
  const ctx = targetContext(target, ledger);

  if (stored) {
    const removed = await removePayment(id);
    if (!removed) throw new Error("This payment no longer exists");
    return { result: removed, ctx };
  }

  if (!ctx.settlement.entries.some((entry) => entry.id === id && entry.source === "virtual")) {
    throw new Error("This payment no longer exists");
  }
  const legacy = materialise(ctx);
  await insertPayments(legacy.records);
  const removed = await removePayment(legacy.ids.get(id) ?? "");
  if (!removed) throw new Error("This payment no longer exists");
  const warning = await demoteLegacySources(ctx, legacy.kinds);
  return { result: removed, ctx, warning };
}

/**
 * The account and method the last payment recorded for this brand used, else
 * the last recorded for any brand: what a one-click "received" assumes.
 */
export function lastUsedPayment(
  ledger: CampaignLedger,
  brandId: string | null
): { receivedInto: Payer | null; method: PaymentMethod | null } | null {
  const recorded = ledger.payments
    .filter((record) => record.origin === "recorded" && record.receivedInto !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const brandOf = ({ target }: PaymentRecord): string | null =>
    target.kind === "invoice"
      ? ledger.invoices.find((invoice) => invoice.id === target.invoiceId)?.brandId ?? null
      : ledger.campaigns.find((campaign) => campaign.id === target.campaignId)?.brandId ?? null;
  const pick = (brandId !== null ? recorded.find((record) => brandOf(record) === brandId) : undefined) ?? recorded[0];
  return pick ? { receivedInto: pick.receivedInto, method: pick.method } : null;
}

/** The activity fields a payment event carries: the payment, its deal or invoice, and where the money went. */
export function paymentActivity(record: PaymentRecord, ctx: TargetContext) {
  const into = record.receivedInto ? payerLabel(record.receivedInto) : "an account not recorded";
  return {
    entity: { type: "payment" as const, id: record.id, label: ctx.label },
    parent: ctx.parent,
    detail: `${ctx.brand.trim() || ctx.label} · Net ${formatMoney(paymentNet(record))} into ${into}`,
    amount: record.gross,
  };
}

/** A fresh id for a payment the server creates itself (a deal or renewal recorded as already received). */
export function newPaymentId(): string {
  return randomUUID();
}
