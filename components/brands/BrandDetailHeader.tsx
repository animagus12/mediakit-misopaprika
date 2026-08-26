import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { brandStatusStyle } from "@/lib/brands";
import { DeleteBrandButton } from "./DeleteBrandButton";
import { EditBrandButton } from "./EditBrandButton";
import type { Agency } from "@/repositories/agencies";
import type { Brand } from "@/repositories/brands";

interface BrandDetailHeaderProps {
  brand: Brand;
  agencyName: string | null;
  agencies: Agency[];
}

export function BrandDetailHeader({ brand, agencyName, agencies }: BrandDetailHeaderProps) {
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
          <Avatar size="lg">
            <AvatarImage src={brand.logoUrl ?? undefined} alt="" />
            <AvatarFallback>{brand.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
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
          <EditBrandButton brand={brand} agencies={agencies} />
          <DeleteBrandButton id={brand.id} name={brand.name} />
        </div>
      </div>
    </div>
  );
}
