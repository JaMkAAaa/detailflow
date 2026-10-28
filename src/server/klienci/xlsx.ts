import { readSheet, type SheetData } from "read-excel-file/node";
import { ClientError } from "./errors";
import { MAX_CSV_BYTES, parseClientRows } from "./csv";

/** Parse only the first worksheet, then apply the same aliases and validation as CSV. */
export async function parseClientXlsx(buffer: Buffer) {
  if (buffer.length === 0) throw new ClientError(400, "Dołącz niepusty plik XLSX.");
  if (buffer.length > MAX_CSV_BYTES) throw new ClientError(400, "Plik XLSX jest za duży (maks. 1 MB).");

  let rows: SheetData;
  try {
    rows = await readSheet(buffer) as SheetData;
  } catch {
    throw new ClientError(400, "Nieprawidłowy plik XLSX.");
  }

  const table = rows.map((row) => row.map((cell) => cell == null ? "" : cell instanceof Date ? cell.toISOString() : String(cell)));
  return parseClientRows(table, "XLSX");
}
