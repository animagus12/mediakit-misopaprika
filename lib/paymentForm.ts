// The record-payment form's state and arithmetic, kept out of the component:
// what the amount fields hold as typed, how TDS follows the expected rate
// until net received or TDS itself is typed, and how the four amounts
// recompute each other so they always add up. Client-safe and pure.
import { roundMoney } from "@/lib/money";
import { isPaymentMethod, type PaymentMethod } from "@/lib/payers";
import { estimatePaymentTds } from "@/lib/payments";
import type { PaymentInput, PaymentTarget } from "@/repositories/payments";

/**
 * What the TDS field follows:
 * - "rate": the expected rate on the amount, re-estimated as the amount changes.
 * - "net": whatever the amount leaves after charges and net received. Net is
 *   what landed in the bank, so it holds still and TDS takes up any change.
 * - "typed": the figure typed into it. Typing net then sets the charges.
 */
export type TdsMode = "rate" | "net" | "typed";

export interface PaymentFormState {
  date: string; // yyyy-mm-dd
  gross: string;
  tds: string;
  bankFee: string;
  net: string;
  method: PaymentMethod | "";
  reference: string;
  note: string;
  tdsMode: TdsMode;
}

export interface PaymentFormValues {
  date: string;
  gross: number;
  tds: number;
  bankFee: number;
  method: PaymentMethod | null;
  reference: string;
  note: string;
}

/** A typed amount as a number: blank is 0, anything unreadable NaN (which validation refuses). */
export function parseFormAmount(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : Number(trimmed);
}

function amountText(value: number): string {
  return Number.isFinite(value) ? String(roundMoney(value)) : "";
}

function netOf(state: Pick<PaymentFormState, "gross" | "tds" | "bankFee">): string {
  const gross = parseFormAmount(state.gross);
  const tds = parseFormAmount(state.tds);
  const fee = parseFormAmount(state.bankFee);
  return amountText(gross - tds - fee);
}

function tdsOf(state: Pick<PaymentFormState, "gross" | "bankFee" | "net">): string {
  const gross = parseFormAmount(state.gross);
  const fee = parseFormAmount(state.bankFee);
  const net = parseFormAmount(state.net);
  return amountText(gross - fee - net);
}

/** Whether the TDS field is still the rate's estimate, with a rate that withholds anything. */
function estimatesTds(state: PaymentFormState, expectedRate: number | null): boolean {
  return state.tdsMode === "rate" && expectedRate !== null && expectedRate > 0;
}

/** The form opened on a suggestion (a new payment, "rate") or an entry being edited. */
export function paymentFormFrom(values: PaymentFormValues, tdsMode: TdsMode): PaymentFormState {
  const state = {
    date: values.date,
    gross: amountText(values.gross),
    tds: amountText(values.tds),
    bankFee: amountText(values.bankFee),
    method: values.method ?? "",
    reference: values.reference,
    note: values.note,
    tdsMode,
  } satisfies Omit<PaymentFormState, "net">;
  return { ...state, net: netOf(state) };
}

/**
 * How a saved payment reopens: one with TDS on it, or on a deal that expects
 * some, works TDS out from net received; one without keeps TDS at what it is.
 */
export function savedPaymentTdsMode(tds: number, expectedRate: number | null): TdsMode {
  return tds > 0 || (expectedRate !== null && expectedRate > 0) ? "net" : "typed";
}

export function withGross(state: PaymentFormState, gross: string, expectedRate: number | null): PaymentFormState {
  if (state.tdsMode === "net") {
    return { ...state, gross, tds: tdsOf({ ...state, gross }) };
  }
  const tds = state.tdsMode === "rate" ? amountText(estimatePaymentTds(parseFormAmount(gross), expectedRate)) : state.tds;
  const next = { ...state, gross, tds };
  return { ...next, net: netOf(next) };
}

export function withTds(state: PaymentFormState, tds: string): PaymentFormState {
  const next = { ...state, tds, tdsMode: "typed" as const };
  return { ...next, net: netOf(next) };
}

export function withBankFee(state: PaymentFormState, bankFee: string): PaymentFormState {
  if (state.tdsMode === "net") {
    return { ...state, bankFee, tds: tdsOf({ ...state, bankFee }) };
  }
  const next = { ...state, bankFee };
  return { ...next, net: netOf(next) };
}

/**
 * Typing what landed in the account works out whatever was not typed: TDS
 * when the payment carries some (an expected rate, or TDS worked out from net
 * already), otherwise the charges.
 */
export function withNet(state: PaymentFormState, net: string, expectedRate: number | null): PaymentFormState {
  if (state.tdsMode === "net" || estimatesTds(state, expectedRate)) {
    return { ...state, net, tds: tdsOf({ ...state, net }), tdsMode: "net" };
  }
  const gross = parseFormAmount(state.gross);
  const tds = parseFormAmount(state.tds);
  return { ...state, net, bankFee: amountText(gross - tds - parseFormAmount(net)) };
}

/**
 * Net was typed above what the other amounts allow, so the one worked out from
 * it came out negative: a sentence to show, or null when the amounts add up.
 */
export function negativeAmountProblem(state: PaymentFormState): string | null {
  if (parseFormAmount(state.tds) < 0) return "Net received can't be more than the amount less charges";
  if (parseFormAmount(state.bankFee) < 0) return "Net received can't be more than the amount less TDS";
  return null;
}

export function paymentInputFrom(state: PaymentFormState, id: string, target: PaymentTarget): PaymentInput {
  return { ...paymentValuesFrom(state, id), target };
}

/** The payment without its target, for a deal or renewal not saved yet (the server adds the target). */
export function paymentValuesFrom(state: PaymentFormState, id: string): Omit<PaymentInput, "target"> {
  return {
    id,
    date: state.date,
    gross: parseFormAmount(state.gross),
    tds: parseFormAmount(state.tds),
    bankFee: parseFormAmount(state.bankFee),
    // Money in always lands in the business account.
    receivedInto: "business",
    method: isPaymentMethod(state.method) ? state.method : null,
    reference: state.reference.trim(),
    note: state.note.trim(),
  };
}
