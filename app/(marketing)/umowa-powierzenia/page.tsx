import type { Metadata } from "next";
import { LegalDraftPage } from "@/components/landing/LegalDraftPage";

export const metadata: Metadata = { title: "Umowa powierzenia danych — Detailflow" };

export default function DataProcessingAgreementPage() {
  return (
    <LegalDraftPage
      title="Umowa powierzenia przetwarzania danych"
      sections={[
        { title: "1. Strony i role", content: <p>Administrator danych (studio): [dane uzupełnia studio]. Podmiot przetwarzający (operator Detailflow): [nazwa i dane do uzupełnienia]. Role i zakres odpowiedzialności wymagają zatwierdzenia przed zawarciem umowy.</p> },
        { title: "2. Przedmiot, czas i charakter przetwarzania", content: <p>Przedmiotem jest świadczenie i utrzymanie systemu Detailflow na czas obowiązywania umowy głównej, z uwzględnieniem uzgodnionych okresów usuwania lub zwrotu danych. Szczegółowy charakter operacji: [do uzupełnienia].</p> },
        { title: "3. Cel, rodzaje danych i kategorie osób", content: <p>Cel: obsługa procesów studia detailingowego w systemie. Kategorie mogą obejmować dane kontaktowe klientów i pracowników, informacje o pojazdach, zleceniach, wycenach, fakturach oraz zdjęcia aut. Ostateczny wykaz i kategorie osób należy potwierdzić.</p> },
        { title: "4. Bezpieczeństwo i podprocesorzy", content: <p>Środki techniczne i organizacyjne oraz aktualna lista podprocesorów, lokalizacje i zasady zmian: [do uzupełnienia na podstawie wdrożonej konfiguracji i umów].</p> },
        { title: "5. Pomoc administratorowi i incydenty", content: <p>Procedura pomocy przy realizacji praw osób, ocenie skutków i naruszeniach, wraz z kanałem kontaktu i terminami powiadomień: [do zatwierdzenia].</p> },
        { title: "6. Usunięcie lub zwrot danych i audyt", content: <p>Zasady zakończenia usługi, eksportu/zwrotu i usunięcia kopii danych oraz zakres i tryb audytu: [do uzgodnienia]. Nie wpisano kar ani terminów bez decyzji stron i przeglądu prawnego.</p> },
        { title: "7. Kontakt", content: <p>Dane kontaktowe stron i osób odpowiedzialnych za ochronę danych: [do uzupełnienia przed publikacją].</p> },
      ]}
    />
  );
}
