// An in-memory CompareAndSetStore with the same rules as the Lua script in
// lib/storeWrite.server.ts, for testing writes without Redis.
//
// Test-only: nothing in the app imports this.
import type { CompareAndSetStore } from "@/lib/storeMutation";

export interface MemoryStore {
  store: CompareAndSetStore;
  /** The key's stored text, or null when not set. */
  get(key: string): string | null;
  /** Sets the key's text directly, as another writer would. */
  set(key: string, text: string): void;
  /** Compare-and-sets that wrote. */
  writes(): number;
  /** Compare-and-sets refused because the key had changed. */
  conflicts(): number;
  /** Runs once before each compare-and-set, given the key: the place to simulate a save landing in between. */
  beforeWrite(hook: ((key: string) => void) | null): void;
}

export function memoryStore(initial: Record<string, unknown> = {}): MemoryStore {
  const values = new Map<string, string>(
    Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)])
  );
  let writes = 0;
  let conflicts = 0;
  let hook: ((key: string) => void) | null = null;

  const store: CompareAndSetStore = {
    read: async (key) => values.get(key) ?? null,
    compareAndSet: async (key, expected, next) => {
      hook?.(key);
      const current = values.get(key) ?? null;
      if (current === next) return true;
      if (current !== expected) {
        conflicts += 1;
        return false;
      }
      values.set(key, next);
      writes += 1;
      return true;
    },
  };

  return {
    store,
    get: (key) => values.get(key) ?? null,
    set: (key, text) => void values.set(key, text),
    writes: () => writes,
    conflicts: () => conflicts,
    beforeWrite: (next) => void (hook = next),
  };
}
