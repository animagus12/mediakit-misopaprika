import type { ReactNode } from "react";

/**
 * A run of fields under a heading, so a long form reads as three short ones.
 *
 * The heading is a real one rather than a styled <p>: a sheet's title is the
 * only other heading around it, so a screen reader moving by heading gets the
 * form's shape for free.
 *
 * For forms long enough that their order needs explaining. A form of three
 * fields is better off without one.
 */
export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
