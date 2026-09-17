"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const COLUMNS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

interface OptionToggleProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: readonly T[];
  /** Id of the <Label> naming the field, so the group is read out with it. */
  labelledBy: string;
  /** What each option is called on screen. Defaults to the value itself. */
  labelFor?: (option: T) => string;
  /** How many buttons per row. Four options read best two by two. */
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * A short, fixed list of options as buttons rather than a menu.
 *
 * For the handful of fields where every choice is worth seeing at once,
 * usually because the choice changes what the rest of the form asks for: a
 * deal's type, a post's format, what a commission is a percentage of. A list
 * long enough to need scrolling belongs in a <Select>.
 */
export function OptionToggle<T extends string>({
  value,
  onChange,
  options,
  labelledBy,
  labelFor,
  columns = 2,
  className,
}: OptionToggleProps<T>) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={1}
      value={value}
      onValueChange={(next) => {
        // Radix reports "" when the pressed item is pressed again. These
        // fields always hold one of their options, so that is a no-op rather
        // than a state of its own.
        if (next) onChange(next as T);
      }}
      aria-labelledby={labelledBy}
      className={cn("grid w-full", COLUMNS[columns], className)}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option} value={option} className="text-xs">
          {labelFor ? labelFor(option) : option}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
