import "server-only";
import { getRedis, readStored } from "@/lib/cache";
import contactsSeed from "@/data/contacts.json";
import type { RecordChange } from "@/lib/activityDiff";
import { listOrSeed, type Mutation } from "@/lib/storeMutation";
import { mutateStored } from "@/lib/storeWrite.server";
import type { Contact, ContactUpdate, NewContact } from "./contacts";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly.
const CONTACTS_KEY = "contacts";
const SEED = contactsSeed as Contact[];
const toContacts = listOrSeed(SEED);

async function readContacts(): Promise<Contact[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  return toContacts(await readStored<unknown>(CONTACTS_KEY));
}

// Each write is a compare-and-set over the whole list (see
// lib/storeWrite.server.ts), so two saves that overlap are both kept.
function mutateContacts<R>(change: Mutation<Contact[], R>): Promise<R> {
  return mutateStored(CONTACTS_KEY, toContacts, change);
}

// Falls back to the bundled data/contacts.json seed until the first contact
// is added, or whenever Redis isn't configured (e.g. local dev without KV
// env vars).
export async function getContacts(): Promise<Contact[]> {
  return readContacts();
}

export function addContact(input: NewContact): Promise<Contact> {
  const now = new Date().toISOString();
  const contact: Contact = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    phone: input.phone.trim(),
    brandId: input.brandId,
    agencyId: input.agencyId,
    createdAt: now,
    updatedAt: now,
  };
  return mutateContacts((contacts) => ({ next: [...contacts, contact], result: contact }));
}

// Answers the record either side of the write, or null when the id matched
// nothing, so the caller can say what actually changed without re-reading the
// list this already holds. Comparing against the caller's input instead would
// be wrong: the normalising below means a trailing space would read as an edit.
export function updateContact(input: ContactUpdate): Promise<RecordChange<Contact> | null> {
  return mutateContacts((contacts) => {
    const before = contacts.find((contact) => contact.id === input.id);
    if (!before) return { next: null, result: null };
    const after: Contact = {
      ...before,
      name: input.name.trim(),
      phone: input.phone.trim(),
      brandId: input.brandId,
      agencyId: input.agencyId,
      updatedAt: new Date().toISOString(),
    };
    return {
      next: contacts.map((contact) => (contact.id === input.id ? after : contact)),
      result: { before, after },
    };
  });
}

// Returns the contact it removed, or null when the id matched nothing: see
// deleteBrand in brands.writer.server.ts for why.
export function deleteContact(id: string): Promise<Contact | null> {
  return mutateContacts((contacts) => {
    const removed = contacts.find((contact) => contact.id === id) ?? null;
    if (!removed) return { next: null, result: null };
    return { next: contacts.filter((contact) => contact.id !== id), result: removed };
  });
}

export async function restoreContacts(records: Contact[]): Promise<void> {
  if (records.length === 0) return;
  await mutateContacts((contacts) => {
    const existing = new Set(contacts.map((contact) => contact.id));
    const missing = records.filter((record) => !existing.has(record.id));
    return { next: missing.length > 0 ? [...contacts, ...missing] : null, result: undefined };
  });
}

// Cascade for brand deletion: only direct contacts (brandId match), never
// agency contacts, since those still rep the agency's other brands.
export function deleteContactsForBrand(brandId: string): Promise<void> {
  return mutateContacts((contacts) => ({
    next: contacts.some((contact) => contact.brandId === brandId)
      ? contacts.filter((contact) => contact.brandId !== brandId)
      : null,
    result: undefined,
  }));
}
