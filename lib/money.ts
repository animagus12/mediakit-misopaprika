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
