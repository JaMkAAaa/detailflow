export const orderTabs = [
  { id: "przeglad", label: "Przegląd" },
  { id: "zdjecia", label: "Zdjęcia" },
  { id: "stan-auta", label: "Stan auta" },
  { id: "historia", label: "Historia" },
] as const;

export type OrderTab = (typeof orderTabs)[number]["id"];

/** Unknown or missing `?tab=` falls back to the overview. */
export function parseTab(value: string | undefined): OrderTab {
  return orderTabs.find((tab) => tab.id === value)?.id ?? "przeglad";
}
