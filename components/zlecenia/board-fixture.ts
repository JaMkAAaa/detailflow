import type { BoardOrder } from "./board-demo";

/** Unit-test data only; operational UI receives rows from GET /orders. */
export const boardOrders: BoardOrder[] = [
  { id: "1", clientId: "c1", number: "DF-0251", vehicle: "Volkswagen Golf", customer: "Marcin Król", plate: "WX 4002K", service: "Mycie + wosk", status: "accepted", dueLabel: "Przyjazd: dziś 14:00", grossPln: "350.00" },
  { id: "2", clientId: "c2", number: "DF-0252", vehicle: "Volvo XC60", customer: "Ewa Mazur", plate: "WX 712EM", service: "Pranie tapicerki", status: "accepted", dueLabel: "Przyjazd: jutro 09:00", grossPln: "800.00" },
  { id: "3", clientId: "c3", number: "DF-0248", vehicle: "Porsche Panamera", customer: "Adam Nowak", plate: "WA 911PC", service: "Korekta + ceramika", status: "in_progress", dueLabel: "Odbiór: jutro 16:00", grossPln: "4800.00" },
  { id: "4", clientId: "c4", number: "DF-0249", vehicle: "Audi Q5", customer: "Anna Wiśniewska", plate: "WE 482AX", service: "Pakiet premium", status: "in_progress", dueLabel: "Odbiór: dziś 12:00", grossPln: "1200.00" },
  { id: "5", clientId: "c5", number: "DF-0247", vehicle: "Kia Sportage", customer: "Marek Duda", plate: "WI 7731K", service: "Pranie tapicerki + ozon", status: "in_progress", dueLabel: "Odbiór: dziś 15:00", grossPln: "900.00" },
  { id: "6", clientId: "c6", number: "DF-0245", vehicle: "BMW Seria 3", customer: "Piotr Zieliński", plate: "WZ 227LK", service: "Detailing wnętrza", status: "ready_for_pickup", dueLabel: "Odbiór: dziś 12:30", grossPln: "650.00" },
  { id: "7", clientId: "c7", number: "DF-0246", vehicle: "Tesla Model 3", customer: "Ola Kaczmarek", plate: "WX 582TM", service: "Serwis powłoki", status: "ready_for_pickup", dueLabel: "Odbiór: dziś 15:00", grossPln: "400.00" },
  { id: "8", clientId: "c8", number: "DF-0244", vehicle: "Mercedes GLC", customer: "Jan Lewandowski", plate: "WI 631JL", service: "Powłoka ceramiczna", status: "completed", dueLabel: "Odebrano: 10:20", grossPln: "3200.00" },
];
