# Portal klienta — #39 (UI)

Źródła: [P-01](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=5-15)
i [P-02 / S-01](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=17-413).

Trasa `/p/[token]` jest publiczna, poza layoutem studia. Wszystkie tokeny
przechodzą odczyt PortalLink po hashu oraz kontrolę TTL i odwołania.

- Ważny link demo `/p/obsidian-df-0248-demo` z zaakceptowaną wyceną pokazuje
  statyczny P-01: #DF-0248, 3 etapy, 4 800 zł brutto.
- Wygasły, odwołany i nieznany link pokazuje ten sam P-02 bez danych studia.
- Pozostałe ważne linki pokazują wycenę z formularzem decyzji lub potwierdzeniem.

P-01 pozostaje makietą z zegarem zamrożonym na 24.10.2026, 11:30;
nie służy do prezentowania innych zleceń. Kwota jest dziesiętnym stringiem PLN.
`PortalExpired knownStudio` pozostaje wariantem prezentacyjnym z kontaktem demo;
trasa nie ujawnia kontaktu po wygaśnięciu tokenu. Testy komponentów nie wymagają bazy;
testy trasy i autoryzacji są w `src/server/portal/links.test.tsx`.

Telefon `+48 500 100 200` oraz adres `obsidian@example.com` są kontaktami demo
(Figma i seed nie określają telefonu studia). „Poproś o nowy link” otwiera
wiadomość w aplikacji pocztowej; nie udaje automatycznej wysyłki. Surowy token
nie trafia do treści wiadomości ani komponentów ekranu. Menu „•••” otwiera
kontakt za pomocą natywnego `details`, z obsługą klawiatury.

Użyte wspólne komponenty: LogoMark, Badge, buttonVariants, EmptyState oraz
tokeny `--df-*`. Zdjęcie `/orders/porsche-panamera.jpg` ma identyczny SHA-256
jak asset P-01. Ikona kłódki `/portal/expired-link.svg` pochodzi z S-01,
zachowuje rozmiar 28 × 28 px. Układ ma maksymalnie 390 px, zawija treść na
węższych ekranach. Przyciski mają minimum 44 px wysokości. Brak animacji.

Weryfikacja: `pnpm exec vitest run components/portal/PortalScreen.test.tsx`.
