// Who money moved through, and how.
//
// Shared by every record that says where a payment came from or went to:
// editor transactions now, and the payment ledger and expenses later. The
// same three values answer both directions: "paid by" for money going out
// and "received into" for money coming in, since the question in both cases
// is whose account it touched.
//
// Pure and client-safe: forms render these as <Select> options, and the
// to*() mappers use the parsers to coerce whatever storage hands back.

export const PAYERS = ["subhrajit", "ritika", "business"] as const;

export type Payer = (typeof PAYERS)[number];

export const PAYER_OPTIONS: readonly { value: Payer; label: string }[] = [
  { value: "subhrajit", label: "Subhrajit" },
  { value: "ritika", label: "Ritika" },
  { value: "business", label: "Business funds" },
];

export const PAYMENT_METHOD_OPTIONS = ["UPI", "Bank transfer", "Cash", "Card", "Other"] as const;

export type PaymentMethod = (typeof PAYMENT_METHOD_OPTIONS)[number];

export function isPayer(value: unknown): value is Payer {
  return typeof value === "string" && (PAYERS as readonly string[]).includes(value);
}

/**
 * A stored or submitted payer, or undefined for anything that isn't one.
 * Matches case-insensitively on the value or its label, so "Ritika" typed or
 * imported from a sheet reads the same as "ritika".
 */
export function toPayer(value: unknown): Payer | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase();
  if (!key) return undefined;
  return PAYER_OPTIONS.find((option) => option.value === key || option.label.toLowerCase() === key)?.value;
}

/** "Business funds" for "business"; "" when there is no payer to name. */
export function payerLabel(payer: Payer | undefined): string {
  return PAYER_OPTIONS.find((option) => option.value === payer)?.label ?? "";
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHOD_OPTIONS as readonly string[]).includes(value);
}

/**
 * A stored or submitted method in its canonical spelling, or undefined for
 * anything outside PAYMENT_METHOD_OPTIONS. Case and surrounding spaces are
 * ignored, so "upi " reads as "UPI".
 */
export function toPaymentMethod(value: unknown): PaymentMethod | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase();
  if (!key) return undefined;
  return PAYMENT_METHOD_OPTIONS.find((option) => option.toLowerCase() === key);
}
