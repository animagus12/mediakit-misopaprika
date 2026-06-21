import sectionsJson from "@/data/sections.json";

export interface SectionItem {
  title: string;
  href: string;
}

export interface SectionsData {
  items: SectionItem[];
}

export interface ISectionsRepository {
  get(): SectionsData;
}

class JsonSectionsRepository implements ISectionsRepository {
  get(): SectionsData {
    return sectionsJson;
  }
}

export const sectionsRepository: ISectionsRepository = new JsonSectionsRepository();
