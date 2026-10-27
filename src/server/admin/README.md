# Panel platformy — przegląd A-01 (#52)

`getPlatformOverview` czyta `platformDb` (to jest powierzchnia operatora, nie
tenant). MRR: `calculateMrr` — wyłącznie `Studio.status = active`. Trial,
`past_due`, `suspended` i `canceled` odpadają. Konwersja trialu: studia z
`trialEndsAt <= now`, licznik płatnych to te z `status = active`. Mianownik
to zakończone triale, nie bieżące 24.

Aktywne studio: ≥ 1 zlecenie utworzone lub zaktualizowane w ostatnich 7
dniach, w zbiorze płacących. Aktywacja: ≥ 3 zlecenia w pierwszych 7 dniach
od `createdAt`; studia bez pełnego okna obserwacji nie wchodzą do mianownika.

Testy: `overview.test.ts` (definicje + dwa studia w Postgres) oraz seed
demo 64×79 + 48×149 + 16×279.
