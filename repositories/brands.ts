import brandsJson from "@/data/brands.json";

export interface Brand {
  name: string;
  url: string;
  initials: string;
  color: string;
}

export interface BrandsData {
  title: string;
  description: string;
  brands: Brand[];
}

export interface IBrandsRepository {
  get(): BrandsData;
}

class JsonBrandsRepository implements IBrandsRepository {
  get(): BrandsData {
    return brandsJson;
  }
}

export const brandsRepository: IBrandsRepository = new JsonBrandsRepository();
