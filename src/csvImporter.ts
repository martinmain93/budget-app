import type { Transaction } from "./types";

/** Bank export CSV format: Account Type, Account Number, Transaction Date, Cheque Number, Description 1, Description 2, CAD$, USD$ */
const EXPECTED_HEADER =
  "Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$,USD$";

function parseDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parts = trimmed.split("/");
  if (parts.length !== 3) return "";
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) return "";
  const d = new Date(year, month - 1, day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseAmount(cad: string, usd: string): number | null {
  const raw = (cad?.trim() || usd?.trim() || "").replace(/,/g, "");
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses CSV content in the format of download-transactions.csv
 * (Account Type, Account Number, Transaction Date, Cheque Number, Description 1, Description 2, CAD$, USD$).
 * Returns transactions with source "manual" and categoryId "uncategorized".
 */
export function parseBankCsv(
  csvText: string,
  bankAccountId: string,
): { transactions: Transaction[]; errors: string[] } {
  const errors: string[] = [];
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { transactions: [], errors: ["CSV has no data rows"] };
  }
  const header = lines[0];
  if (header !== EXPECTED_HEADER) {
    errors.push(`Unexpected header. Expected format: ${EXPECTED_HEADER}`);
  }
  const transactions: Transaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = parseCsvLine(line);
    if (parts.length < 8) {
      errors.push(`Row ${i + 1}: not enough columns`);
      continue;
    }
    const [, , dateStr, , desc1, desc2, cad, usd] = parts;
    const date = parseDate(dateStr);
    if (!date) {
      errors.push(`Row ${i + 1}: invalid date "${dateStr}"`);
      continue;
    }
    const amount = parseAmount(cad, usd);
    if (amount === null) {
      errors.push(`Row ${i + 1}: invalid amount (CAD: "${cad}", USD: "${usd}")`);
      continue;
    }
    const merchant = [desc1?.trim(), desc2?.trim()].filter(Boolean).join(" — ") || "Unknown";
    transactions.push({
      id: `csv-${i}-${date}-${amount}-${hash(merchant)}`,
      bankAccountId,
      date,
      merchant,
      amount,
      categoryId: "uncategorized",
      source: "manual",
    });
  }
  return { transactions, errors };
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

/** Simple CSV line parser that handles quoted fields with commas. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  out.push(current);
  return out;
}
