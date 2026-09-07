// Turns "Brand Nike updated" into "status Lead to Active, website added".
//
// Without this, updates are the bulk of the activity feed and the least
// useful rows in it: they record that something changed and refuse to say
// what. Pure and dependency-free, so the update writers can hand it a before
// and an after and the actions stay one-liners.

/**
 * A record either side of a write.
 *
 * Update writers answer this rather than taking the action's raw input as the
 * "after": every writer normalises what it is given (trimming strings,
 * coercing numbers), so comparing the input against the stored record would
 * report a change whenever someone typed a trailing space.
 */
export interface RecordChange<T> {
  before: T;
  after: T;
}

export interface DiffField<T> {
  /** How the field is named in the feed, lowercase: it appears mid-sentence. */
  label: string;
  value: (record: T) => unknown;
  /** Defaults to a trimmed String(). Give one for counts, money, or dates. */
  format?: (value: unknown) => string;
  /**
   * Record only that the field changed, never what it changed to.
   *
   * For values that mean nothing to a reader (a uuid, a blob URL) and, more
   * importantly, for anything that should not be copied into a log which
   * outlives the record it describes: an invoice's payment block carries bank
   * account numbers.
   */
  redact?: boolean;
}

// Three changes is what fits a feed row. Beyond that the count carries more
// than the list would.
const MAX_FIELDS = 3;
const MAX_VALUE_CHARS = 24;

function display(value: unknown, format?: (value: unknown) => string): string {
  const text = format ? format(value) : value == null ? "" : String(value).trim();
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS - 1)}…` : text;
}

/**
 * A phrase naming what changed, or undefined when nothing in `fields` did.
 *
 * Undefined rather than an empty string so a caller can drop the detail
 * entirely: "Brand Nike updated" with no detail is honest when the edit only
 * touched fields nobody asked to track.
 */
export function describeChanges<T>(
  change: RecordChange<T>,
  fields: readonly DiffField<T>[]
): string | undefined {
  const changes: string[] = [];

  for (const field of fields) {
    const from = display(field.value(change.before), field.format);
    const to = display(field.value(change.after), field.format);
    // Compared as rendered, so a change invisible at this resolution (a
    // trailing space, a truncated tail) doesn't produce "name X to X".
    if (from === to) continue;

    if (field.redact) changes.push(`${field.label} changed`);
    else if (!from) changes.push(`${field.label} added`);
    else if (!to) changes.push(`${field.label} cleared`);
    else changes.push(`${field.label} ${from} to ${to}`);
  }

  if (changes.length === 0) return undefined;
  const shown = changes.slice(0, MAX_FIELDS);
  const hidden = changes.length - shown.length;
  return hidden > 0 ? `${shown.join(", ")}, +${hidden} more` : shown.join(", ");
}

/** Field count, for the cases where a list is meaningless: "3 line items". */
export function countOf(value: unknown): string {
  return Array.isArray(value) ? String(value.length) : "";
}
