# Eksport JPK_FA(4) — #150

Przycisk „Eksport JPK” na desktopowej liście `/invoices` pobiera XML JPK_FA(4), wersja schemy 1-0. To eksport faktur klientów studia, bez danych Stripe Billing i bez wysyłki do MF. Nie jest JPK_V7.

## Kontrakt

- Owner/manager (`invoices:manage`), sesja, kontrola Origin i limit żądań API. Endpoint: `POST /api/studios/:studioId/invoices/jpk`.
- Wymagany jawny `env`: `test` albo `production`. Formularz używa środowiska aktualnej listy i pokazuje TEST/PROD; nazwa pliku zawiera środowisko.
- Okres `from`–`to` to obustronnie włączone dni daty wystawienia (`issuedAt`) w Europe/Warsaw. Domyślnie od początku bieżącego miesiąca do dzisiaj. Maksymalnie 366 dni i 5000 faktur, przy przekroczeniu trzeba zawęzić okres.
- Wyłącznie zapisane `Invoice.status=issued`, w tym korekty; bez szkiców. Status KSeF (np. oczekuje, odrzucona) nie wyklucza wystawionej faktury. Zlecenie musi być zakończone, a pozycje i sumy przejść wspólną walidację dokumentu. Każdy odczyt operacyjny przez `studioDb(studioId)`.
- **Pusty okres:** HTTP 409 i „Brak wystawionych faktur w wybranym okresie i środowisku KSeF.” Bez pliku.
- Kwoty PLN z zapisanych pozycji (`Decimal`), grupy VAT 23/8/5/0; kontrola liczby i sumy brutto faktur oraz liczby i sumy netto wierszy. Dla korekt eksportujemy zapisane różnice, z przyczyną i numerem dokumentu źródłowego (również spoza okresu). Nie eksportujemy ilości/ceny jednostkowej korekty, bo model przechowuje je jako stan po korekcie.
- Dane nabywcy są snapshotem faktury. Dane sprzedawcy pochodzą z profilu studia, jak w dotychczasowym eksporcie FA(3); model nie przechowuje historycznego snapshotu sprzedawcy.
- Formularz wymaga kodu urzędu, województwa, powiatu, gminy i numeru budynku; ulica i lokal są opcjonalne. To uzupełnienie struktury adresu, którego model studia nie przechowuje. Nie zapisujemy tych pól w bazie. Nazwa/NIP/miejscowość/kod pocztowy pochodzą z profilu studia; pełny adres w fakturach z jego pola `address`. Użytkownik podaje zgodny podział adresu na pola. Brak danych profilu blokuje eksport.
- XML jest walidowany lokalnym oficjalnym XSD przed pobraniem, z `xmllint --nonet`, limitem czasu i bez ujawniania diagnostyki zawierającej dane nabywców. Nieprawidłowe dane lub kod urzędu spoza słownika XSD blokują plik. Odpowiedź ma `private, no-store`.

## Źródła i wersjonowanie

MF/KAS: [Struktury JPK](https://www.gov.pl/web/kas/struktury-jpk), [JPK_FA(4) XSD](https://www.gov.pl/attachment/aaa27be2-3663-46cd-bf53-f8925f0170b3). Zweryfikowano 30.10.2026. Namespace: `http://jpk.mf.gov.pl/wzor/2022/02/17/02171/`.

Schematy przypięte w `src/jpk/xsd/`: JPK_FA(4) i zależności z `https://crd.gov.pl/xml/schematy/dziedzinowe/mf/2018/08/24/eD/DefinicjeTypy/` (StrukturyDanych, ElementarneTypyDanych, KodyKrajow, KodyUrzedowSkarbowych v5-0E). Zmieniono tylko kodowanie BOM/końce linii i `schemaLocation` na lokalne nazwy. Schematy są kopiowane do obrazu produkcyjnego i śledzone przez Next standalone. Runtime wymaga `xmllint`, tak jak dotychczasowa walidacja FA(3).

Testy: oficjalne XSD (także negatywny test wariantu), korekty i sumy, znaki XML, dwa tenanty, TEST/PROD, szkice, granice dat z przejściem czasu letniego/zimowego, uprawnienia API i formularz błędu pustego okresu. Walidacja struktury nie jest dowodem złożenia ani przyjęcia JPK przez urząd.
