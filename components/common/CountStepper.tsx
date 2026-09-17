"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CountStepperProps {
  value: number;
  /** Which way the count moved. The caller applies it, since what a step costs
   *  is its business (a revision moves an amount with it; a reel doesn't). */
  onStep: (delta: 1 | -1) => void;
  /** Id of the <Label> naming the field, so the count is read out with it. */
  labelledBy: string;
  decrementLabel: string;
  incrementLabel: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * A small -/+ counter for a whole number a form nudges rather than types.
 *
 * The bounds live here: a button that would take the count past one is
 * disabled, so no caller has to clamp what it is handed. Shared by the
 * campaign form's deliverables and the editor transaction form's revisions,
 * which had this markup twice before.
 */
export function CountStepper({
  value,
  onStep,
  labelledBy,
  decrementLabel,
  incrementLabel,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  disabled = false,
  className,
}: CountStepperProps) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className={cn("inline-flex items-center rounded-md border border-input", className)}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onStep(-1)}
        disabled={disabled || value <= min}
        aria-label={decrementLabel}
      >
        <Minus />
      </Button>
      <output aria-live="polite" className="min-w-8 text-center text-xs font-medium tabular-nums">
        {value}
      </output>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onStep(1)}
        disabled={disabled || value >= max}
        aria-label={incrementLabel}
      >
        <Plus />
      </Button>
    </div>
  );
}
