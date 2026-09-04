import type { Brand } from "@/repositories/brands";
import type { Contact } from "@/repositories/contacts";

// A brand's contact list is its own direct contacts plus its agency's
// contacts — an agency contact (e.g. IPLIX's Rajveer) reps every brand
// under that agency, so it surfaces here without being re-entered per
// brand. See Contact.brandId/agencyId in repositories/contacts.ts.
export function contactsForBrand(brand: Pick<Brand, "id" | "agencyId">, contacts: Contact[]): Contact[] {
  return contacts.filter(
    (contact) => contact.brandId === brand.id || (brand.agencyId !== null && contact.agencyId === brand.agencyId)
  );
}

// Defers to the brand's chosen primaryContactId (set on the brand form when
// there's more than one eligible contact) when it's still among this brand's
// contacts, falling back to the first one on file otherwise.
export function primaryContactForBrand(
  brand: Pick<Brand, "id" | "agencyId" | "primaryContactId">,
  contacts: Contact[]
): Contact | null {
  const eligible = contactsForBrand(brand, contacts);
  if (brand.primaryContactId) {
    const chosen = eligible.find((contact) => contact.id === brand.primaryContactId);
    if (chosen) return chosen;
  }
  return eligible[0] ?? null;
}

export function contactsForAgency(agencyId: string, contacts: Contact[]): Contact[] {
  return contacts.filter((contact) => contact.agencyId === agencyId);
}
