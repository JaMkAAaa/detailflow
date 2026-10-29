# Playwright smoke

`pnpm build && pnpm test:e2e:smoke` uruchamia Chromium i lokalny serwer standalone.
Potrzebne są PostgreSQL z migracjami i seedem, Redis oraz `xmllint`
(`libxml2-utils` w CI). Używaj osobnej bazy testowej, nigdy danych produkcyjnych.
Adresy można podać przez `DATABASE_URL` i `REDIS_URL`.

`order-invoice-ksef.spec.ts` tworzy osobne studio i członkostwo seedowego
właściciela, następnie przyjmuje auto przez formularz. Rozpoczęcie i końcowy
odbiór zapisuje przez uwierzytelnione API statusu, a trzy etapy kończy przyciskami
na karcie zlecenia. Wystawia fakturę przez wszystkie kroki kreatora i kolejkuje
ją przyciskiem szczegółów. Sprawdza zapis `completed`, numer FV, status `queued`
po odświeżeniu, snapshot XML po walidacji XSD i oczekujące zadanie BullMQ.
Osobna asercja pilnuje, że seedowe `DF-0248` nie dostało faktury.

Konfiguracja wymusza TEST i generuje tymczasowy klucz szyfrowania dla fikcyjnego
tokenu. `web-server.mjs` uruchamia wyłącznie Next i fixture Stripe, **bez workera
KSeF**. Nie uruchamiaj workera obok smoke; test kończy się na kolejce i nie
wywołuje serwerów MF ani nie potrzebuje tokenu MF. Po teście usuwa własne
zadanie, audyt i studio wraz z danymi. Istniejący seed pozostaje bez zmian.
