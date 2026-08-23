import type { InvoiceLineItemInput } from "@/repositories/invoice";

export interface InvoiceLineItem extends InvoiceLineItemInput {
  id: string;
}

export function formatMoney(amount: number): string {
  return `₹ ${Number(amount || 0).toLocaleString("en-IN")}`;
}

export function formatInvoiceDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function todayISO(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function buildInvoiceNumber(invoiceNo: string): string {
  return `MSP-INV-${String(invoiceNo || "").trim().padStart(4, "0")}`;
}

export function lineItemTotal(item: InvoiceLineItemInput): number {
  return (Number(item.qty) || 0) * (Number(item.price) || 0);
}

export function computeSubtotal(items: InvoiceLineItemInput[]): number {
  return items.reduce((sum, item) => sum + lineItemTotal(item), 0);
}

export function computeBalanceDue(subtotal: number, advance: number): number {
  return Math.max(subtotal - (Number(advance) || 0), 0);
}
