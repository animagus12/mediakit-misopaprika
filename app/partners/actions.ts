"use server";

import { todayKey } from "@/lib/day";
import { formatMoney } from "@/lib/invoice";
import { settleUpLabel, validateSettleUp } from "@/lib/partners";
import { isPartner, isPartnerSettlement, otherPartner, payerLabel, toPayer, type Partner, type PartnerSettlement } from "@/lib/payers";
import { revalidateStores } from "@/lib/revalidation";
import { requireSession } from "@/lib/session.server";
import { recordActivity } from "@/repositories/activity.writer.server";
import { getEditorTransactionRecord, setEditorTransactionSettlement } from "@/repositories/editorTransactions.writer.server";
import { readExpenseRecords } from "@/repositories/expenseRecords.server";
import { setExpenseSettlement } from "@/repositories/expenses.writer.server";
import { readPartnerTransfers } from "@/repositories/partnerTransferRecords.server";
import type { PartnerTransferInput, PartnerTransferRecord } from "@/repositories/partnerTransfers";
import { addPartnerTransfer, deletePartnerTransfer } from "@/repositories/partnerTransfers.writer.server";
import { activateTrashEntry, addTrashEntry, removeTrashEntry } from "@/repositories/trash.writer.server";

type Fail = { success: false; error: string };

function failure(err: unknown, fallback: string): Fail {
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

/** How the feed words a settlement decision on a cost a partner paid. */
function settlementDetail(paidBy: Partner, settlement: PartnerSettlement | null): string {
  const who = `Paid by ${payerLabel(paidBy)}`;
  if (settlement === "business") return `${who}, repaid from business funds`;
  if (settlement === "split") return `${who}, split 50/50 with ${payerLabel(otherPartner(paidBy))}`;
  return `${who}, settlement undecided`;
}

const BUSINESS_PAID = "The business account paid this, so there's nothing to settle";

/**
 * Settles a cost a partner paid out of their own pocket: repaid from business
 * funds, split 50/50, or back to undecided (null). Written on the cost itself,
 * the expense or the editor job, where it was recorded.
 */
export async function settlePartnerCost(input: {
  source: "expense" | "editing";
  id: string;
  settlement: PartnerSettlement | null;
}): Promise<{ success: true } | Fail> {
  const denied = await requireSession();
  if (denied) return denied;
  if (input.settlement !== null && !isPartnerSettlement(input.settlement)) {
    return { success: false, error: "Choose how it is settled" };
  }

  try {
    if (input.source === "expense") {
      const expense = (await readExpenseRecords()).find((entry) => entry.id === input.id);
      if (!expense) return { success: false, error: "This expense no longer exists" };
      if (!isPartner(expense.paidBy)) return { success: false, error: BUSINESS_PAID };
      await setExpenseSettlement(expense.id, input.settlement);
      revalidateStores("expenses");
      await recordActivity({
        action: "expense.updated",
        entity: { type: "expense", id: expense.id, label: expense.description },
        detail: settlementDetail(expense.paidBy, input.settlement),
        amount: expense.amount,
      });
    } else {
      const record = await getEditorTransactionRecord(input.id);
      if (!record) return { success: false, error: "This editor payment no longer exists" };
      const paidBy = toPayer(record.paidBy);
      if (!isPartner(paidBy)) return { success: false, error: BUSINESS_PAID };
      await setEditorTransactionSettlement(record.id, input.settlement);
      revalidateStores("editorTransactions");
      await recordActivity({
        action: "editorTransaction.updated",
        entity: { type: "editorTransaction", id: record.id, label: record.video },
        detail: settlementDetail(paidBy, input.settlement),
        amount: record.amount ?? undefined,
      });
    }
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't settle it");
  }
}

/** Records money moving to settle up: the business repaying a partner, or one partner paying the other. */
export async function recordSettleUp(input: PartnerTransferInput): Promise<{ success: true } | Fail> {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    const settleUp: PartnerTransferInput = { ...input, note: typeof input.note === "string" ? input.note.trim() : "" };
    const problem = validateSettleUp(settleUp, todayKey());
    if (problem) throw new Error(problem);
    const { record, created } = await addPartnerTransfer(settleUp);
    revalidateStores("partnerTransfers");
    if (created) {
      await recordActivity({
        action: "partnerTransfer.recorded",
        entity: { type: "partnerTransfer", id: record.id, label: settleUpLabel(record) },
        detail: record.note || undefined,
        amount: record.amount,
      });
    }
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't record the settle-up");
  }
}

/** Moves a settle-up to Trash; the toast's Undo restores it from there. */
export async function deleteSettleUp(id: string): Promise<{ success: true; trashId: string } | Fail> {
  const denied = await requireSession();
  if (denied) return denied;
  // Trash holds a copy before the settle-up goes (see deleteExpense).
  let trashId: string | null = null;
  let removed: PartnerTransferRecord | null = null;
  try {
    const record = (await readPartnerTransfers()).find((entry) => entry.id === id);
    if (!record) return { success: false, error: "This settle-up no longer exists" };
    trashId = await addTrashEntry(
      { type: "partnerTransfer", record },
      `${settleUpLabel(record)} ${formatMoney(record.amount)}`
    );
    removed = await deletePartnerTransfer(id);
    if (!removed) {
      await removeTrashEntry(trashId);
      return { success: false, error: "This settle-up no longer exists" };
    }
    await activateTrashEntry(trashId);
    revalidateStores("partnerTransfers");
    await recordActivity({
      action: "partnerTransfer.deleted",
      entity: { type: "partnerTransfer", id: removed.id, label: settleUpLabel(removed) },
      amount: removed.amount,
    });
    return { success: true, trashId };
  } catch (err) {
    if (trashId) {
      if (removed) await activateTrashEntry(trashId).catch(() => undefined);
      else await removeTrashEntry(trashId).catch(() => undefined);
    }
    return failure(err, "Couldn't delete the settle-up");
  }
}
