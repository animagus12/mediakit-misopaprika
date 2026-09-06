import { Card, CardContent } from "@/components/ui/card";
import type { Agency } from "@/repositories/agencies";
import type { Brand } from "@/repositories/brands";
import type { Contact } from "@/repositories/contacts";
import { EditAgencySheet } from "./EditAgencySheet";
import { NewAgencyButton } from "./NewAgencyButton";

interface AgenciesSectionProps {
  agencies: Agency[];
  brands: Brand[];
  contacts: Contact[];
}

export function AgenciesSection({ agencies, brands, contacts }: AgenciesSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold">Agencies</h2>
        <NewAgencyButton />
      </div>

      {agencies.length === 0 ? (
        <Card>
          <CardContent className="py-4 text-xs text-muted-foreground">
            No agencies yet. Add one to reuse its contacts across the brands it reps.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {agencies.map((agency) => (
            <EditAgencySheet
              key={agency.id}
              agency={agency}
              brandCount={brands.filter((brand) => brand.agencyId === agency.id).length}
              contacts={contacts.filter((contact) => contact.agencyId === agency.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
