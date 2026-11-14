// Optimistic compare-and-set for the values kept whole under one store key,
// such as a collection stored as one JSON array.
//
// A change used to be read, modify, write with nothing checking the key in
// between, so two saves that overlapped (two tabs, a double submit, both
// partners at once) both read the same list and the second write dropped the
// first one's change without an error. Here every write is conditional on
// the key still holding exactly the text this change was computed from. When
// it does not, the change is run again against what is stored now, a few
// times, before giving up with STORE_CONFLICT.
//
// Kept apart from ./storeWrite.server, which binds it to Upstash, so the
// retry and conflict rules are tested against an in-memory store. No
// "server-only" for the same reason; nothing on the client imports it.

export interface CompareAndSetStore {
  /** The key's stored text exactly as written, or null when the key is not set. */
  read(key: string): Promise<string | null>;
  /**
   * Writes `next` only while the key still holds exactly `expected` (null:
   * still not set), as one step on the store. Answers whether the key now
   * holds `next`.
   */
  compareAndSet(key: string, expected: string | null, next: string): Promise<boolean>;
}

/** What one run of a change decided: the value to store, or null to store nothing, and what to answer. */
export interface MutationStep<T, R> {
  next: T | null;
  result: R;
}

/**
 * One change to a stored value. It may run more than once, each time against
 * a fresher read, so it must not act on the world itself (no other writes);
 * reading other keys is fine, since a rerun reads them again too.
 */
export type Mutation<T, R> = (current: T) => MutationStep<T, R> | Promise<MutationStep<T, R>>;

/**
 * Turns the stored value into the shape a change works on: the parsed JSON,
 * or null when the key is not set. Usually the same coercion the key's reader
 * applies, seed fallback included.
 */
export type Decode<T> = (stored: unknown) => T;

export type Mutate = <T, R>(key: string, decode: Decode<T>, change: Mutation<T, R>) => Promise<R>;

export const STORE_CONFLICT = "This was changed somewhere else while it saved, so nothing was saved. Try again.";

export interface MutateOptions {
  /** How many times a change is tried before STORE_CONFLICT. */
  attempts?: number;
  /** Waits before retry `attempt` (1 after the first conflict). */
  pause?: (attempt: number) => Promise<void>;
}

export const DEFAULT_ATTEMPTS = 5;

// Jittered so two saves that collided once do not collide again in step.
function defaultPause(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.random() * 40 * attempt));
}

/**
 * Parses stored text the way the Upstash client does for every other read, so
 * a change sees the same value the key's reader does: JSON when it parses
 * (after a byte order mark), and the text as it is when it does not, or when
 * it is a number that would not print back the same (a zero-padded "0012").
 */
export function parseStored(raw: string): unknown {
  const text = raw.startsWith("﻿") ? raw.slice(1) : raw;
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "number" && String(parsed) !== text ? raw : parsed;
  } catch {
    return raw;
  }
}

export function createMutate(store: CompareAndSetStore, options: MutateOptions = {}): Mutate {
  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);
  const pause = options.pause ?? defaultPause;

  return async function mutate<T, R>(key: string, decode: Decode<T>, change: Mutation<T, R>): Promise<R> {
    for (let attempt = 1; ; attempt += 1) {
      const raw = await store.read(key);
      const { next, result } = await change(decode(raw === null ? null : parseStored(raw)));
      // Nothing to write: the answer was computed from one consistent read,
      // so there is nothing that an overlapping save could have undone.
      if (next === null) return result;
      if (await store.compareAndSet(key, raw, JSON.stringify(next))) return result;
      if (attempt >= attempts) throw new Error(STORE_CONFLICT);
      await pause(attempt);
    }
  };
}
