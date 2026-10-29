// Katalog demonstracyjny D-06 dla testów i wariantu demo kreatora.
// Usługi studia pochodzą z tabeli Service, nie z tego pliku.
export const serviceCatalog = [
  { id: "correction", name: "Korekta lakieru", description: "Dwa etapy · usunięcie mikrorys", price: "2000.00", hours: "8" },
  { id: "ceramic", name: "Powłoka ceramiczna", description: "Ochrona 3 lata · CarPro CQuartz", price: "2000.00", hours: "4" },
  { id: "interior", name: "Detailing wnętrza", description: "Czyszczenie i pielęgnacja wnętrza", price: "650.00", hours: "3" },
  { id: "wash", name: "Mycie detailingowe", description: "Mycie ręczne i dekontaminacja", price: "250.00", hours: "1" },
] as const;
