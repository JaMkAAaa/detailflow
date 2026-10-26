/** D-01: stały scenariusz 24.10.2026, 11:30. Bez zapytań i agregacji produkcyjnych (#27).
 * Kwoty PLN jako dziesiętne stringi — bez konwersji do float.
 * Aktywne w prisma/seed.ts: 3 w trakcie + 2 do odbioru + 2 przyjęte.
 * Lista na dziś jest osobnym wycinkiem, zgodnie z Figmą (6 pozycji).
 */
export type TodayOrder = {
  number: string;
  vehicle: string;
  customer: string;
  plate: string;
  service: string;
  status: "in-progress" | "ready-for-pickup" | "scheduled";
  grossPln: string;
};

export const todayOrders: TodayOrder[] = [
  {
    number: "DF-0248",
    vehicle: "Porsche Panamera",
    customer: "Adam Nowak",
    plate: "WA 911PC",
    service: "Korekta + ceramika",
    status: "in-progress",
    grossPln: "4800.00",
  },
  {
    number: "DF-0249",
    vehicle: "Audi Q5",
    customer: "Anna Wiśniewska",
    plate: "WE 482AX",
    service: "Pakiet premium",
    status: "in-progress",
    grossPln: "1200.00",
  },
  {
    number: "DF-0247",
    vehicle: "Kia Sportage",
    customer: "Marek Duda",
    plate: "WI 7731K",
    service: "Pranie tapicerki + ozon",
    status: "in-progress",
    grossPln: "900.00",
  },
  {
    number: "DF-0245",
    vehicle: "BMW Seria 3",
    customer: "Piotr Zieliński",
    plate: "WZ 227LK",
    service: "Detailing wnętrza",
    status: "ready-for-pickup",
    grossPln: "650.00",
  },
  {
    number: "DF-0246",
    vehicle: "Tesla Model 3",
    customer: "Ola Kaczmarek",
    plate: "WX 582TM",
    service: "Serwis powłoki",
    status: "ready-for-pickup",
    grossPln: "400.00",
  },
  {
    number: "DF-0250",
    vehicle: "BMW M4",
    customer: "Tomasz Lis",
    plate: "WW 441TL",
    service: "Detailing wnętrza",
    status: "scheduled",
    grossPln: "650.00",
  },
];

export function formatPln(decimal: string) {
  const [whole = "0", fraction = "00"] = decimal.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${fraction === "00" ? "" : `,${fraction}`} zł`;
}
