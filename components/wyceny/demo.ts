import Decimal from "decimal.js";
import { z } from "zod";

/** D-06: wyłącznie dane demonstracyjne, bez zapytań operacyjnych. */
export const clients = [
  { id: "adam", name: "Adam Nowak", email: "adam.nowak@example.com", vehicles: [
    { id: "porsche", label: "Porsche Panamera · WA 911PC" },
    { id: "porsche-911", label: "Porsche 911 · WA 243PC" },
  ] },
  { id: "anna", name: "Anna Wiśniewska", email: "anna.wisniewska@example.com", vehicles: [
    { id: "audi", label: "Audi Q5 · WE 482AX" },
  ] },
] as const;

export const services = [
  { id: "correction", name: "Korekta lakieru", description: "Dwa etapy · usunięcie mikrorys", price: "2000.00", hours: "8" },
  { id: "ceramic", name: "Powłoka ceramiczna", description: "Ochrona 3 lata · CarPro CQuartz", price: "2000.00", hours: "4" },
  { id: "interior", name: "Detailing wnętrza", description: "Czyszczenie i pielęgnacja wnętrza", price: "650.00", hours: "3" },
  { id: "wash", name: "Mycie detailingowe", description: "Mycie ręczne i dekontaminacja", price: "250.00", hours: "1" },
] as const;
export const sizes = [
  { id: "small", label: "Małe · ×1,0", multiplier: "1.00" },
  { id: "medium", label: "Średnie · ×1,2", multiplier: "1.20" },
  { id: "suv", label: "SUV · ×1,35", multiplier: "1.35" },
] as const;
export const paints = [
  { id: "standard", label: "Standardowy · ×1,0", multiplier: "1.00" },
  { id: "worn", label: "Wymaga korekty · ×1,2", multiplier: "1.20" },
  { id: "heavy", label: "Mocno zniszczony · ×1,4", multiplier: "1.40" },
] as const;
export const slots = [
  { id: "oct24", label: "24–25 października 2026", day: 24, bay: "Boks 01 · Michał Kowalski", pickup: "25.10, 16:00", start: "24.10, 08:00", hours: 20 },
  { id: "oct26", label: "26–27 października 2026", day: 26, bay: "Boks 02 · Kamil", pickup: "27.10, 16:00", start: "26.10, 08:00", hours: 20 },
  { id: "oct28", label: "28–30 października 2026", day: 28, bay: "Boks 01 · Michał Kowalski", pickup: "30.10, 16:00", start: "28.10, 08:00", hours: 30 },
] as const;

export const draftSchema = z.object({
  version: z.literal(1), step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  clientId: z.enum(["adam", "anna"]), vehicleId: z.enum(["porsche", "porsche-911", "audi"]),
  size: z.enum(["small", "medium", "suv"]), paint: z.enum(["standard", "worn", "heavy"]),
  interior: z.enum(["Lekkie", "Umiarkowane", "Silne"]),
  serviceIds: z.array(z.enum(["correction", "ceramic", "interior", "wash"])).max(4),
  notes: z.string().max(2000), slotId: z.enum(["oct24", "oct26", "oct28"]).nullable(),
}).refine((draft) => clients.find((client) => client.id === draft.clientId)?.vehicles.some((vehicle) => vehicle.id === draft.vehicleId), "Auto musi należeć do klienta");
export type Draft = z.infer<typeof draftSchema>;
export const initialDraft: Draft = {
  version: 1, step: 1, clientId: "adam", vehicleId: "porsche", size: "medium", paint: "standard", interior: "Umiarkowane",
  serviceIds: ["correction", "ceramic"], slotId: "oct24",
  notes: "Cena obejmuje przygotowanie lakieru, aplikację powłoki i kontrolę jakości.\nSamochód pozostaje w studiu do pełnego utwardzenia zabezpieczenia.",
};

// Podgląd UI; docelowy silnik domenowy i jego reguły należą do #36.
// Kwoty pozostają Decimal aż do formatowania; zaokrąglenie HALF_UP do grosza.
export function preview(draft: Draft) {
  const selected = services.filter((service) => draft.serviceIds.includes(service.id));
  const size = sizes.find((size) => size.id === draft.size)!;
  const paint = paints.find((paint) => paint.id === draft.paint)!;
  const multiplier = new Decimal(size.multiplier).times(paint.multiplier);
  const base = selected.reduce((sum, service) => sum.plus(service.price), new Decimal(0));
  const gross = base.times(multiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vat = gross.times(23).div(123).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  // Czasy w katalogu D-06 dotyczą auta średniego (8 h + 4 h = 12 h).
  const hours = selected.reduce((sum, service) => sum.plus(service.hours), new Decimal(0)).div("1.20").times(size.multiplier);
  return { selected, size, paint, base, gross, vat, hours, multiplier };
}

export function pln(value: Decimal.Value) {
  const [integer, fraction] = new Decimal(value).toFixed(2).split(".");
  return `${integer!.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${fraction === "00" ? "" : `,${fraction}`} zł`;
}
export const draftKey = (studioId: string, userId: string) => `detailflow:quote-draft:v1:${studioId}:${userId}`;
