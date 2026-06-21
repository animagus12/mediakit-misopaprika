import contactJson from "@/data/contact.json";

export interface ContactField {
  name: string;
  label: string;
  placeholder: string;
  type: string;
  rows?: number;
}

export interface ContactData {
  title: string;
  description: string;
  submitText: string;
  mailto: string;
  fields: ContactField[];
}

export interface IContactRepository {
  get(): ContactData;
}

class JsonContactRepository implements IContactRepository {
  get(): ContactData {
    return contactJson as ContactData;
  }
}

export const contactRepository: IContactRepository = new JsonContactRepository();
