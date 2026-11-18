import { describe, expect, it } from "vitest";
import { memoryStore } from "@/lib/testing/memoryStore";
import { createMutate, listOrSeed, parseStored, STORE_CONFLICT, type MutationStep } from "./storeMutation";

const KEY = "items";

interface Item {
  id: string;
}

// The way a collection's reader coerces what is stored: a list, or the seed
// (here empty) when the key is not set.
function toItems(stored: unknown): Item[] {
  return Array.isArray(stored) ? (stored as Item[]) : [];
}

function append(id: string) {
  return (items: Item[]): MutationStep<Item[], Item> => {
    const item = { id };
    return { next: [...items, item], result: item };
  };
}

function setup(initial: Record<string, unknown> = {}, attempts?: number) {
  const memory = memoryStore(initial);
  const pauses: number[] = [];
  const mutate = createMutate(memory.store, {
    attempts,
    pause: async (attempt) => void pauses.push(attempt),
  });
  return { ...memory, mutate, pauses };
}

function stored(memory: { get(key: string): string | null }): unknown {
  const text = memory.get(KEY);
  return text === null ? null : JSON.parse(text);
}

describe("createMutate", () => {
  it("writes the change and answers its result", async () => {
    const memory = setup({ [KEY]: [{ id: "a" }] });
    const result = await memory.mutate(KEY, toItems, append("b"));
    expect(result).toEqual({ id: "b" });
    expect(stored(memory)).toEqual([{ id: "a" }, { id: "b" }]);
    expect(memory.writes()).toBe(1);
  });

  it("decodes a key that is not set as null, and creates it", async () => {
    const memory = setup();
    const seen: unknown[] = [];
    await memory.mutate(
      KEY,
      (value) => {
        seen.push(value);
        return toItems(value);
      },
      append("a")
    );
    expect(seen).toEqual([null]);
    expect(stored(memory)).toEqual([{ id: "a" }]);
  });

  it("writes nothing when the change has nothing to write", async () => {
    const memory = setup({ [KEY]: [{ id: "a" }] });
    const result = await memory.mutate(KEY, toItems, (items) => ({ next: null, result: items.length }));
    expect(result).toBe(1);
    expect(memory.writes()).toBe(0);
  });

  it("reruns the change against the newer list when another save landed in between, keeping both", async () => {
    const memory = setup({ [KEY]: [{ id: "a" }] });
    let runs = 0;
    memory.beforeWrite(() => {
      // Another tab's save, landing once between this read and this write.
      memory.beforeWrite(null);
      memory.set(KEY, JSON.stringify([{ id: "a" }, { id: "other" }]));
    });
    const result = await memory.mutate(KEY, toItems, (items) => {
      runs += 1;
      return append("b")(items);
    });
    expect(result).toEqual({ id: "b" });
    expect(runs).toBe(2);
    expect(memory.conflicts()).toBe(1);
    expect(memory.pauses).toEqual([1]);
    expect(stored(memory)).toEqual([{ id: "a" }, { id: "other" }, { id: "b" }]);
  });

  it("keeps both of two saves that overlap", async () => {
    const memory = setup({ [KEY]: [] });
    // Both read before either writes: the old read-modify-write lost one.
    let reads = 0;
    let release: () => void = () => {};
    const bothRead = new Promise<void>((resolve) => (release = resolve));
    const read = memory.store.read;
    memory.store.read = async (key) => {
      const value = await read(key);
      reads += 1;
      if (reads === 2) release();
      await bothRead;
      return value;
    };
    await Promise.all([memory.mutate(KEY, toItems, append("x")), memory.mutate(KEY, toItems, append("y"))]);
    const ids = (stored(memory) as Item[]).map((item) => item.id).sort();
    expect(ids).toEqual(["x", "y"]);
    expect(memory.conflicts()).toBe(1);
  });

  it("refuses to create a key that another save created first", async () => {
    const memory = setup();
    memory.beforeWrite(() => {
      memory.beforeWrite(null);
      memory.set(KEY, JSON.stringify([{ id: "first" }]));
    });
    await memory.mutate(KEY, toItems, append("b"));
    expect(stored(memory)).toEqual([{ id: "first" }, { id: "b" }]);
  });

  it("gives up with STORE_CONFLICT after the last attempt, leaving the other save in place", async () => {
    const memory = setup({ [KEY]: [] }, 3);
    let n = 0;
    memory.beforeWrite(() => {
      n += 1;
      memory.set(KEY, JSON.stringify([{ id: `other-${n}` }]));
    });
    await expect(memory.mutate(KEY, toItems, append("b"))).rejects.toThrow(STORE_CONFLICT);
    expect(memory.conflicts()).toBe(3);
    expect(memory.pauses).toEqual([1, 2]);
    expect(stored(memory)).toEqual([{ id: "other-3" }]);
  });

  it("does not retry an error the change throws", async () => {
    const memory = setup({ [KEY]: [] });
    let runs = 0;
    const failing = (): MutationStep<Item[], never> => {
      runs += 1;
      throw new Error("refused");
    };
    await expect(memory.mutate(KEY, toItems, failing)).rejects.toThrow("refused");
    expect(runs).toBe(1);
    expect(memory.writes()).toBe(0);
  });

  it("counts a key that already holds exactly the change as written", async () => {
    // A resent command whose first copy already landed must not read as a
    // conflict, or the change would be applied twice.
    const memory = setup({ [KEY]: [] });
    memory.beforeWrite(() => {
      memory.beforeWrite(null);
      memory.set(KEY, JSON.stringify([{ id: "b" }]));
    });
    let runs = 0;
    await memory.mutate(KEY, toItems, (items) => {
      runs += 1;
      return append("b")(items);
    });
    expect(runs).toBe(1);
    expect(stored(memory)).toEqual([{ id: "b" }]);
  });

  it("compares the exact stored text, so a rewrite that parses the same still conflicts", async () => {
    const memory = setup();
    memory.set(KEY, '[ {"id":"a"} ]');
    memory.beforeWrite(() => {
      memory.beforeWrite(null);
      memory.set(KEY, '[{"id":"a"}]');
    });
    let runs = 0;
    await memory.mutate(KEY, toItems, (items) => {
      runs += 1;
      return append("b")(items);
    });
    expect(runs).toBe(2);
    expect(stored(memory)).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("runs an async change, rereading what it awaits on each attempt", async () => {
    const memory = setup({ [KEY]: [] });
    let limit = 1;
    memory.beforeWrite(() => {
      memory.beforeWrite(null);
      memory.set(KEY, JSON.stringify([{ id: "other" }]));
      limit = 0;
    });
    await expect(
      memory.mutate(KEY, toItems, async (items) => {
        const allowed = await Promise.resolve(limit);
        if (allowed === 0) throw new Error("no longer allowed");
        return append("b")(items);
      })
    ).rejects.toThrow("no longer allowed");
    expect(stored(memory)).toEqual([{ id: "other" }]);
  });
});

describe("listOrSeed", () => {
  it("answers the stored list, or the seed when the key is not set or holds something else", () => {
    const seed = [{ id: "seed" }];
    const decode = listOrSeed(seed);
    expect(decode([{ id: "a" }])).toEqual([{ id: "a" }]);
    expect(decode([])).toEqual([]);
    expect(decode(null)).toBe(seed);
    expect(decode("text")).toBe(seed);
  });
});

describe("parseStored", () => {
  it("parses JSON, as the store client does", () => {
    expect(parseStored('[{"id":"a"}]')).toEqual([{ id: "a" }]);
    expect(parseStored("﻿[1]")).toEqual([1]);
  });

  it("keeps text that is not JSON, or a number that would not print back the same, as text", () => {
    expect(parseStored("hello")).toBe("hello");
    expect(parseStored("0012")).toBe("0012");
    expect(parseStored("12")).toBe(12);
  });
});
