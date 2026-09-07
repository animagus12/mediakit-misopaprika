import "server-only";
import { getRedis } from "@/lib/cache";
import contactsSeed from "@/data/contacts.json";
import type { RecordChange } from "@/lib/activityDiff";
import type { Contact, ContactUpdate, NewContact } from "./contacts";

// server-only, and never imported from a client component: the server
// actions and pages that need it import it directly.
const CONTACTS_KEY = "contacts";
const REDIS_NOT_CONFIGURED = "Upstash Redis not configured: set KV_REST_API_URL and KV_REST_API_TOKEN";
const SEED = contactsSeed as Contact[];

async function readContacts(): Promise<Contact[]> {
  const redis = getRedis();
  if (!redis) return SEED;
  const stored = await redis.get<Contact[]>(CONTACTS_KEY);
  return stored ?? SEED;
}

// Falls back to the bundled data/contacts.json seed until the first contact
// is added, or whenever Redis isn't configured (e.g. local dev without KV
// env vars).
export async function getContacts(): Promise<Contact[]> {
  return readContacts();
}

export async function addContact(input: NewContact): Promise<Contact> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const contacts = await readContacts();
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
  await redis.set(CONTACTS_KEY, [...contacts, contact]);
  return contact;
}

// Answers the record either side of the write, or null when the id matched
// nothing, so the caller can say what actually changed without re-reading the
// list this already holds. Comparing against the caller's input instead would
// be wrong: the normalising below means a trailing space would read as an edit.
export async function updateContact(input: ContactUpdate): Promise<RecordChange<Contact> | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const contacts = await readContacts();
  const before = contacts.find((contact) => contact.id === input.id);
  if (!before) return null;
  const after: Contact = {
    ...before,
    name: input.name.trim(),
    phone: input.phone.trim(),
    brandId: input.brandId,
    agencyId: input.agencyId,
    updatedAt: new Date().toISOString(),
  };
  await redis.set(CONTACTS_KEY, contacts.map((contact) => (contact.id === input.id ? after : contact)));
  return { before, after };
}

// Returns the contact it removed, or null when the id matched nothing: see
// deleteBrand in brands.writer.server.ts for why.
export async function deleteContact(id: string): Promise<Contact | null> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const contacts = await readContacts();
  const removed = contacts.find((contact) => contact.id === id) ?? null;
  await redis.set(
    CONTACTS_KEY,
    contacts.filter((contact) => contact.id !== id)
  );
  return removed;
}

// Cascade for brand deletion: only direct contacts (brandId match), never
// agency contacts, since those still rep the agency's other brands.
export async function deleteContactsForBrand(brandId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const contacts = await readContacts();
  await redis.set(
    CONTACTS_KEY,
    contacts.filter((contact) => contact.brandId !== brandId)
  );
}
