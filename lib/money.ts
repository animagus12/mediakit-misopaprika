// Rupee arithmetic shared by every money calculation. Pure and client-safe.
//
// Amounts are stored as plain JavaScript numbers, so a sum of paise-bearing
// figures can land a hair off the value a person would write down
// (0.1 + 0.2 is 0.30000000000000004). Rounding once, at the end of a sum, keeps
// those crumbs out of totals and out of equality checks without changing how
// anything is stored.

/**
 * Rounds to two decimal places (whole paise).
 *
 * Number.EPSILON nudges values that sit exactly on a half-paisa boundary but
 * are stored a fraction below it (1.005 is really 1.00499999...) so they round
 * up the way the written figure says they should. Non-finite input reads as 0,
 * matching how the to*() mappers coerce a malformed amount.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  // Math.round(-0.4) is -0, which formats as "-₹0".
  return rounded === 0 ? 0 : rounded;
}

/** Sums amounts and rounds the result once, so drift does not accumulate. */
export function sumMoney(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    if (Number.isFinite(value)) total += value;
  }
  return roundMoney(total);
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** 1 to 99 in words; "" for 0. */
function belowHundredInWords(n: number): string {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(" ");
}

/** A whole number in words on the Indian system (crore, lakh, thousand); "" for 0. */
function wholeInWords(n: number): string {
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor(n / 100_000) % 100;
  const thousand = Math.floor(n / 1000) % 100;
  const hundred = Math.floor(n / 100) % 10;
  return [
    crore > 0 ? `${wholeInWords(crore)} Crore` : "",
    lakh > 0 ? `${belowHundredInWords(lakh)} Lakh` : "",
    thousand > 0 ? `${belowHundredInWords(thousand)} Thousand` : "",
    hundred > 0 ? `${ONES[hundred]} Hundred` : "",
    belowHundredInWords(n % 100),
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * An amount written out the way Indian invoices print it: "Rupees Nine
 * Thousand Five Hundred Only", or "Rupees Ten and Fifty Paise Only" when there
 * are paise.
 */
export function amountInWords(amount: number): string {
  const rounded = roundMoney(amount);
  const rupees = Math.floor(Math.abs(rounded));
  const paise = Math.round((Math.abs(rounded) - rupees) * 100);
  const sign = rounded < 0 ? "Minus " : "";
  const paiseWords = paise > 0 ? ` and ${belowHundredInWords(paise)} Paise` : "";
  return `${sign}Rupees ${wholeInWords(rupees) || "Zero"}${paiseWords} Only`;
}
