export interface BrandNote {
  id: string;
  brandId: string;
  body: string;
  createdAt: string; // ISO datetime
}

export interface NewBrandNote {
  brandId: string;
  body: string;
}
