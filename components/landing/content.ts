/** Treści landingu L-01/L-02/L-03. Bez opinii, ocen i logotypów klientów (docs §4.1). */

export const navLinks = [
  { label: "Funkcje", href: "#funkcje", hint: "Kalendarz, zdjęcia, wyceny, faktury" },
  { label: "KSeF", href: "#ksef", hint: "Faktury z wysyłką jednym kliknięciem" },
  { label: "Aplikacja mobilna", href: "#aplikacja", hint: "Portal klienta i panel na telefonie" },
  { label: "Kalkulator", href: "#kalkulator", hint: "Policz, ile oszczędzasz" },
  { label: "Cennik", href: "#pricing", hint: "Od 79 zł miesięcznie" },
  { label: "FAQ", href: "#faq", hint: "Najczęstsze pytania" },
] as const;

export const heroChecks = ["Bez karty kredytowej", "Import klientów z Excela", "Polski support"] as const;

export const capabilities = [
  { value: "2 boksy", label: "przykładowy plan stanowisk" },
  { value: "3 etapy", label: "czytelny postęp w portalu klienta" },
  { value: "1 link", label: "portal klienta bez logowania" },
  { value: "FA(3)", label: "faktury w formacie KSeF" },
] as const;

export const withoutDetailflow = [
  "Dwa auta umówione na ten sam boks, bo ktoś nie odświeżył arkusza",
  "Reklamacja rysy, której „nie było”, i brak zdjęć, żeby to udowodnić",
  "Klient dzwoni 5 razy dziennie z pytaniem „czy już gotowe?”",
  "Wycena liczona na kolanie. SUV za tyle co Yaris",
  "Faktury przepisywane ręcznie, a od 2026 r. jeszcze KSeF",
] as const;

export const withDetailflow = [
  "Kalendarz boksów, który sam pilnuje kolizji i pokazuje wolne okna",
  "Protokół przyjęcia ze schematem auta i zdjęciami, które klient akceptuje",
  "Link dla klienta ze statusem na żywo i zdjęciami postępu",
  "Wycena liczona z wielkości auta i stanu lakieru w 30 sekund",
  "Faktura z zlecenia jednym kliknięciem, wysłana do KSeF automatycznie",
] as const;

export type Feature = { title: string; text: string; icon: "calendar" | "camera" | "calculator" };

export const mainFeatures: readonly Feature[] = [
  {
    icon: "calendar",
    title: "Kalendarz boksów bez kolizji",
    text: "Każde zlecenie zajmuje boks na konkretny czas. System sam pokazuje wolne okna i nie pozwoli wpisać dwóch aut w to samo miejsce.",
  },
  {
    icon: "camera",
    title: "Zdjęcia przed i po",
    text: "Protokół przyjęcia z rysami zaznaczonymi na schemacie auta. Klient akceptuje stan, a Ty masz dowód przy reklamacji.",
  },
  {
    icon: "calculator",
    title: "Wycena w 30 sekund",
    text: "Cena liczy się sama z wielkości auta (małe, średnie, SUV) i stanu lakieru, razem z czasem pracy.",
  },
];

/** Moduły jeszcze poza aplikacją — „Wkrótce”, bez fikcyjnych liczb. Galeria realizacji jest w aplikacji (#145); Instagram nie. */
export const soonFeatures = [
  { title: "Przypomnienia o powłokach", text: "Ceramika po 6 miesiącach? Klient dostanie przypomnienie i zarezerwuje konserwację jednym kliknięciem." },
] as const;

export const portalPoints = [
  "Wysyłasz link SMS-em albo e-mailem",
  "Klient widzi zdjęcia z każdego etapu",
  "Akceptacja wyceny i stanu auta online",
] as const;

export const ksefSteps = [
  { title: "Wystaw z zlecenia", text: "dane klienta i usługi uzupełniają się same" },
  { title: "Walidacja FA(3)", text: "sprawdzamy fakturę przed wysyłką" },
  { title: "Numer KSeF i UPO", text: "status pobieramy z systemu e-Faktur" },
] as const;

