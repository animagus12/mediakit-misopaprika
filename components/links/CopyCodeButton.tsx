"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "./links.module.css";

interface CopyCodeButtonProps {
  code: string;
}

// The one interactive part of the public links page: everything else is
// server-rendered. Kept as its own module so the "use client" boundary stays
// this small.
export function CopyCodeButton({ code }: CopyCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(event: React.MouseEvent) {
    // Code cards can sit inside a card-wide <a>; copying shouldn't navigate.
    event.preventDefault();
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is denied in some in-app browsers: show the code
      // so it can still be copied by hand.
      toast.error(`Couldn't copy: the code is ${code}`);
    }
  }

  // The whole ticket is the button, not just the chip on its end: a code is
  // read and tapped as one object, and the strip is a far easier target than
  // a 60px chip. The chip is the affordance, so it carries the state.
  //
  // The .code rule draws it; the classes only undo what of the Button that
  // rule doesn't set itself: its centring, type, nowrap (a long code wraps),
  // text selection, press nudge and focus ring: focus keeps the browser's
  // outline, which shows on the dark card where the Button's ring would not.
  return (
    <Button
      type="button"
      variant="ghost"
      size="none"
      className={cn(
        styles.code,
        "justify-normal text-[length:inherit] font-[number:inherit] whitespace-normal select-auto active:not-aria-[haspopup]:translate-y-0 focus-visible:ring-0 focus-visible:[outline-style:auto]"
      )}
      onClick={handleCopy}
      aria-label={`Copy code ${code}`}
    >
      <span className={styles.codeTag} aria-hidden>
        CODE
      </span>
      <span className={styles.codeValue} aria-hidden>
        {code}
      </span>
      <span className={styles.codeAction} aria-hidden>
        {copied ? <Check className="size-[13px]" /> : <Copy className="size-[13px]" />}
        {/* Its own element so a tile, where there is no room for it, can drop
            the word and keep the glyph. */}
        <span className={styles.codeActionLabel}>{copied ? "Copied" : "Copy"}</span>
      </span>
    </Button>
  );
}
