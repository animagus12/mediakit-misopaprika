import { Card, CardContent } from "@/components/ui/card";
import type { Agency } from "@/repositories/agencies";
import type { Brand } from "@/repositories/brands";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="truncate">{value || "—"}</p>
    </div>
  );
}

interface BrandOverviewTabProps {
  brand: Brand;
  agency: Agency | null;
}

export function BrandOverviewTab({ brand, agency }: BrandOverviewTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Website" value={brand.website} />
          <Field label="Instagram" value={brand.instagram} />
        </CardContent>
      </Card>

      {agency && (
        <Card>
          <CardContent className="space-y-2">
            <p className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">Agency</p>
            <Field label="Name" value={agency.name} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
