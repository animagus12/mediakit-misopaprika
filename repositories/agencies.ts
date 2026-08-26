import agenciesJson from "@/data/agencies.json";

export interface Agency {
  id: string;
  name: string;
  createdAt: string; // ISO datetime
  updatedAt: string;
}

export interface NewAgency {
  name: string;
}

export interface AgencyUpdate extends NewAgency {
  id: string;
}

export interface IAgencyRepository {
  get(): Agency[];
}

class JsonAgencyRepository implements IAgencyRepository {
  get(): Agency[] {
    return agenciesJson as Agency[];
  }
}

export const agencyRepository: IAgencyRepository = new JsonAgencyRepository();
