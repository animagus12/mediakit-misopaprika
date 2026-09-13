"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/contentCalendar";
import { STAGE_DOTS } from "./postTone";

interface StageFilterProps {
  counts: Record<PipelineStage, number>;
  value: PipelineStage | null;
  onChange: (stage: PipelineStage | null) => void;
  /**
   * Whether picking the selected chip again clears it. A filter can be off; a
   * set of tabs always has one open, so the board passes false.
   */
  clearable?: boolean;
  /** What the counts are counting, for the label a screen reader hears. */
  countNoun: string;
  "aria-label": string;
  className?: string;
}

// One chip per pipeline stage, with a count. The month and week views use it
// as a filter that fades every other stage; the board uses it as tabs on a
// phone, where only one column fits. Scrolls sideways rather than wrapping
// into a block of chips.
export function StageFilter({
  counts,
  value,
  onChange,
  clearable = true,
  countNoun,
  "aria-label": ariaLabel,
  className,
}: StageFilterProps) {
  return (
    // The scrollbar is hidden: Windows draws a classic bar with arrow buttons
    // under the chips even when asked for a thin one, which reads as broken
    // rather than scrollable. The chip cut off at the edge is the cue, and
    // touch, trackpad, shift+wheel and keyboard focus all still scroll it.
    // py-1 leaves room for a chip's focus ring, which the overflow would clip.
    <div
      className={cn(
        "-mx-(--card-spacing) overflow-x-auto px-(--card-spacing) py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={1}
        value={value ?? ""}
        onValueChange={(next) => {
          if (!next && !clearable) return;
          onChange((next || null) as PipelineStage | null);
        }}
        aria-label={ariaLabel}
      >
        {PIPELINE_STAGES.map((stage) => (
          <ToggleGroupItem
            key={stage}
            value={stage}
            aria-label={`${stage}: ${counts[stage]} ${countNoun}`}
            className="gap-1.5 text-[11px] pointer-coarse:h-11 pointer-coarse:px-3"
          >
            <span className={cn("size-2 rounded-full", STAGE_DOTS[stage])} />
            {stage}
            <span className="tabular-nums text-muted-foreground">{counts[stage]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
