import "server-only";
import { getRedis } from "@/lib/cache";
import contactsSeed from "@/data/contacts.json";
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

export async function updateContact(input: ContactUpdate): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const contacts = await readContacts();
  const updated = contacts.map((contact): Contact =>
    contact.id === input.id
      ? {
          ...contact,
          name: input.name.trim(),
          phone: input.phone.trim(),
          brandId: input.brandId,
          agencyId: input.agencyId,
          updatedAt: new Date().toISOString(),
        }
      : contact
  );
  await redis.set(CONTACTS_KEY, updated);
}

export async function deleteContact(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error(REDIS_NOT_CONFIGURED);
  const contacts = await readContacts();
  await redis.set(
    CONTACTS_KEY,
    contacts.filter((contact) => contact.id !== id)
  );
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
