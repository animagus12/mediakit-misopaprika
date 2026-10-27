"use server";

import { describeChanges } from "@/lib/activityDiff";
import { paymentFields } from "@/lib/activityFields";
import { todayKey } from "@/lib/day";
import { ALREADY_PAID_IN_FULL, suggestPayment } from "@/lib/payments";
import { revalidateStores } from "@/lib/revalidation";
import { requireSession } from "@/lib/session.server";
import { recordActivity } from "@/repositories/activity.writer.server";
import { readCampaignLedger } from "@/repositories/campaigns.writer.server";
import {
  deleteTargetPayment,
  editTargetPayment,
  lastUsedPayment,
  paymentActivity as activityFor,
  recordTargetPayment,
  targetContext,
} from "@/repositories/paymentLedger.server";
import type { PaymentInput, PaymentTarget } from "@/repositories/payments";
import { removePayment } from "@/repositories/payments.writer.server";
import { activateTrashEntry, addTrashEntry, removeTrashEntry } from "@/repositories/trash.writer.server";

type Fail = { success: false; error: string };

function failure(err: unknown, fallback: string): Fail {
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

// Every payment write moves money figures everywhere, and a first write on a
// target also clears its legacy fields on the deal or invoice.
function revalidatePayments(): void {
  revalidateStores("payments", "campaigns", "invoices");
}

export async function recordPayment(
  input: PaymentInput
): Promise<{ success: true; paymentId: string; warning?: string } | Fail> {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    const { result, ctx, warning } = await recordTargetPayment(input);
    revalidatePayments();
    await recordActivity({ action: "payment.recorded", ...activityFor(result, ctx) });
    return { success: true, paymentId: result.id, warning };
  } catch (err) {
    return failure(err, "Couldn't record the payment");
  }
}

export async function updatePayment(
  input: PaymentInput
): Promise<{ success: true; paymentId: string; warning?: string } | Fail> {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    const { result, ctx, warning } = await editTargetPayment(input);
    revalidatePayments();
    await recordActivity({
      action: "payment.updated",
      ...activityFor(result.after, ctx),
      detail: describeChanges(result, paymentFields) ?? activityFor(result.after, ctx).detail,
    });
    return { success: true, paymentId: result.after.id, warning };
  } catch (err) {
    return failure(err, "Couldn't save the payment");
  }
}

/** Moves a payment to Trash; the toast's Undo restores it from there. */
export async function deletePayment(
  id: string
): Promise<{ success: true; trashId: string; warning?: string } | Fail> {
  const denied = await requireSession();
  if (denied) return denied;
  let trashId: string | null = null;
  try {
    const { result, ctx, warning } = await deleteTargetPayment(id);
    trashId = await addTrashEntry({ type: "payment", record: result, targetLabel: ctx.label }, `Payment for ${ctx.label}`);
    await activateTrashEntry(trashId);
    revalidatePayments();
    await recordActivity({ action: "payment.deleted", ...activityFor(result, ctx) });
    return { success: true, trashId, warning };
  } catch (err) {
    if (trashId) await removeTrashEntry(trashId).catch(() => undefined);
    return failure(err, "Couldn't delete the payment");
  }
}

/**
 * The one-click "received" on a payments-due or renewal row: everything still
 * owed, dated today, TDS at the expected rate, with the method last used for
 * this brand. `clientId` makes a double tap save once.
 */
export async function markTargetReceived(
  target: PaymentTarget,
  clientId: string
): Promise<{ success: true; paymentId: string; gross: number; warning?: string } | Fail> {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    const ledger = await readCampaignLedger();
    const ctx = targetContext(target, ledger);
    const already = ledger.payments.find((record) => record.id === clientId);
    if (!already && ctx.settlement.remaining <= 0) return { success: false, error: ALREADY_PAID_IN_FULL };
    const suggestion = suggestPayment(ctx.settlement, ctx.expectedTdsRate, lastUsedPayment(ledger, ctx.brandId), todayKey());
    const { result, warning } = await recordTargetPayment({ id: clientId, target, ...suggestion });
    revalidatePayments();
    if (!already) await recordActivity({ action: "payment.recorded", ...activityFor(result, ctx) });
    return {
      success: true,
      paymentId: result.id,
      gross: result.gross,
      warning,
    };
  } catch (err) {
    return failure(err, "Couldn't mark it received");
  }
}

/**
 * Undo for markTargetReceived: removes exactly the payment it recorded. A hard
 * delete rather than Trash, since the payment existed for a few seconds. Old
 * payments written into the ledger by that click stay, so the target reads as
 * it did, just from the ledger now.
 */
export async function undoMarkReceived(paymentId: string): Promise<{ success: true } | Fail> {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    const ledger = await readCampaignLedger();
    const record = ledger.payments.find((entry) => entry.id === paymentId);
    if (!record) return { success: true };
    const ctx = targetContext(record.target, ledger);
    await removePayment(paymentId);
    revalidatePayments();
    await recordActivity({ action: "payment.deleted", ...activityFor(record, ctx), detail: "Undone" });
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't undo that");
  }
}
