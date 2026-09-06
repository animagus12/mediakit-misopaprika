"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignBrandLogo } from "@/app/brands/actions";
import type { Brand } from "@/repositories/brands";
import type { MediaKitLogo } from "@/repositories/mediakit";

interface MediaKitLogosSectionProps {
  logos: MediaKitLogo[]; // media kit logos not yet linked to any brand
  brands: Brand[]; // brands without a logo of their own yet
}

// Bulk one-time cleanup: the media kit's "Past collabs" grid already has
// real uploaded logos with no brand identity attached; this lets a creator
// walk through them once and attach each to its brand instead of
// re-uploading the same image via BrandLogoUploadField. Shrinks to nothing
// (and stops rendering) as logos get assigned.
export function MediaKitLogosSection({ logos, brands }: MediaKitLogosSectionProps) {
  if (logos.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-heading text-sm font-semibold">Unassigned media kit logos</h2>
        <p className="text-xs text-muted-foreground">
          Already uploaded on your media kit: pick which brand each belongs to instead of re-uploading.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {logos.map((logo) => (
          <LogoAssignCard key={logo.src} logo={logo} brands={brands} />
        ))}
      </div>
    </section>
  );
}

function LogoAssignCard({ logo, brands }: { logo: MediaKitLogo; brands: Brand[] }) {
  const [brandId, setBrandId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAssign() {
    if (!brandId) return;
    setError(null);
    startTransition(async () => {
      const result = await assignBrandLogo(brandId, logo.src);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo.src}
          alt=""
          className="size-12 shrink-0 rounded-md border border-border bg-white object-contain p-1"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Button type="button" size="sm" disabled={!brandId || isPending} onClick={handleAssign}>
          {isPending ? "Assigning…" : "Assign"}
        </Button>
      </CardContent>
    </Card>
  );
}
