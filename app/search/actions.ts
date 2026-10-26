"use server";

import { campaignRepository } from "@/repositories/campaignRepository";
import { getAgencies } from "@/repositories/agencies.writer.server";
import { getBrands } from "@/repositories/brands.writer.server";
import { getContacts } from "@/repositories/contacts.writer.server";
import { getInvoices } from "@/repositories/invoices.writer.server";
import type { Campaign } from "@/repositories/campaigns";
import type { Brand } from "@/repositories/brands";
import type { Agency } from "@/repositories/agencies";
import type { Contact } from "@/repositories/contacts";
import type { Invoice } from "@/repositories/invoices";
import type { GlobalSearchResult } from "@/lib/globalSearch";
import { buildInvoiceNumber } from "@/lib/invoice";
import { requireSession } from "@/lib/session.server";

type SearchResponse =
  | { success: true; results: GlobalSearchResult[] }
  | { success: false; error: string };

const MAX_RESULTS_PER_TYPE = 5;
const MAX_QUERY_LENGTH = 100;

function matches(query: string, values: Array<string | null | undefined>): boolean {
  return values.some((value) => value?.toLocaleLowerCase().includes(query));
}

function rank(query: string, label: string, detail: string): number {
  const normalizedLabel = label.toLocaleLowerCase();
  if (normalizedLabel === query) return 0;
  if (normalizedLabel.startsWith(query)) return 1;
  if (normalizedLabel.includes(query)) return 2;
  if (detail.toLocaleLowerCase().startsWith(query)) return 3;
  return 4;
}

function topResults<T>(
  records: T[],
  query: string,
  fields: (record: T) => Array<string | null | undefined>,
  result: (record: T) => GlobalSearchResult
): GlobalSearchResult[] {
  return records
    .filter((record) => matches(query, fields(record)))
    .map((record) => result(record))
    .sort((a, b) => rank(query, a.label, a.detail) - rank(query, b.label, b.detail) || a.label.localeCompare(b.label))
    .slice(0, MAX_RESULTS_PER_TYPE);
}

function brandResults(brands: Brand[], query: string): GlobalSearchResult[] {
  return topResults(
    brands,
    query,
    (brand) => [brand.name, brand.website, brand.instagram, brand.status],
    (brand) => ({
      type: "brand",
      label: brand.name,
      detail: brand.status,
      href: `/brands/${encodeURIComponent(brand.id)}`,
    })
  );
}

function campaignResults(campaigns: Campaign[], query: string): GlobalSearchResult[] {
  return topResults(
    campaigns,
    query,
    (campaign) => [campaign.campaign, campaign.brand, campaign.id, campaign.type, campaign.status],
    (campaign) => {
      const label = campaign.campaign.trim() || campaign.brand || "Untitled campaign";
      return {
        type: "campaign",
        label,
        detail: `${campaign.brand} · ${campaign.status}`,
        href: `/campaigns?q=${encodeURIComponent(label)}`,
      };
    }
  );
}

function invoiceResults(invoices: Invoice[], query: string): GlobalSearchResult[] {
  return topResults(
    invoices,
    query,
    (invoice) => [
      invoice.invoiceNo,
      buildInvoiceNumber(invoice.invoiceNo),
      invoice.client.name,
      invoice.client.contactName,
      invoice.campaignName,
      invoice.status,
    ],
    (invoice) => ({
      type: "invoice",
      label: buildInvoiceNumber(invoice.invoiceNo),
      detail: `${invoice.client.name || invoice.campaignName} · ${invoice.status}`,
      href: `/invoices/${encodeURIComponent(invoice.id)}`,
    })
  );
}

function contactResults(
  contacts: Contact[],
  brands: Brand[],
  agencies: Agency[],
  query: string
): GlobalSearchResult[] {
  const brandsById = new Map(brands.map((brand) => [brand.id, brand]));
  const agenciesById = new Map(agencies.map((agency) => [agency.id, agency]));
  return topResults(
    contacts,
    query,
    (contact) => [
      contact.name,
      contact.phone,
      brandsById.get(contact.brandId ?? "")?.name,
      agenciesById.get(contact.agencyId ?? "")?.name,
    ],
    (contact) => {
      const brand = brandsById.get(contact.brandId ?? "");
      const agency = agenciesById.get(contact.agencyId ?? "");
      const detail = brand?.name ?? agency?.name ?? contact.phone ?? "Contact";
      return {
        type: "contact",
        label: contact.name,
        detail,
        href: brand
          ? `/brands/${encodeURIComponent(brand.id)}`
          : `/brands?q=${encodeURIComponent(contact.name)}`,
      };
    }
  );
}

export async function searchRecords(rawQuery: string): Promise<SearchResponse> {
  const denied = await requireSession();
  if (denied) return denied;

  if (typeof rawQuery !== "string") {
    return { success: false, error: "Enter a search term" };
  }
  const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH).toLocaleLowerCase();
  if (query.length < 2) return { success: true, results: [] };

  try {
    const [brands, campaigns, invoices, contacts, agencies] = await Promise.all([
      getBrands(),
      campaignRepository.getAll(),
      getInvoices(),
      getContacts(),
      getAgencies(),
    ]);
    const results = [
      ...brandResults(brands, query),
      ...campaignResults(campaigns, query),
      ...invoiceResults(invoices, query),
      ...contactResults(contacts, brands, agencies, query),
    ];
    return { success: true, results };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search is temporarily unavailable",
    };
  }
}
