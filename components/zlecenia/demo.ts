/** Test fixture for the D-04 presentation; operational routes load the API record.
 * Amounts are decimal PLN strings (never float). Matches prisma/seed.ts for the quote and stages.
 * Instants carry the Europe/Warsaw offset (CEST until 25.10.2026 03:00).
 */
import type { OrderDetailsData, OrderPhoto } from "./order-types";
export type { HistoryEvent, IntakeDamage, OrderDetailsData, OrderPhoto, OrderStage, StageState } from "./order-types";
export { formatDay, formatDayTime, formatDayYear, formatTime } from "./order-format";

const AUTHOR = "Michał Kowalski";

export const photos: OrderPhoto[] = [
  { no: 1, at: "2026-10-24T08:01:00+02:00", caption: "Przód auta", stage: "Przyjęcie i mycie" },
  { no: 2, at: "2026-10-24T08:01:00+02:00", caption: "Tył auta", stage: "Przyjęcie i mycie" },
  { no: 3, at: "2026-10-24T08:02:00+02:00", caption: "Lewy błotnik — rysa", stage: "Przyjęcie i mycie" },
  { no: 4, at: "2026-10-24T08:02:00+02:00", caption: "Lewy bok", stage: "Przyjęcie i mycie" },
  { no: 5, at: "2026-10-24T08:03:00+02:00", caption: "Prawe drzwi — odprysk", stage: "Przyjęcie i mycie" },
  { no: 6, at: "2026-10-24T08:03:00+02:00", caption: "Prawy bok", stage: "Przyjęcie i mycie" },
  { no: 7, at: "2026-10-24T08:04:00+02:00", caption: "Zderzak — zarysowanie", stage: "Przyjęcie i mycie" },
  { no: 8, at: "2026-10-24T09:10:00+02:00", caption: "Maska po myciu", stage: "Przyjęcie i mycie" },
  { no: 9, at: "2026-10-24T09:12:00+02:00", caption: "Dach po myciu", stage: "Przyjęcie i mycie" },
  { no: 10, at: "2026-10-24T09:14:00+02:00", caption: "Felgi po myciu", stage: "Przyjęcie i mycie" },
  { no: 11, at: "2026-10-24T10:40:00+02:00", caption: "Maska — pole testowe", stage: "Korekta lakieru" },
  { no: 12, at: "2026-10-24T11:12:00+02:00", caption: "Tył auta w trakcie korekty", stage: "Korekta lakieru", src: "/orders/porsche-panamera.jpg" },
];

export const order: OrderDetailsData = {
  id: "demo-order",
  clientId: "demo-client",
  number: "DF-0248",
  vehicle: "Porsche Panamera",
  plate: "WA 911PC",
  bay: "Boks 01",
  status: "in-progress",
  service: "Korekta + ceramika",
  // Studio side: 4 stages. The client portal folds them into 3 (P-01), not here.
  stages: [
    { name: "Przyjęcie i mycie", note: "Zakończono o 09:15", state: "done" },
    { name: "Korekta lakieru", note: "Michał · teraz", state: "current" },
    { name: "Aplikacja ceramiki", note: "Dalej: Powłoka ceramiczna · 4 h", state: "todo" },
    { name: "Kontrola i odbiór", note: "Jutro, 16:00", state: "todo" },
  ],
  customer: { id: "demo-client", name: "Adam Nowak", phone: "+48 600 123 456", email: "adam.nowak@example.com" },
  quote: {
    status: "Zaakceptowana",
    items: [
      { name: "Korekta lakieru · 2 etapy", grossPln: "2400.00" },
      { name: "Powłoka ceramiczna · 3 lata", grossPln: "2400.00" },
    ],
    totalGrossPln: "4800.00",
  },
  intake: {
    protocol: "P-0248",
    at: "2026-10-24T08:00:00+02:00",
    by: AUTHOR,
    acceptedAt: "2026-10-24T08:04:00+02:00",
    damages: [
      { no: 1, title: "Rysa na lewym błotniku", part: "Lewy błotnik", size: "Około 4 cm", photo: 3 },
      { no: 2, title: "Odprysk na prawych drzwiach", part: "Prawe drzwi", size: "Około 3 mm", photo: 5 },
      { no: 3, title: "Zarysowanie zderzaka", part: "Zderzak", size: "Dolna krawędź", photo: 7 },
    ],
  },
  photos,
  history: [
    { at: "2026-10-22T18:05:00+02:00", title: "Wycena wysłana do klienta", detail: "4 800 zł brutto", actor: AUTHOR, kind: "studio" },
    { at: "2026-10-22T19:41:00+02:00", title: "Wycena zaakceptowana", actor: "Adam Nowak", kind: "client" },
    { at: "2026-10-22T19:42:00+02:00", title: "Utworzono zlecenie #DF-0248", detail: "Z zaakceptowanej wyceny · Boks 01 · 24.10, 08:00", actor: "System", kind: "system" },
    { at: "2026-10-24T08:00:00+02:00", title: "Przyjęcie auta", detail: "Protokół #P-0248 · 3 uszkodzenia", actor: AUTHOR, kind: "studio" },
    { at: "2026-10-24T08:04:00+02:00", title: "Stan auta zaakceptowany", actor: "Adam Nowak", kind: "client" },
    { at: "2026-10-24T09:15:00+02:00", title: "Zakończono etap: Przyjęcie i mycie", detail: "Rozpoczęto etap: Korekta lakieru", actor: AUTHOR, kind: "studio" },
    { at: "2026-10-24T11:12:00+02:00", title: "Dodano zdjęcie #12", detail: "Tył auta w trakcie korekty", actor: AUTHOR, kind: "studio" },
  ],
};

export function findOrder(number: string) {
  return number === order.number ? order : undefined;
}
