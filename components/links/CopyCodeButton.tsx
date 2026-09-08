"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
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
  return (
    <button type="button" className={styles.code} onClick={handleCopy} aria-label={`Copy code ${code}`}>
      <span className={styles.codeTag} aria-hidden>
        CODE
      </span>
      <span className={styles.codeValue} aria-hidden>
        {code}
      </span>
      <span className={styles.codeAction} aria-hidden>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {/* Its own element so a tile, where there is no room for it, can drop
            the word and keep the glyph. */}
        <span className={styles.codeActionLabel}>{copied ? "Copied" : "Copy"}</span>
      </span>
    </button>
  );
}
