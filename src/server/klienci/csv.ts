import { z } from "zod";
import { ClientError } from "./errors";
import { normalizeEmail } from "./plate";

export const MAX_CSV_BYTES = 1_048_576;
export const MAX_CSV_ROWS = 5_000;

export type CsvRowError = { row: number; message: string };
export type ParsedCsvRow = {
  row: number;
  name: string;
  phone: string | null;
  email: string | null;
  make: string;
  model: string;
  plate: string;
};

const HEADER = {
  name: new Set(["imie", "name", "klient", "nazwisko"]),
  phone: new Set(["telefon", "phone", "tel", "numertelefonu"]),
  email: new Set(["email", "mail"]),
  make: new Set(["marka", "make", "brand"]),
  model: new Set(["model"]),
  plate: new Set(["tablica", "plate", "nrrej", "nrrejestracyjny", "rejestracja"]),
} as const;

type Column = keyof typeof HEADER;

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function detectDelimiter(line: string) {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') { quoted = !quoted; continue; }
    if (!quoted && ch in counts) counts[ch as keyof typeof counts] += 1;
  }
  const [delimiter, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]!;
  return n > 0 ? delimiter : ",";
}

/** RFC-style CSV with BOM, CRLF, quoted fields and `,` / `;` / tab. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = input.split("\n", 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === delimiter) { row.push(field); field = ""; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += ch;
  }
  if (quoted) throw new ClientError(400, "Nieprawidłowy plik CSV: niezamknięty cudzysłów.");
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function mapHeaders(header: string[]) {
  const index: Partial<Record<Column, number>> = {};
  header.forEach((cell, i) => {
    const key = fold(cell);
    (Object.keys(HEADER) as Column[]).forEach((column) => {
      if (HEADER[column].has(key) && index[column] === undefined) index[column] = i;
    });
  });
  if (index.name === undefined || index.make === undefined || index.model === undefined || index.plate === undefined) {
    throw new ClientError(400, "Nieprawidłowy plik CSV. Potrzebne kolumny: imię, marka, model, tablica.");
  }
  return index as Record<Column, number | undefined>;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseClientCsv(text: string): { rows: ParsedCsvRow[]; errors: CsvRowError[] } {
  if (text.length > MAX_CSV_BYTES) throw new ClientError(400, "Plik CSV jest za duży (maks. 1 MB).");
  const table = parseCsv(text);
  const header = table[0];
  if (!header) throw new ClientError(400, "Nieprawidłowy plik CSV. Potrzebne kolumny: imię, marka, model, tablica.");
  const index = mapHeaders(header);
  const body = table.slice(1);
  if (body.length > MAX_CSV_ROWS) throw new ClientError(400, `Plik CSV ma za dużo wierszy (maks. ${MAX_CSV_ROWS}).`);

  const rows: ParsedCsvRow[] = [];
  const errors: CsvRowError[] = [];
  const cell = (line: string[], column: Column) => {
    const at = index[column];
    return at === undefined ? "" : (line[at] ?? "").trim();
  };

  body.forEach((line, i) => {
    const row = i + 2;
    const name = cell(line, "name");
    const make = cell(line, "make");
    const model = cell(line, "model");
    const plate = cell(line, "plate");
    const phone = cell(line, "phone") || null;
    const rawEmail = cell(line, "email");
    if (!name || !make || !model || !plate) {
      errors.push({ row, message: "Wymagane są imię, marka, model i tablica." });
      return;
    }
    const email = normalizeEmail(rawEmail);
    if (rawEmail && (!email || !emailPattern.test(email))) {
      errors.push({ row, message: "Nieprawidłowy e-mail." });
      return;
    }
    rows.push({ row, name, phone, email, make, model, plate });
  });
  return { rows, errors };
}

export async function readCsvBody(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    return z.object({ csv: z.string().min(1).max(MAX_CSV_BYTES) }).parse(await request.json()).csv;
  }
  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file") ?? form.get("csv");
    if (typeof file === "string" && file.trim()) return file;
    if (file instanceof Blob) {
      if (file.size > MAX_CSV_BYTES) throw new ClientError(400, "Plik CSV jest za duży (maks. 1 MB).");
      const text = await file.text();
      if (!text.trim()) throw new ClientError(400, "Dołącz plik CSV w polu file.");
      return text;
    }
    throw new ClientError(400, "Dołącz plik CSV w polu file.");
  }
  const text = await request.text();
  if (!text.trim()) throw new ClientError(400, "Brak treści CSV.");
  if (text.length > MAX_CSV_BYTES) throw new ClientError(400, "Plik CSV jest za duży (maks. 1 MB).");
  return text;
}