export type CompareCell = "yes" | "partial" | "no" | "soon";
export const comparison: readonly { label: string; cells: [CompareCell, CompareCell, CompareCell] }[] = [
  { label: "Kalendarz boksów bez kolizji", cells: ["yes", "no", "partial"] },
  { label: "Protokół przyjęcia ze zdjęciami i schematem auta", cells: ["yes", "no", "no"] },
  { label: "Link dla klienta ze statusem na żywo", cells: ["yes", "no", "no"] },
  { label: "Wycena wg wielkości auta i stanu lakieru", cells: ["yes", "no", "partial"] },
  { label: "Faktury z wysyłką do KSeF", cells: ["yes", "no", "partial"] },
  { label: "Przypomnienia o konserwacji powłok", cells: ["soon", "no", "partial"] },
  { label: "Magazyn chemii z alertami", cells: ["yes", "no", "no"] },
];

export const steps = [
  { n: "01", title: "Załóż konto", text: "Podaj nazwę studia i adres e-mail. Bez karty, bez umowy." },
  { n: "02", title: "Zaimportuj klientów", text: "Wrzuć plik z Excela lub CSV, a my rozpoznamy klientów, auta i numery rejestracyjne." },
  { n: "03", title: "Przyjmij pierwsze auto", text: "Zrób zdjęcia, wyślij klientowi link i obserwuj, jak przestaje dzwonić." },
] as const;

export const scenarios = [
  { text: "Właściciel sprawdza plan boksów, przypisuje pracownika i od razu widzi najbliższy wolny termin.", who: "Właściciel studia", what: "Plan dnia i obłożenie" },
  { text: "Pracownik dokumentuje stan auta, dodaje zdjęcia i kończy etap. Klient widzi aktualny postęp w portalu.", who: "Pracownik na hali", what: "Zdjęcia i postęp prac" },
  { text: "Po zakończeniu zlecenia studio przygotowuje fakturę i śledzi jej status w testowej integracji KSeF.", who: "Obsługa rozliczeń", what: "Faktury i status wysyłki" },
] as const;

export const pricingPlans = [
  {
    id: "solo",
    description: "Dla jednoosobowego studia z jednym boksem.",
    features: ["1 użytkownik, 1 boks", "Klienci, auta i zlecenia", "Kalendarz i wyceny", "Link dla klienta ze statusem", "Faktury z wysyłką do KSeF"],
  },
  {
    id: "studio",
    featured: true,
    description: "Dla studia z zespołem i kilkoma stanowiskami.",
    features: ["Do 5 użytkowników i 4 boksów", "Wszystko z planu Solo", "Zdjęcia przed/po i protokoły", "Import klientów z Excela"],
  },
  {
    id: "pro",
    description: "Dla sieci i dużych studiów, które rosną.",
    features: ["Bez limitu użytkowników i boksów", "Wszystko z planu Studio", "Kilka lokalizacji", "Priorytetowy support i wdrożenie"],
  },
] as const;

export const pricingNotes = ["14 dni trialu bez karty", "Rozliczenie miesięczne, ceny netto", "Import klientów z Excela"] as const;

export const faq = [
  {
    q: "Czy detailflow obsługuje KSeF?",
    a: "Tak. Fakturę wystawiasz z zakończonego zlecenia w strukturze FA(3), a my wysyłamy ją do KSeF 2.0, pilnujemy statusu i pobieramy UPO. Przy chwilowej niedostępności KSeF ponawiamy wysyłkę automatycznie. Tryb offline nie jest jeszcze dostępny.",
  },
  {
    q: "Czy mogę przenieść dane z Excela?",
    a: "Tak. Plik CSV lub Excel z klientami zaimportujesz po założeniu konta, a system rozpozna klientów, auta i numery rejestracyjne.",
  },
  {
    q: "Czy moi klienci muszą instalować aplikację?",
    a: "Nie. Klient dostaje link i otwiera status zlecenia w przeglądarce telefonu, bez aplikacji i bez logowania.",
  },
  {
    q: "Co z bezpieczeństwem danych?",
    a: "Dane każdego studia są od siebie odizolowane, a linki dla klientów są jednorazowo generowane i przechowywane w postaci skrótu. Regulamin i polityka prywatności są w przygotowaniu.",
  },
  {
    q: "Czy mogę zrezygnować w dowolnym momencie?",
    a: "Okres próbny trwa 14 dni i nie wymaga karty. Plan rozliczany jest miesięcznie; szczegóły regulaminu opublikujemy przed startem płatnych planów.",
  },
] as const;
