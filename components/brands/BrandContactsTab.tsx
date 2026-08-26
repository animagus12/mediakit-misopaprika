import { Card, CardContent } from "@/components/ui/card";
import { ContactCard } from "./ContactCard";
import { NewContactButton } from "./NewContactButton";
import type { Contact } from "@/repositories/contacts";

interface BrandContactsTabProps {
  brandId: string;
  agencyId: string | null;
  agencyName: string | null;
  contacts: Contact[];
}

export function BrandContactsTab({ brandId, agencyId, agencyName, contacts }: BrandContactsTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <NewContactButton brandId={brandId} agencyId={agencyId} agencyName={agencyName} />
      </div>

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">No contacts yet.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              brandId={brandId}
              agencyId={agencyId}
              agencyName={agencyName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
