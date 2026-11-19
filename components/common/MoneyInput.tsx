import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

/** The pattern for an amount that can't be negative: digits, grouping commas, one decimal point. */
export const AMOUNT_PATTERN = "[0-9,]*\\.?[0-9]*";

/**
 * A rupee amount: ₹ inside the field rather than "(₹)" in its label, and the
 * decimal keypad on phones. Text rather than type="number", so it can carry
 * grouping commas ("1,25,000") and shows no spinner arrows; pass
 * AMOUNT_PATTERN as `pattern` to have the browser refuse letters and minus
 * signs before submit. Read the value with parseFormAmount, which ignores the
 * commas, and regroup it with formatFormAmount on blur where the figure is
 * the person's own (not one a form works out for them).
 *
 * `className` styles the group, the box the border is drawn on.
 */
export function MoneyInput({ className, ...props }: React.ComponentProps<typeof InputGroupInput>) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon>₹</InputGroupAddon>
      <InputGroupInput inputMode="decimal" autoComplete="off" className="tabular-nums" {...props} />
    </InputGroup>
  );
}
