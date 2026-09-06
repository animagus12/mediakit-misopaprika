"use client";

import type { ReactNode } from "react";

interface TrackedLinkProps {
  /** LinkItem.id — the key clicks are counted against. */
  itemId: string;
  href: string;
  className: string;
  target?: string;
  rel?: string;
  children: ReactNode;
}

function record(itemId: string): void {
  // sendBeacon is queued by the browser and survives the navigation this
  // click is about to start, which a fetch() from an unloading document does
  // not. The Blob's type is what gives the request its Content-Type, so the
  // route can read it as JSON.
  if (typeof navigator.sendBeacon !== "function") return;
  try {
    navigator.sendBeacon(
      "/api/links/click",
      new Blob([JSON.stringify({ itemId })], { type: "application/json" })
    );
  } catch {
    // Best-effort, like the counter behind it: a lost click is never worth
    // interfering with where the visitor was going.
  }
}

/**
 * The one interactive piece of a link card, split out so the rest of the card
 * stays a server component: the card's markup is passed in as children and is
 * rendered on the server, and all that reaches the browser is this anchor and
 * the beacon above.
 *
 * Deliberately a real <a> with the real destination rather than a redirect
 * through a counting route — the URL stays copyable, long-pressable, and
 * correct in the status bar, and a link still works with JS disabled or the
 * counter down. The trade is that the count is a floor, not an exact figure.
 */
export function TrackedLink({ itemId, children, ...anchorProps }: TrackedLinkProps) {
  return (
    <a {...anchorProps} onClick={() => record(itemId)}>
      {children}
    </a>
  );
}
