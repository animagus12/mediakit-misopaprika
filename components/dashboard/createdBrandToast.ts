import { toast } from "sonner";
import type { useRouter } from "next/navigation";
import type { CreatedBrand } from "@/app/(dashboard)/actions";

type NextRouter = ReturnType<typeof useRouter>;

// Shared by NewCampaignButton and EditCampaignSheet: when saving a campaign
// auto-creates a brand (its name didn't match anything in the CRM — see
// resolveOrCreateBrandId in app/(dashboard)/actions.ts), surface it
// immediately rather than letting a bare, detail-less brand sit silently in
// the CRM. The new brand always starts with no photo/contact, so this is the
// one moment the creator's attention is naturally already on this deal.
export function notifyCreatedBrand(createdBrand: CreatedBrand | null, router: NextRouter): void {
  if (!createdBrand) return;
  toast.info(`New brand added: ${createdBrand.name}`, {
    description: "No photo or contact yet — add them when you get a chance.",
    action: {
      label: "Open brand",
      onClick: () => router.push(`/brands/${createdBrand.id}`),
    },
  });
}
