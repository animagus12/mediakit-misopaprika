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

// No "primary" flag on Contact — just the first one on file for this brand.
export function primaryContactForBrand(brand: Pick<Brand, "id" | "agencyId">, contacts: Contact[]): Contact | null {
  return contactsForBrand(brand, contacts)[0] ?? null;
}

export function contactsForAgency(agencyId: string, contacts: Contact[]): Contact[] {
  return contacts.filter((contact) => contact.agencyId === agencyId);
}
