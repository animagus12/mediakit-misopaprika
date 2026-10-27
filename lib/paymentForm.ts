// The record-payment form's state and arithmetic, kept out of the component:
// what the amount fields hold as typed, how TDS follows the expected rate
// until it is typed over, and how net and charges recompute each other.
// Client-safe and pure.
import { roundMoney } from "@/lib/money";
import { isPayer, isPaymentMethod, type Payer, type PaymentMethod } from "@/lib/payers";
import type { PaymentInput, PaymentTarget } from "@/repositories/payments";

export interface PaymentFormState {
  date: string; // yyyy-mm-dd
  gross: string;
  tds: string;
  bankFee: string;
  net: string;
  receivedInto: Payer | "";
  method: PaymentMethod | "";
  reference: string;
  note: string;
  /** TDS was typed by hand, so changing the amount no longer re-estimates it. */
  tdsTouched: boolean;
}

export interface PaymentFormValues {
  date: string;
  gross: number;
  tds: number;
  bankFee: number;
  receivedInto: Payer | null;
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

export function estimateTds(gross: number, rate: number | null): number {
  if (rate === null || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(gross) || gross <= 0) return 0;
  return roundMoney((gross * rate) / 100);
}

/** The form opened on a suggestion (a new payment) or an entry being edited. */
export function paymentFormFrom(values: PaymentFormValues, tdsTouched: boolean): PaymentFormState {
  const state = {
    date: values.date,
    gross: amountText(values.gross),
    tds: amountText(values.tds),
    bankFee: amountText(values.bankFee),
    receivedInto: values.receivedInto ?? "",
    method: values.method ?? "",
    reference: values.reference,
    note: values.note,
    tdsTouched,
  } satisfies Omit<PaymentFormState, "net">;
  return { ...state, net: netOf(state) };
}

export function withGross(state: PaymentFormState, gross: string, expectedRate: number | null): PaymentFormState {
  const tds = state.tdsTouched ? state.tds : amountText(estimateTds(parseFormAmount(gross), expectedRate));
  const next = { ...state, gross, tds };
  return { ...next, net: netOf(next) };
}

export function withTds(state: PaymentFormState, tds: string): PaymentFormState {
  const next = { ...state, tds, tdsTouched: true };
  return { ...next, net: netOf(next) };
}

export function withBankFee(state: PaymentFormState, bankFee: string): PaymentFormState {
  const next = { ...state, bankFee };
  return { ...next, net: netOf(next) };
}

/** Typing what landed in the account sets the charges to whatever is left over. */
export function withNet(state: PaymentFormState, net: string): PaymentFormState {
  const gross = parseFormAmount(state.gross);
  const tds = parseFormAmount(state.tds);
  return { ...state, net, bankFee: amountText(gross - tds - parseFormAmount(net)) };
}

/** Charges came out negative: net was typed above what the amount and TDS allow. */
export function hasNegativeCharges(state: PaymentFormState): boolean {
  return parseFormAmount(state.bankFee) < 0;
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
    // An empty choice is refused by validatePayment with its own message.
    receivedInto: (isPayer(state.receivedInto) ? state.receivedInto : "") as Payer,
    method: isPaymentMethod(state.method) ? state.method : null,
    reference: state.reference.trim(),
    note: state.note.trim(),
  };
}
