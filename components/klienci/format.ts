const TIME_ZONE = "Europe/Warsaw";

const date = new Intl.DateTimeFormat("pl-PL", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("pl-PL", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" });
const monthYear = new Intl.DateTimeFormat("pl-PL", { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" });

/** 24.10.2026 */
export const formatDate = (value: Date) => date.format(value);
/** 14.08 */
export const formatShortDate = (value: Date) => shortDate.format(value);
/** „marca 2025” — dopełniacz z datą z dniem, bez dnia. */
export const formatSince = (value: Date) => monthYear.format(value).replace(/^\d+\s/, "");

/** Polska liczba mnoga: 1 wizyta, 2–4 wizyty, 5+ / 12–14 wizyt. */
export function plural(count: number, one: string, few: string, many: string) {
  const tail = count % 100;
  if (count === 1) return `${count} ${one}`;
  if (tail >= 12 && tail <= 14) return `${count} ${many}`;
  return `${count} ${count % 10 >= 2 && count % 10 <= 4 ? few : many}`;
}

export const clientsLabel = (count: number) => plural(count, "klient", "klientów", "klientów");
export const vehiclesLabel = (count: number) => plural(count, "auto", "auta", "aut");
export const visitsLabel = (count: number) => plural(count, "wizyta", "wizyty", "wizyt");

/** Numery stron z wielokropkiem: 1 … 4 5 6 … 12. Zawsze pierwsza i ostatnia; pojedynczą lukę zastępuje numer. */
export function pageItems(current: number, pages: number): (number | "…")[] {
  const shown = [...new Set([1, pages, current - 1, current, current + 1])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const items: (number | "…")[] = [];
  shown.forEach((n, i) => {
    const gap = i > 0 ? n - shown[i - 1]! : 1;
    if (gap === 2) items.push(n - 1);
    if (gap > 2) items.push("…");
    items.push(n);
  });
  return items;
}
