"use server";

import { describeChanges } from "@/lib/activityDiff";
import { expenseFields } from "@/lib/activityFields";
import { campaignLabel } from "@/lib/campaigns";
import { todayKey } from "@/lib/day";
import { validateExpense, validateNewExpenseId } from "@/lib/expenses";
import { formatMoney } from "@/lib/invoice";
import { payerLabel } from "@/lib/payers";
import { revalidateStores } from "@/lib/revalidation";
import { requireSession } from "@/lib/session.server";
import type { ActivityEntity } from "@/repositories/activity";
import { recordActivity } from "@/repositories/activity.writer.server";
import { getCampaignRecord } from "@/repositories/campaigns.writer.server";
import { readExpenseRecords } from "@/repositories/expenseRecords.server";
import { expenseCategoryLabel, type ExpenseInput, type ExpenseRecord } from "@/repositories/expenses";
import {
  addExpense,
  deleteExpense as deleteExpenseRecord,
  updateExpense as updateExpenseRecord,
} from "@/repositories/expenses.writer.server";
import { activateTrashEntry, addTrashEntry, removeTrashEntry } from "@/repositories/trash.writer.server";

type Fail = { success: false; error: string };

function failure(err: unknown, fallback: string): Fail {
  return { success: false, error: err instanceof Error ? err.message : fallback };
}

/**
 * The deal an expense is for, as activity names it, or null for none. Refuses
 * a deal that no longer exists: an expense pointed at nothing would count as
 * a cost on no deal's sheet.
 */
async function dealOf(campaignId: string | null): Promise<ActivityEntity | null> {
  if (!campaignId) return null;
  const record = await getCampaignRecord(campaignId);
  if (!record) throw new Error("That deal no longer exists. Pick another, or no deal.");
  return { type: "campaign", id: record.id, label: campaignLabel(record.campaign, record.brand) };
}

/** The activity fields an expense event carries: what it was, the deal it was for, and whose money. */
function expenseActivity(record: ExpenseRecord, deal: ActivityEntity | null) {
  const paidBy = record.paidBy ? payerLabel(record.paidBy) : "an account not recorded";
  return {
    entity: { type: "expense" as const, id: record.id, label: record.description },
    parent: deal ?? undefined,
    detail: [expenseCategoryLabel(record.category), deal?.label, `from ${paidBy}`].filter(Boolean).join(" · "),
    amount: record.amount,
  };
}

function checked(input: ExpenseInput): ExpenseInput {
  const normalized: ExpenseInput = {
    ...input,
    description: typeof input.description === "string" ? input.description.trim() : "",
    note: typeof input.note === "string" ? input.note.trim() : "",
    campaignId: typeof input.campaignId === "string" && input.campaignId.trim() ? input.campaignId.trim() : null,
  };
  const problem = validateExpense(normalized, todayKey());
  if (problem) throw new Error(problem);
  return normalized;
}

export async function createExpense(
  input: ExpenseInput
): Promise<{ success: true; expenseId: string } | Fail> {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    const idProblem = validateNewExpenseId(input.id);
    if (idProblem) throw new Error(idProblem);
    const expense = checked(input);
    const deal = await dealOf(expense.campaignId);
    const { record, created } = await addExpense(expense);
    revalidateStores("expenses");
    if (created) await recordActivity({ action: "expense.recorded", ...expenseActivity(record, deal) });
    return { success: true, expenseId: record.id };
  } catch (err) {
    return failure(err, "Couldn't save the expense");
  }
}

export async function updateExpense(input: ExpenseInput): Promise<{ success: true } | Fail> {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    const expense = checked(input);
    const deal = await dealOf(expense.campaignId);
    const change = await updateExpenseRecord(expense);
    if (!change) return { success: false, error: "This expense no longer exists" };
    revalidateStores("expenses");
    await recordActivity({
      action: "expense.updated",
      ...expenseActivity(change.after, deal),
      detail: describeChanges(change, expenseFields) ?? expenseActivity(change.after, deal).detail,
    });
    return { success: true };
  } catch (err) {
    return failure(err, "Couldn't save the expense");
  }
}

/** Moves an expense to Trash; the toast's Undo restores it from there. */
export async function deleteExpense(id: string): Promise<{ success: true; trashId: string } | Fail> {
  const denied = await requireSession();
  if (denied) return denied;
  // Trash holds a copy before the expense goes, so a failed write in between
  // can never lose it: the entry stays pending (hidden) until the delete lands.
  let trashId: string | null = null;
  let removed: ExpenseRecord | null = null;
  try {
    const record = (await readExpenseRecords()).find((expense) => expense.id === id);
    if (!record) return { success: false, error: "This expense no longer exists" };
    trashId = await addTrashEntry(
      { type: "expense", record },
      `${record.description} · ${formatMoney(record.amount)}`
    );
    removed = await deleteExpenseRecord(id);
    if (!removed) {
      await removeTrashEntry(trashId);
      return { success: false, error: "This expense no longer exists" };
    }
    await activateTrashEntry(trashId);
    revalidateStores("expenses");
    // A deal deleted since is named as gone rather than refusing the delete.
    const deal = await dealOf(removed.campaignId).catch(() => null);
    await recordActivity({ action: "expense.deleted", ...expenseActivity(removed, deal) });
    return { success: true, trashId };
  } catch (err) {
    if (trashId) {
      if (removed) await activateTrashEntry(trashId).catch(() => undefined);
      else await removeTrashEntry(trashId).catch(() => undefined);
    }
    return failure(err, "Couldn't delete the expense");
  }
}
