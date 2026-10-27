export const CLIENTS_PER_PAGE = 20;

export const CLIENT_FILTERS = ["all", "regular", "coating"] as const;
export type ClientFilter = (typeof CLIENT_FILTERS)[number];

export type ClientsQuery = {
  q: string;
  filter: ClientFilter;
  page: number;
  /** Id klienta z `?client=`; nieznane w studiu id kończy się kartą pierwszego wiersza. */
  client: string | null;
};

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Parametry URL → zapytanie. Śmieci w URL-u wracają do wartości domyślnych, nigdy nie rzucają. */
export function parseClientsQuery(params: Params): ClientsQuery {
  const filter = first(params.filter);
  const page = Number(first(params.page));
  return {
    q: (first(params.q) ?? "").trim().slice(0, 80),
    filter: CLIENT_FILTERS.find((f) => f === filter) ?? "all",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    client: first(params.client)?.trim() || null,
  };
}

/** Adres listy; pomija wartości domyślne, żeby „Wszyscy, strona 1” było czystym `/customers`. */
export function clientsHref(query: Partial<ClientsQuery>) {
  const search = new URLSearchParams();
  if (query.q) search.set("q", query.q);
  if (query.filter && query.filter !== "all") search.set("filter", query.filter);
  if (query.page && query.page > 1) search.set("page", String(query.page));
  if (query.client) search.set("client", query.client);
  const qs = search.toString();
  return qs ? `/customers?${qs}` : "/customers";
}

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

/**
 * Telefony w bazie są wpisane jak „+48 600 123 456”, a użytkownik wpisze „600123”
 * albo „+48600123456”. Dla zapytań wyglądających na numer dokładamy wariant
 * w tym samym formacie (bez +48, cyfry po 3).
 */
export function phoneVariants(q: string) {
  const text = q.trim();
  if (!/^[+\d\s-]+$/.test(text)) return [];
  let digits = text.replace(/\D/g, "");
  if (/^(\+|00)/.test(text) || digits.length > 9) digits = digits.replace(/^(?:00)?48/, "");
  return unique([text, (digits.match(/.{1,3}/g) ?? []).join(" ")]);
}

/** Rejestracje są zapisane z odstępem po symbolu powiatu („WA 911PC”); „wa911” też ma trafić. */
export function plateVariants(q: string) {
  const text = q.trim();
  const compact = text.replace(/\s+/g, "");
  const spaced = compact.replace(/^([a-z]{1,3})(\d)/i, "$1 $2");
  return unique([text, spaced]);
}
