# Tokeny i decyzja wyceny (#40)

`createPortalLink(studioDb(studioId), studioId, { quoteId } | { workOrderId })`
wydaje ścieżkę `/p/[token]` z losowym tokenem 256 bitów; baza przechowuje
wyłącznie SHA-256. TTL: 14 dni. `revokePortalLink` odwołuje jeden link.
Link ma dokładnie jeden cel (CHECK w migracji); złożone FK pilnują tenanta.
Bezpośredni link do wyceny działa przed utworzeniem zlecenia. Starsze linki
zleceń korzystają z `WorkOrder.quoteId`.

API studia (sesja, `orders:update`, kontrola Origin):

- `POST /api/studios/:studioId/portal-links`, JSON `{ quoteId }` albo `{ workOrderId }`,
  odpowiedź 201: `{ id, expiresAt, path }`. `path` jest sekretem — nie logować
  odpowiedzi; przekazać go do klienta wyłącznie w adresie URL.
- `DELETE /api/studios/:studioId/portal-links/:linkId`, 204, idempotentne.

Odkrycie studia po hashu tokenu to jedyny odczyt operacyjnego modelu przez
`platformDb`, na granicy autoryzacji. Dalsze operacje używają `studioDb`.
Losowy, błędny, wygasły i odwołany token pokazują ten sam P-02.
Portal nie wymaga sesji studia. GET niczego nie akceptuje (bezpieczny dla
skanerów poczty); decyzja wymaga POST z poprawnym Origin. Odczyt jest dynamiczny,
bez cache, bez indeksowania, z `Referrer-Policy: no-referrer`.

`decideQuote` zmienia wyłącznie `sent` z pustym `decidedAt`. Aktualizacja warunkowa
blokuje ponowną decyzję, także przez inny link i w równoległych transakcjach.
Decyzja nie odwołuje linku do podglądu; odświeżenie pokazuje potwierdzenie bez
formularza. Przegrany POST pokazuje P-02. Nie tworzy zlecenia ani faktury.

W tej samej transakcji powstaje `QuoteDecisionMail` (bez tokenu/URL).
Worker co 15 s pobiera oczekujące wpisy per studio i wysyła do właścicieli
przez `SMTP_URL`/`EMAIL_FROM`. Bez SMTP wpisy pozostają oczekujące; błąd SMTP
wycofuje oznaczenie wysyłki i pozwala ponowić ją w kolejnym obiegu.
Blokada wiersza chroni przed równoległą wysyłką przez dwa workery.
Dostarczenie SMTP ma semantykę co najmniej raz: awaria po przyjęciu maila przez
SMTP, a przed commitem może spowodować duplikat (stały Message-ID pomaga
odbiorcy go rozpoznać). Awaria poczty nigdy nie cofa decyzji klienta.

Next dev ma wyłączone logowanie pełnych URL, a seed nie wypisuje tokenów.
Przy wdrożeniu proxy/APM musi również maskować `/p/*` i wyłączać rejestrowanie
body odpowiedzi API wydającego link. Nie używać loggera maili auth do wysyłki
linków portalu, ponieważ jego tryb developerski wypisuje treść wiadomości.
P-01 czyta powiązane zlecenie, auto i klienta przez `studioDb`; dane do widoku
są przekazywane bez tokenu. Link samej wyceny zachowuje formularz decyzji.
Mapowanie etapów i zakres widoku opisuje `components/portal/README.md`.

Testy `links.test.tsx` wymagają osobnej bazy PostgreSQL z migracjami. Obejmują
hash/TTL/revoke, P-02, akceptację/odrzucenie, wyścig przez dwa linki, CSRF,
autoryzację API, izolację tenantów i ponowienie powiadomienia po awarii SMTP.
