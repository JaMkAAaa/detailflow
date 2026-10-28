# KSeF 2.0 — TEST oraz PROD za flagą

PROD nie jest globalnym `KSEF_ENV`. Włącza go flaga `ksef_prod` i `Studio.ksefEnv=production`.
Token TEST (prefiks `test`, klucz `KSEF_TOKEN_ENCRYPTION_KEY`) nie odszyfruje się jako PROD
(prefiks `production`, klucz `KSEF_PROD_TOKEN_ENCRYPTION_KEY`). Host PROD to wyłącznie
`https://api.ksef.mf.gov.pl`. Tryb offline KSeF jest poza zakresem.

# KSeF 2.0 TEST — #44

`client.ts` implementuje kontrakt [oficjalnego API TEST v2](https://api-test.ksef.mf.gov.pl/docs/v2/index.html)
(sprawdzony z OpenAPI 2.9.0): challenge, token RSA-OAEP/SHA-256, sesję FA (3),
XML AES-256-CBC, status dokumentu, UPO XML oraz zamknięcie sesji.
Połączenia mają timeout, blokują przekierowania i korzystają wyłącznie z hosta TEST.

## Konfiguracja i token

- `KSEF_ENV=test`. Każda inna wartość, w tym `production` i `prod`, powoduje throw
  również przy `SKIP_ENV_VALIDATION=1`. `NODE_ENV=production` jest dozwolony:
  oznacza wdrożenie aplikacji, nie środowisko MF.
- `KSEF_API_URL=https://api-test.ksef.mf.gov.pl` (opcjonalnie z `/v2`). Inny URL jest odrzucany.
- `KSEF_TOKEN_ENCRYPTION_KEY`: dokładnie 32 losowe bajty w base64,
  np. wygenerowane przez `openssl rand -base64 32`. Klucz poza bazą i repozytorium.
- `REDIS_URL`: Redis dla BullMQ, wspólny dla web i worker.
- `PUT /api/studios/:studioId/ksef/token`, JSON `{ "token": "…" }`:
  wymaga sesji właściciela (`studio:settings`) i prawidłowego Origin. Odpowiedź 204.
  Nie zwraca tokenu. Studio musi mieć `ksefEnv=test` i skonfigurowany NIP.
- Token zapisujemy w `Studio.ksefTokenEnc` jako AES-256-GCM. AAD wiąże go z ID studia,
  środowiskiem TEST i wersją formatu. Nie można przenieść szyfrogramu do innego studia.
  Zmiana klucza wymaga ponownego zapisania tokenów (brak automatycznej rotacji w tym issue).

## Punkt podłączenia #43

Generator XML FA(3) i jego walidator XSD są zakresem otwartego **#43**; nie ma ich
w tym checkoutcie. Dlatego obecny wizard pozostaje demonstracją i nie wysyła dokumentów.
Po wdrożeniu #43 handler wystawienia, po autoryzacji `invoices:manage` i sprawdzeniu
Origin, wywołuje serwerową funkcję:

```ts
await queueTestInvoice(studioId, invoiceId, async (studioId, invoiceId) => {
  const xml = await generateInvoiceXml(studioId, invoiceId); // dostarcza #43
  return { xml, validateXsd: () => validateFa3Xsd(xml) };     // dostarcza #43
});
```

Przygotowanie i walidacja odbywają się na serwerze. Nie ma publicznego endpointu
przyjmującego XML lub flagę „validated”. Kolejka przyjmuje wyłącznie wystawioną fakturę
TEST po zakończonym zleceniu. Po pomyślnej walidacji zapisuje niezmienny XML, jego
SHA-256, status `queued` i wpis historii w jednej transakcji. Nie przelicza kwot.
XML i sekrety nie trafiają do Redis; payload zadania zawiera tylko ID studia i faktury.

## Worker i historia D-09/D-10

`pnpm worker` / `pnpm worker:start` uruchamia dotychczasowy outbox mailowy i worker
BullMQ `ksef-test`. Co 15 sekund skan outboxa naprawia błąd dodania zadania do Redis.
Odkrywanie tenantów jest operacją platformy; odczyty i zapisy dokumentów po ID
używają `studioDb(studioId)`. Migrację wdraża się przez `pnpm db:deploy`.

Zadanie ma 10 prób, backoff od 5 s do 5 min (respektuje dłuższy Retry-After).
Poll ponownie używa zapisanych referencji. Wpisy `validated`, `sent`, `processing`,
`timeout`, `retry_scheduled`, `accepted` i `rejected` zasilają istniejący widok historii.
Numer i data przyjęcia pochodzą z MF; UPO zapisujemy w `Invoice.ksefUpoXml`, skąd
pobiera je istniejący przycisk UPO. Ekrany zachowują oznaczenie TEST.

Przed POST faktury zapisujemy `sendStartedAt` i referencję sesji. Po utracie odpowiedzi
lub restarcie odszukujemy dokument po hashu w tej samej sesji. Nie wysyłamy go ponownie.
Jeżeli wyniku nie można ustalić, po wyczerpaniu prób status `retrying` pozostaje w D-10
z wpisem o konieczności weryfikacji przez operatora. Nie uruchamia go ponownie skan
outboxa. Ręczne ponawianie nie jest częścią tego issue.

Odrzucenie danych (np. status 450/NIP), błędy uprawnień i HTTP 4xx poza 429 kończą
zadanie przez `UnrecoverableError`: `rejected`, bez automatycznej kolejnej próby.
Przyjętego numeru nie usuwamy przy opóźnieniu pobrania UPO. Pobranie UPO ponawiamy
w ramach limitu zadania; po jego wyczerpaniu historię powinien sprawdzić operator.
Nie logujemy treści odpowiedzi MF ani wyjątków zawierających dane lub sekrety.

Seed FV/41 pozostaje demonstracją: 24.10.2026 10:12:08 → 10:13:08 Europe/Warsaw,
60 s, zlecenie DF-0243. Seed nie jest wysyłany do MF i nie otrzymuje rekordu submission.

## Testy

`pnpm test src/ksef/client.test.ts src/worker/ksef.test.ts` — testy kryptografii i
kontraktu HTTP z podmienionym transportem oraz testy integracyjne na PostgreSQL.
Test workera sprawdza izolację studiów, walidację przed enqueue, outbox, restart,
NIP bez retry, ograniczony poll, UPO i historię 60 s. Publiczny certyfikat i klucz
w `fixtures/test-only-*` służą wyłącznie testom jednostkowym.

`KSEF_REDIS_TEST_URL=redis://localhost:6379/15` włącza dodatkowo test prawdziwego
BullMQ/Redis: ponowienie błędu przejściowego i zatrzymanie błędnego NIP po jednej
próbie. CI uruchamia Redis i ten test. Nie używać produkcyjnego Redis ani bazy danych.
Testy nie łączą się z MF. Pełna weryfikacja E2E z MF wymaga #43 oraz rzeczywistego
NIP i tokenu TEST studia.
