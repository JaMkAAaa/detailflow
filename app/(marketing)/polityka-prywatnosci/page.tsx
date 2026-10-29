import type { Metadata } from "next";
import { LegalDraftPage } from "@/components/landing/LegalDraftPage";

export const metadata: Metadata = { title: "Polityka prywatności — Detailflow" };

export default function PrivacyPage() {
  return (
    <LegalDraftPage
      title="Polityka prywatności"
      sections={[
        { title: "1. Administrator i kontakt", content: <p>Administratorem danych jest [nazwa i dane administratora do uzupełnienia]. Kontakt w sprawach prywatności: [adres do uzupełnienia]. Nie publikować przed wskazaniem administratora i weryfikacją danych.</p> },
        { title: "2. Cele i podstawy przetwarzania", content: <p>Do uzupełnienia dla obsługi konta, świadczenia usługi, rozliczeń, bezpieczeństwa, wsparcia i obowiązków prawnych — wraz z właściwymi podstawami i okresami. Nie dodano tu niezweryfikowanych podstaw ani terminów.</p> },
        { title: "3. Dane klientów studia i zdjęcia aut", content: <p>Studio wprowadza dane swoich klientów i może dodawać zdjęcia pojazdów. Zdjęcia mogą zawierać tablice rejestracyjne lub elementy otoczenia. Zakres, instrukcje administratora (studio), podstawy studia i uzgodnione okresy przechowywania wymagają opisania przed uruchomieniem produkcyjnym.</p> },
        { title: "4. Portal klienta i token dostępu", content: <p>Portal może udostępniać status zlecenia przez link z tokenem. Token jest sekretem dostępowym; należy opisać jego ważność, unieważnianie oraz środki ograniczające ujawnienie w logach i analityce. Szczegóły podlegają przeglądowi technicznemu i prawnemu.</p> },
        { title: "5. Procesorzy i odbiorcy", content: <p>Lista dostawców hostingu, poczty, płatności, przechowywania plików, monitoringu i innych procesorów oraz ich lokalizacje: [do uzupełnienia na podstawie aktywnej konfiguracji i umów].</p> },
        { title: "6. Retencja, prawa i skargi", content: <p>Okresy retencji dla każdej kategorii danych, sposób realizacji praw osób i właściwy organ nadzorczy wymagają zatwierdzenia. Dane nie są usuwane automatycznie po zakończeniu zlecenia, jeśli nie skonfigurowano takiej funkcji.</p> },
      ]}
    />
  );
}
