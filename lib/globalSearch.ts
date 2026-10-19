export type GlobalSearchResultType = "brand" | "campaign" | "invoice" | "contact";

export interface GlobalSearchResult {
  type: GlobalSearchResultType;
  label: string;
  detail: string;
  href: string;
}
