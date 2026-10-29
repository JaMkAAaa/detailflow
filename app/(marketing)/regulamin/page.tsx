import type { Metadata } from "next";
import { LegalDraftPage } from "@/components/landing/LegalDraftPage";

export const metadata: Metadata = { title: "Regulamin — Detailflow" };

export default function TermsPage() {
  return (
    <LegalDraftPage
      title="Regulamin korzystania z Detailflow"
      sections={[
        { title: "1. Usługodawca i kontakt", content: <p>Dane usługodawcy, w tym nazwa, adres i dane rejestrowe: [do uzupełnienia przed publikacją]. Kontakt: [adres e-mail do uzupełnienia].</p> },
        { title: "2. Usługa", content: <p>Zakres usługi, wymagania techniczne, zasady kont i dostępności systemu wymagają uzupełnienia i zatwierdzenia. Detailflow wspiera organizację pracy studia; nie zastępuje jego obowiązków wobec klientów ani obowiązków podatkowych.</p> },
        { title: "3. Konto i bezpieczeństwo", content: <p>Projekt zasad rejestracji, uprawnień użytkowników, ochrony danych dostępowych i zgłaszania incydentów: [do uzgodnienia].</p> },
        { title: "4. Abonament i płatności", content: <p>Zakres planów, ceny, okres próbny, rozliczenia, rezygnacja i ewentualne zwroty należy opisać zgodnie z zatwierdzoną ofertą i konfiguracją płatności: [do uzupełnienia].</p> },
        { title: "5. Obowiązki użytkownika", content: <p>Użytkownik odpowiada za legalność i poprawność wprowadzanych danych oraz za posiadanie podstaw do ich przetwarzania. Szczegółowe zasady: [do zatwierdzenia].</p> },
        { title: "6. Reklamacje i zakończenie umowy", content: <p>Tryb składania reklamacji, czas odpowiedzi, zawieszenie i zakończenie dostępu: [do uzupełnienia po przeglądzie prawnym].</p> },
      ]}
    />
  );
}
