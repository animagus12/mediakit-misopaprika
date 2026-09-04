import Link from "next/link";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { brandStatusStyle, missingBrandDetailsLabel, type MissingBrandDetails } from "@/lib/brands";
import { DeleteBrandButton } from "./DeleteBrandButton";
import { EditBrandButton } from "./EditBrandButton";
import type { Agency } from "@/repositories/agencies";
import type { Brand } from "@/repositories/brands";
import type { Contact } from "@/repositories/contacts";

interface BrandDetailHeaderProps {
  brand: Brand;
  agencyName: string | null;
  agencies: Agency[];
  contacts: Contact[];
  missingDetails: MissingBrandDetails | null;
}

export function BrandDetailHeader({ brand, agencyName, agencies, contacts, missingDetails }: BrandDetailHeaderProps) {
  const status = brandStatusStyle(brand.status);

  return (
    <div className="space-y-3">
      <Link
        href="/brands"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Brands
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Avatar size="lg">
              <AvatarImage src={brand.logoUrl ?? undefined} alt="" />
              <AvatarFallback>{brand.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {missingDetails && (
              <span className="absolute top-0 right-0 size-2.5 rounded-full bg-amber-500 ring-2 ring-background" />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="font-heading text-lg font-semibold">{brand.name}</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant={status.variant} className={status.className}>
                {brand.status}
              </Badge>
              <span>·</span>
              <span>{agencyName ? `${agencyName} (agency)` : "Direct relationship"}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <EditBrandButton brand={brand} agencies={agencies} contacts={contacts} />
          <DeleteBrandButton id={brand.id} name={brand.name} />
        </div>
      </div>

      {missingDetails && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
          <CircleAlert className="size-3.5 shrink-0" />
          <span>
            {missingBrandDetailsLabel(missingDetails)} — use Edit to fill it in.
          </span>
        </div>
      )}
    </div>
  );
}
