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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-heading text-sm font-semibold">Agencies</h2>
          <p className="text-xs text-muted-foreground">
            Each pill shows how many brands it reps. Open one to edit it or manage its contacts.
          </p>
        </div>
        <div className="shrink-0">
          <NewAgencyButton />
        </div>
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
