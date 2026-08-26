import brandActivityJson from "@/data/brand-activity.json";

export type BrandActivityType = "status_change" | "note" | "call" | "email" | "meeting" | "campaign" | "other";

export interface BrandActivity {
  id: string;
  brandId: string;
  type: BrandActivityType;
  summary: string;
  createdAt: string; // ISO datetime
}

export interface NewBrandActivity {
  brandId: string;
  type: BrandActivityType;
  summary: string;
}

export interface IBrandActivityRepository {
  get(): BrandActivity[];
}

class JsonBrandActivityRepository implements IBrandActivityRepository {
  get(): BrandActivity[] {
    return brandActivityJson as BrandActivity[];
  }
}

export const brandActivityRepository: IBrandActivityRepository = new JsonBrandActivityRepository();
