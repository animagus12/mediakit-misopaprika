import servicesJson from "@/data/services.json";

export interface ServicePackage {
  name: string;
  price: string;
  description: string;
  color: string;
  isPopular?: boolean;
  features: string[];
}

export interface ServiceAddOn {
  category: string;
  items: string[];
}

export interface ServicesData {
  title: string;
  description: string;
  packages: ServicePackage[];
  addOns: ServiceAddOn[];
  terms: string[];
  definitions: string[];
}

export interface IServicesRepository {
  get(): ServicesData;
}

class JsonServicesRepository implements IServicesRepository {
  get(): ServicesData {
    return servicesJson;
  }
}

export const servicesRepository: IServicesRepository = new JsonServicesRepository();
