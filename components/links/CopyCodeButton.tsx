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

  return (
    <button type="button" className={styles.code} onClick={handleCopy} aria-label={`Copy code ${code}`}>
      {code}
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
    </button>
  );
}
