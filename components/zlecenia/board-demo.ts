/** D-03: stały scenariusz 24.10.2026, 11:30. Bez zapytań operacyjnych (UI-only, #30).
 * Numery, rejestracje, statusy, usługi i kwoty odtwarzają ORDERS z prisma/seed.ts (7 aktywnych + zakończone
 * #DF-0244 = 8 w widoku, jak w Figmie). Kwoty PLN jako dziesiętne stringi — bez float.
 * Etykiety terminów są częścią scenariusza (jak linia czasu w kalendarzu).
 */
export type OrderStatus = "accepted" | "in_progress" | "ready_for_pickup" | "completed";

export type BoardOrder = {
  number: string;
  vehicle: string;
  customer: string;
  plate: string;
  service: string;
  employee: "Michał" | "Kamil";
  status: OrderStatus;
  dueLabel: string;
  grossPln: string;
  photo?: string;
};

export const columns: { status: OrderStatus; title: string; color: string }[] = [
  { status: "accepted", title: "Przyjęte", color: "text-df-muted" },
  { status: "in_progress", title: "W trakcie", color: "text-df-lime" },
  { status: "ready_for_pickup", title: "Do odbioru", color: "text-df-blue" },
  { status: "completed", title: "Zakończone", color: "text-df-green" },
];

export const boardOrders: BoardOrder[] = [
  { number: "DF-0251", vehicle: "Volkswagen Golf", customer: "Marcin Król", plate: "WX 4002K", service: "Mycie + wosk", employee: "Kamil", status: "accepted", dueLabel: "Przyjazd: dziś 14:00", grossPln: "350.00" },
  { number: "DF-0252", vehicle: "Volvo XC60", customer: "Ewa Mazur", plate: "WX 712EM", service: "Pranie tapicerki", employee: "Kamil", status: "accepted", dueLabel: "Przyjazd: jutro 09:00", grossPln: "800.00" },
  { number: "DF-0248", vehicle: "Porsche Panamera", customer: "Adam Nowak", plate: "WA 911PC", service: "Korekta + ceramika", employee: "Michał", status: "in_progress", dueLabel: "Odbiór: jutro 16:00", grossPln: "4800.00", photo: "/zlecenia/porsche.png" },
  { number: "DF-0249", vehicle: "Audi Q5", customer: "Anna Wiśniewska", plate: "WE 482AX", service: "Pakiet premium", employee: "Kamil", status: "in_progress", dueLabel: "Odbiór: dziś 12:00", grossPln: "1200.00" },
  { number: "DF-0247", vehicle: "Kia Sportage", customer: "Marek Duda", plate: "WI 7731K", service: "Pranie tapicerki + ozon", employee: "Kamil", status: "in_progress", dueLabel: "Odbiór: dziś 15:00", grossPln: "900.00" },
  { number: "DF-0245", vehicle: "BMW Seria 3", customer: "Piotr Zieliński", plate: "WZ 227LK", service: "Detailing wnętrza", employee: "Kamil", status: "ready_for_pickup", dueLabel: "Odbiór: dziś 12:30", grossPln: "650.00" },
  { number: "DF-0246", vehicle: "Tesla Model 3", customer: "Ola Kaczmarek", plate: "WX 582TM", service: "Serwis powłoki", employee: "Michał", status: "ready_for_pickup", dueLabel: "Odbiór: dziś 15:00", grossPln: "400.00" },
  { number: "DF-0244", vehicle: "Mercedes GLC", customer: "Jan Lewandowski", plate: "WI 631JL", service: "Powłoka ceramiczna", employee: "Michał", status: "completed", dueLabel: "Odebrano: 10:20", grossPln: "3200.00" },
];

export const employees = ["Michał", "Kamil"] as const;

export type OrderFilters = { query: string; employee: string; service: string };

export function filterOrders(orders: BoardOrder[], { query, employee, service }: OrderFilters) {
  const needle = query.trim().toLocaleLowerCase("pl-PL");
  return orders.filter(
    (order) =>
      (!employee || order.employee === employee) &&
      (!service || order.service === service) &&
      (!needle ||
        `${order.vehicle} ${order.customer} ${order.number} ${order.plate}`
          .toLocaleLowerCase("pl-PL")
          .includes(needle)),
  );
}

export function ordersLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun =
    count === 1 ? "zlecenie" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "zlecenia" : "zleceń";
  return `${count} ${noun}`;
}
