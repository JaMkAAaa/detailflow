# Wizard wyceny (#37, #38)

`QuoteWizard.tsx`: kroki 1–3, klient/auto z aktywnego studia, katalog, mnożniki,
uwagi, podgląd wiadomości i potwierdzenie. Dane i snapshot poprzedniej wyceny
pochodzą z serwera. Autosave zapisuje szkic w PostgreSQL po 500 ms; localStorage
jest kopią pomocniczą. Przed wysyłką formularz czeka na ostateczny zapis.
Wysłanej/oczekującej wyceny nie edytujemy; dostępne są ponowna wysyłka i nowa wycena.

Układ D-06 zachowany. Kalendarz i terminy są nadal demonstracyjne, bez rezerwacji
boksu. Portal jest jawnym stubem do E8.2. Szczegóły backendu i workera:
`src/server/wyceny/README.md`.

Testy komponentu sprawdzają mnożniki, nawigację, autosave, odtwarzanie szkicu,
końcowy zapis przed wysyłką, ponowną wysyłkę bez ponownego zapisu pozycji i błąd zapisu.
