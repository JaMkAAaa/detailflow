import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { GET as listRoute, POST as createRoute } from "../../../app/api/studios/[studioId]/clients/route";
import { GET as getRoute, PATCH as patchRoute, DELETE as deleteRoute } from "../../../app/api/studios/[studioId]/clients/[clientId]/route";
import { POST as importRoute } from "../../../app/api/studios/[studioId]/clients/import/route";
import { POST as addVehicleRoute } from "../../../app/api/studios/[studioId]/clients/[clientId]/vehicles/route";
import {
  PAGE_SIZE, createClient, createVehicle, deleteClient, getClient, importClientsCsv,
  importClientsXlsx, listClients, updateClient, updateVehicle,
} from "./clients";
import { MAX_CSV_BYTES, parseClientCsv } from "./csv";
import { normalizePlate } from "./plate";
import { parseClientXlsx } from "./xlsx";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn() };
});
vi.mock("../../../lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));

async function makeXlsx(rows: string[][], secondSheetRows?: string[][]) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Klienci").addRows(rows);
  if (secondSheetRows) workbook.addWorksheet("Pominięty").addRows(secondSheetRows);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("CSV and plates", () => {
  it("normalizes plates and parses Excel CSV with BOM, quotes and semicolons", () => {
    expect(normalizePlate("wa 911-pc")).toBe("WA911PC");
    const { rows, errors } = parseClientCsv("\uFEFFimię;telefon;e-mail;marka;model;tablica\n\"Nowak, Adam\";+48 600 123 456;adam@example.com;Porsche;Panamera;WA 911PC\n;123;zly;Audi;A4;WX 1\n");
    expect(errors).toEqual([{ row: 3, message: "Wymagane są imię, marka, model i tablica." }]);
    expect(rows).toMatchObject([{ name: "Nowak, Adam", plate: "WA 911PC", make: "Porsche" }]);
  });
  it("rejects a file without the required columns", () => {
    expect(() => parseClientCsv("a,b\n1,2")).toThrow(/imię, marka, model, tablica/);
  });
  it("reads the first XLSX sheet using the CSV aliases and rejects empty or malformed workbooks", async () => {
    const buffer = await makeXlsx(
      [["imię", "telefon", "e-mail", "marka", "model", "tablica"], ["Ala", "+48 600 111 222", "ala@example.com", "Audi", "A4", "WA 111AA"]],
      [["name", "make", "model", "plate"], ["Ignored", "BMW", "M3", "WX 999XX"]],
    );
    await expect(parseClientXlsx(buffer)).resolves.toMatchObject({
      rows: [{ row: 2, name: "Ala", phone: "+48 600 111 222", email: "ala@example.com", make: "Audi", model: "A4", plate: "WA 111AA" }],
      errors: [],
    });
    const empty = new ExcelJS.Workbook();
    await expect(parseClientXlsx(Buffer.from(await empty.xlsx.writeBuffer()))).rejects.toMatchObject({ status: 400 });
    await expect(parseClientXlsx(Buffer.from("not an xlsx"))).rejects.toMatchObject({ status: 400 });
    await expect(parseClientXlsx(Buffer.alloc(MAX_CSV_BYTES + 1))).rejects.toMatchObject({ status: 400 });
    const tooManyRows = await makeXlsx([
      ["name", "make", "model", "plate"],
      ...Array.from({ length: 5_001 }, (_, index) => [`Client ${index}`, "Audi", "A4", `WA${String(index).padStart(5, "0")}`]),
    ]);
    await expect(parseClientXlsx(tooManyRows)).rejects.toMatchObject({ status: 400, message: expect.stringContaining("5000") });
  });
});

describe("clients CRUD, pagination and tenant isolation (Postgres)", () => {
  const tag = randomUUID();
  const studios: string[] = [];
  let userId: string;
  let outsiderId: string;
  beforeAll(async () => {
    userId = (await platformDb.user.create({ data: { name: tag, email: `${tag}@example.com` } })).id;
    outsiderId = (await platformDb.user.create({ data: { name: "obcy", email: `${tag}-o@example.com` } })).id;
    for (const suffix of ["a", "b"]) {
      const studioId = (await platformDb.studio.create({ data: { status: "active", name: tag, publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}` } })).id;
      studios.push(studioId);
      await studioDb(studioId).membership.create({ data: { studioId, userId, role: "worker" } });
    }
  });
  afterAll(async () => {
    await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
    await platformDb.user.deleteMany({ where: { id: { in: [userId, outsiderId] } } });
  });

  const context = (studioId: string, clientId = "x") => ({ params: Promise.resolve({ studioId, clientId }) });
  const request = (method: string, data?: unknown, origin = "http://localhost:3000", url = "http://localhost:3000/api/clients") =>
    new Request(url, { method, headers: { origin, "content-type": "application/json" }, ...(data ? { body: JSON.stringify(data) } : {}) });

  it("pages 20 rows in SQL and does not hide leftover rows on the client", async () => {
    const a = studios[0]!;
    for (let i = 0; i < 24; i++) {
      await createClient(a, { name: `${tag}-p${String(i).padStart(2, "0")}` });
    }
    const page1 = await listClients(a, { page: 1, q: `${tag}-p` });
    const page2 = await listClients(a, { page: 2, q: `${tag}-p` });
    expect(page1.pageSize).toBe(PAGE_SIZE);
    expect(page1.items).toHaveLength(20);
    expect(page2.items).toHaveLength(4);
    expect(page1.total).toBe(24);
    expect(page1.items.some((row) => row.id === page2.items[0]?.id)).toBe(false);
  });

  it("creates, updates, warns on duplicate plates and still saves", async () => {
    const a = studios[0]!;
    const first = await createClient(a, { name: `${tag}-dup`, vehicle: { make: "BMW", model: "M4", plate: "WW 441TL" } });
    expect(first.warnings).toEqual([]);
    const second = await createVehicle(a, first.id, { make: "BMW", model: "M3", plate: "ww441tl" });
    expect(second.warnings[0]).toMatchObject({ code: "duplicate_plate", plate: "ww441tl" });
    expect(second.warnings[0]!.existing[0]!.vehicleId).toBe(first.vehicles[0]!.id);
    const renamed = await updateClient(a, first.id, { phone: "+48 600 000 001" });
    expect(renamed.phone).toBe("+48 600 000 001");
    await expect(getClient(a, "missing")).rejects.toMatchObject({ status: 404 });
  });

  it("does not mix tenants on read, write, delete or CSV import", async () => {
    const [a, b] = studios as [string, string];
    const csv = "imię,telefon,e-mail,marka,model,tablica\nEwa Mazur,+48 111 111 111,ewa@example.com,Volvo,XC60,WX 712EM\n";
    const imported = await importClientsCsv(a, csv);
    expect(imported.createdClients).toBe(1);
    expect(imported.createdVehicles).toBe(1);
    const again = await importClientsCsv(a, csv);
    expect(again).toMatchObject({ createdClients: 0, createdVehicles: 0, unchanged: 1 });
    await importClientsCsv(b, csv);
    expect(await studioDb(a).client.count({ where: { email: "ewa@example.com" } })).toBe(1);
    expect(await studioDb(b).client.count({ where: { email: "ewa@example.com" } })).toBe(1);

    const inB = await createClient(b, { name: `${tag}-b`, vehicle: { make: "Fiat", model: "Panda", plate: "WW 441TL" } });
    expect(inB.warnings).toEqual([]);
    await expect(getClient(a, inB.id)).rejects.toMatchObject({ status: 404 });
    await expect(updateClient(a, inB.id, { name: "X" })).rejects.toMatchObject({ status: 404 });
    await expect(deleteClient(a, inB.id)).rejects.toMatchObject({ status: 404 });
    expect((await listClients(a, { q: `${tag}-b` })).total).toBe(0);
    expect((await getClient(b, inB.id)).name).toBe(`${tag}-b`);
  });

  it("imports XLSX with the same outcome as CSV, only from its first sheet, and isolates studios", async () => {
    const [a, b] = studios as [string, string];
    const email = `${tag}@xlsx.example.com`;
    const plate = `WX ${tag.slice(0, 5).toUpperCase()}`;
    const rows = [
      ["imię", "telefon", "e-mail", "marka", "model", "tablica"],
      [`${tag}-xlsx-a`, "+48 600 111 222", email, "Audi", "A4", plate],
      [`${tag}-xlsx-b`, "+48 600 111 223", `${tag}-b@xlsx.example.com`, "BMW", "M3", plate],
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const xlsx = await makeXlsx(rows, [
      ["imię", "telefon", "e-mail", "marka", "model", "tablica"],
      [`${tag}-ignored`, "", `${tag}-ignored@xlsx.example.com`, "Tesla", "Y", `WX ${tag.slice(0, 4)}Z`],
    ]);

    const csvResult = await importClientsCsv(a, csv);
    const xlsxResult = await importClientsXlsx(b, xlsx);
    expect(xlsxResult).toMatchObject({
      createdClients: csvResult.createdClients,
      createdVehicles: csvResult.createdVehicles,
      unchanged: csvResult.unchanged,
      invalid: csvResult.invalid,
    });
    expect(xlsxResult.warnings.map(({ code, row, plate: warningPlate }) => ({ code, row, plate: warningPlate })))
      .toEqual(csvResult.warnings.map(({ code, row, plate: warningPlate }) => ({ code, row, plate: warningPlate })));
    const csvRepeat = await importClientsCsv(a, csv);
    const xlsxRepeat = await importClientsXlsx(b, xlsx);
    expect(xlsxRepeat).toMatchObject({
      createdClients: csvRepeat.createdClients,
      createdVehicles: csvRepeat.createdVehicles,
      unchanged: csvRepeat.unchanged,
      invalid: csvRepeat.invalid,
    });
    expect(xlsxRepeat.unchanged).toBe(2);
    for (const studioId of [a, b]) {
      expect(await studioDb(studioId).client.count({ where: { email } })).toBe(1);
      expect(await studioDb(studioId).client.count({ where: { email: `${tag}-ignored@xlsx.example.com` } })).toBe(0);
      expect(await studioDb(studioId).vehicle.count({ where: { plate } })).toBe(2);
    }
    const inA = await studioDb(a).client.findFirst({ where: { email } });
    const inB = await studioDb(b).client.findFirst({ where: { email } });
    expect(inA?.id).not.toBe(inB?.id);
  });

  it("blocks delete when the client has an order", async () => {
    const a = studios[0]!;
    const client = await createClient(a, { name: `${tag}-ord`, vehicle: { make: "Kia", model: "Ceed", plate: "WX ORD01" } });
    await studioDb(a).workOrder.create({
      data: {
        studioId: a, clientId: client.id, vehicleId: client.vehicles[0]!.id, number: `DF-${tag.slice(0, 6)}`,
        status: "accepted", service: "Mycie", scheduledFrom: new Date(), scheduledTo: new Date(), totalGross: "100.00",
      },
    });
    await expect(deleteClient(a, client.id)).rejects.toMatchObject({ status: 409 });
  });

  it("requires a session, membership, origin and returns identical 404s", async () => {
    const a = studios[0]!;
    mocks.session.mockResolvedValue({ user: { id: userId } });
    const created = await createRoute(request("POST", { name: `${tag}-http` }), context(a));
    expect(created.status).toBe(201);
    const { id } = await created.json() as { id: string };
    const other = await createClient(studios[1]!, { name: `${tag}-foreign` });
    mocks.session.mockResolvedValue(null);
    expect((await listRoute(request("GET"), context(a))).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { id: outsiderId } });
    expect((await listRoute(request("GET"), context(a))).status).toBe(403);
    mocks.session.mockResolvedValue({ user: { id: userId } });
    expect((await createRoute(request("POST", { name: "X" }, "https://evil.example"), context(a))).status).toBe(403);
    const foreign = await getRoute(request("GET"), context(a, other.id));
    const missing = await getRoute(request("GET"), context(a, "missing"));
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
    expect((await patchRoute(request("PATCH", { city: "Warszawa" }), context(a, id))).status).toBe(200);
    expect((await addVehicleRoute(request("POST", { make: "Audi", model: "A4", plate: "WX HTTP1" }), context(a, id))).status).toBe(201);
    const listed = await listRoute(request("GET", undefined, "http://localhost:3000", `http://localhost:3000/api/clients?q=${tag}-http&page=1`), context(a));
    expect(listed.status).toBe(200);
    expect((await listed.json()).items.length).toBeLessThanOrEqual(20);
    expect((await importRoute(request("POST", { csv: "imię,marka,model,tablica\nJan,Toyota,Yaris,WX 1" }), context(a))).status).toBe(200);
    expect((await deleteRoute(request("DELETE"), context(a, id))).status).toBe(204);
  });

  it("accepts XLSX multipart uploads and rejects empty or invalid XLSX files with 400", async () => {
    const a = studios[0]!;
    mocks.session.mockResolvedValue({ user: { id: userId } });
    const workbook = await makeXlsx([
      ["imię", "marka", "model", "tablica"],
      [`${tag}-route-xlsx`, "Toyota", "Yaris", `WX ${tag.slice(0, 5).toUpperCase()}`],
    ]);
    const requestWithFile = (file: Blob, name: string) => {
      const form = new FormData();
      form.append("file", file, name);
      return new Request("http://localhost:3000/api/import", {
        method: "POST", headers: { origin: "http://localhost:3000" }, body: form,
      });
    };
    const imported = await importRoute(requestWithFile(new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "clients.xlsx"), context(a));
    expect(imported.status).toBe(200);
    expect(await imported.json()).toMatchObject({ createdClients: 1, createdVehicles: 1, invalid: 0 });
    const empty = await importRoute(requestWithFile(new Blob(), "empty.xlsx"), context(a));
    expect(empty.status).toBe(400);
    const invalid = await importRoute(requestWithFile(new Blob(["bad"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "bad.xlsx"), context(a));
    expect(invalid.status).toBe(400);
  });

  it("moves a vehicle between clients in the same studio", async () => {
    const a = studios[0]!;
    const one = await createClient(a, { name: `${tag}-m1` });
    const two = await createClient(a, { name: `${tag}-m2` });
    const vehicle = await createVehicle(a, one.id, { make: "Mini", model: "Cooper", plate: "WX MINI1" });
    const moved = await updateVehicle(a, vehicle.id, { clientId: two.id });
    expect(moved.clientId).toBe(two.id);
  });
});
