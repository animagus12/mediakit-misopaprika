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
