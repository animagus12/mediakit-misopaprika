"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/invoice";
import { estimateTdsFromRateInput } from "@/lib/tds";

interface TdsFieldsProps {
  /** Keeps <label htmlFor> ids unique when several forms are mounted at once. */
  idPrefix: string;
  /** The rate as typed, "" when not recorded. */
  rate: string;
  /**
   * The actual amount as typed, "" to use the estimate. Left out, the fields
   * ask only for the rate the brand is expected to withhold: on a deal or
   * renewal with cash, what was actually withheld is recorded on each payment.
   */
  amount?: string;
  onRateChange: (value: string) => void;
  onAmountChange?: (value: string) => void;
  /** The cash the rate is applied to, for the estimate shown under the inputs. */
  gross: number;
  /** One line under the heading saying which payment this is for. */
  description?: string;
}

/**
 * The TDS pair a payment carries: a deduction rate that estimates the tax, and
 * the actual amount the brand withheld, which wins once entered.
 *
 * Shared by the deal form and the renewal sheets so every payment asks for TDS
 * the same way and estimates it with the same rule (estimateTdsFromRateInput).
 * The server checks the values again with validateTdsValues.
 */
export function TdsFields({
  idPrefix,
  rate,
  amount,
  onRateChange,
  onAmountChange,
  gross,
  description = "Track the tax deducted from this payment.",
}: TdsFieldsProps) {
  const estimatedTds = estimateTdsFromRateInput(rate, gross);
  const rateOnly = amount === undefined || onAmountChange === undefined;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">{rateOnly ? "Expected TDS" : "TDS withheld"}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-tdsRate`}>{rateOnly ? "Expected TDS rate" : "Deduction rate"}</Label>
          <div className="relative">
            <Input
              id={`${idPrefix}-tdsRate`}
              type="number"
              min={0}
              max={100}
              step="0.01"
              placeholder="e.g. 10"
              className="pr-9"
              value={rate}
              onChange={(event) => onRateChange(event.target.value)}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
              %
            </span>
          </div>
        </div>
        {!rateOnly && (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-tdsAmount`}>Actual TDS deducted</Label>
            <Input
              id={`${idPrefix}-tdsAmount`}
              type="number"
              min={0}
              step="1"
              placeholder="Enter amount from the brand"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter the amount shown by the brand. Leave blank to use the estimate.
            </p>
          </div>
        )}
      </div>
      {estimatedTds !== null && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-medium">
              {amount?.trim() ? "Estimated from rate" : "Estimated TDS"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatMoney(gross)} × {rate}%
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(estimatedTds)}</p>
        </div>
      )}
    </div>
  );
}
