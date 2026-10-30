import { studioDb } from "@/lib/db/tenant";
import { jpkOptions, generateJpk } from "@/src/jpk/export";
import { parseStatisticsRange } from "../statystyki/statistics";
import { invoiceDocument } from "./document";
import { AccessError } from "../acl";
import { validateJpkXsd } from "@/src/jpk/validate";

export async function exportJpk(studioId: string, input: unknown) {
  const options = jpkOptions.parse(input);
  const range = parseStatisticsRange(options);
  const db = studioDb(studioId);
  const invoices = await db.invoice.findMany({
    where: { studioId, status: "issued", ksefEnv: options.env, issuedAt: { gte: range.start, lt: range.end } },
    select: { id: true }, orderBy: [{ issuedAt: "asc" }, { number: "asc" }], take: 5001,
  });
  if (!invoices.length) throw new AccessError(409, "Brak wystawionych faktur w wybranym okresie i środowisku KSeF.");
  if (invoices.length > 5000) throw new AccessError(409, "Eksport obejmuje ponad 5000 faktur. Wybierz krótszy okres.");
  const documents = [];
  for (const invoice of invoices) documents.push(await invoiceDocument(studioId, invoice.id, options.env, db));
  const xml = generateJpk(documents, options);
  await validateJpkXsd(xml);
  return { xml, filename: `JPK_FA-4-${options.from}-${options.to}-${options.env}.xml` };
}
