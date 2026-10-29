# Portal klienta — P-01/P-02 (#122)

Źródła: [P-01](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=5-15)
i [P-02 / S-01](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=17-413).

Publiczna trasa `/p/[token]` weryfikuje hash, TTL i odwołanie PortalLink.
Ważny link zlecenia pokazuje P-01 z jego autem, numerem, usługą, kwotą brutto,
kontaktem studia i datą odbioru (`dueAt`, a bez niej `scheduledTo`). Daty są
formatowane w Europe/Warsaw. Kwota pozostaje dziesiętnym stringiem, bez float.
Brak telefonu ukrywa akcję kontaktu. Zdjęcia należą do osobnego issue;
portal nie podstawia zdjęcia Porsche z makiety dla innego auta.

Etapy studia 1/2/3/4 mapują się na portal 1/2/3/3: przyjęcie i mycie,
korekta lakieru, ceramika i kontrola. Przyjęte zlecenie oczekuje; do odbioru
oraz zakończone mają wszystkie etapy ukończone. Anulowane ma jawny status
bez aktywnego etapu i obietnicy odbioru. Aktualizacja pochodzi z `updatedAt`.

Link samej wyceny zachowuje formularz decyzji i jej potwierdzenie. Nie wyszukuje
zlecenia przez auto ani klienta. GET nie zapisuje danych. Wszystkie odczyty
operacyjne po odkryciu studia przez hash korzystają z `studioDb(studioId)`.
Zły, wygasły i odwołany link pokazują identyczny P-02, bez kontaktu studia.
Ekran nie importuje danych demo, również dla seedowego tokenu.

Układ wykorzystuje LogoMark, Badge, buttonVariants, EmptyState i tokeny
`--df-*`, maksymalnie 390 px, przyciski minimum 44 px. Brak animacji.

Testy komponentów: `pnpm exec vitest run components/portal/PortalScreen.test.tsx`.
Testy Postgres/trasy: `src/server/portal/links.test.tsx` — izolacja dwóch studiów,
aktualizacja statusu, 3 etapy, GET bez zmian, wygasanie i odwołanie.
