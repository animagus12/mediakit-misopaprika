// Who money moved through, and how.
//
// Shared by every record that says who paid for something: expenses and
// editor transactions. Money in always lands in the business account, so it
// is never asked (a payment's stored receivedInto is always "business" for
// anything recorded now). What matters is who paid each cost: the business
// account, or one of the two partners out of their own pocket.
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

/** The two partners, who share the business 50/50. */
export const PARTNERS = ["subhrajit", "ritika"] as const satisfies readonly Payer[];

export type Partner = (typeof PARTNERS)[number];

export function isPartner(value: unknown): value is Partner {
  return typeof value === "string" && (PARTNERS as readonly string[]).includes(value);
}

export function otherPartner(partner: Partner): Partner {
  return partner === "subhrajit" ? "ritika" : "subhrajit";
}

/**
 * How a cost a partner paid out of their own pocket is settled: the business
 * account repays it in full, or the two partners share it equally, so the
 * other owes half. Null is "not decided yet".
 */
export type PartnerSettlement = "business" | "split";

export function isPartnerSettlement(value: unknown): value is PartnerSettlement {
  return value === "business" || value === "split";
}

export function toPartnerSettlement(value: unknown): PartnerSettlement | null {
  return isPartnerSettlement(value) ? value : null;
}

/** "Repaid from business funds", "Split 50/50", or "To settle" while undecided. */
export function partnerSettlementLabel(settlement: PartnerSettlement | null): string {
  if (settlement === "business") return "Repaid from business funds";
  if (settlement === "split") return "Split 50/50";
  return "To settle";
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
