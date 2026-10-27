// The money book as a CSV for a spreadsheet or an accountant: one row per
// transaction, the same rows and the same words the Payments page shows (see
// lib/moneyBook.ts), so a figure checked on screen is the figure in the file.

import { toSheetDate } from "@/lib/campaigns";
import { financialYearLabel } from "@/lib/financialYear";
import {
  entryAccount,
  entryAmount,
  entryCash,
  entryCategory,
  entryDate,
  entryDetail,
  entryFlags,
  entryFy,
  entryMethod,
  entryTitle,
  type MoneyEntry,
  type MoneyFlow,
} from "@/lib/moneyBook";
import { payerLabel } from "@/lib/payers";

const HEADER = [
  "Date",
  "Financial year",
  "Direction",
  "Category",
  "Description",
  "Details",
  "Amount",
  "TDS",
  "Charges",
  "Cash in or out",
  "Account",
  "Method",
  "Reference",
  "Note",
  "Receipt",
  "Flags",
];

// A spreadsheet runs a cell starting with one of these as a formula; a brand
// name or note typed as "=..." must stay text.
const FORMULA_START = /^[=+\-@\t\r]/;

function text(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function money(value: number): string {
  return value.toFixed(2);
}

function row(entry: MoneyEntry): string[] {
  const fy = entryFy(entry);
  const account = entryAccount(entry);
  const date = entryDate(entry);
  return [
    text(date ? toSheetDate(date) : ""),
    text(fy === null ? "" : financialYearLabel(fy)),
    text(entry.flow === "in" ? "In" : "Out"),
    text(entryCategory(entry)),
    text(entryTitle(entry)),
    text(entryDetail(entry)),
    money(entryAmount(entry)),
    money(entry.kind === "payment" ? entry.row.tds : 0),
    money(entry.kind === "payment" ? entry.row.fee : 0),
    money(entryCash(entry)),
    text(account ? payerLabel(account) : "Not recorded"),
    text(entryMethod(entry) ?? ""),
    text(entry.kind === "payment" ? entry.row.reference : ""),
    text(entry.kind === "outflow" ? entry.row.note : ""),
    text(entry.kind === "outflow" ? (entry.row.receiptUrl ?? "") : ""),
    text(entryFlags(entry).join("; ")),
  ];
}

/**
 * Every entry as one CSV row under a header. "Amount" is always positive (a
 * payment before TDS and charges); "Cash in or out" is signed, so summing it
 * gives the net cash flow. Starts with a byte-order mark so a spreadsheet
 * reads the file as UTF-8, and ends lines with CRLF as RFC 4180 asks.
 */
export function moneyCsv(entries: MoneyEntry[]): string {
  const lines = [HEADER.map(text), ...entries.map(row)].map((cells) => cells.join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** "payments-fy-2026-27-money-in.csv", "payments-all-years.csv". */
export function moneyCsvFilename(fy: number | null, flow: MoneyFlow | null): string {
  const span = fy === null ? "all-years" : financialYearLabel(fy).toLowerCase().replace(/\s+/g, "-");
  return `payments-${span}${flow ? `-money-${flow}` : ""}.csv`;
}
