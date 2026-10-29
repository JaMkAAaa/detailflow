# Zdjęcia zlecenia i protokół przyjęcia (#33)

Wszystkie operacje używają `studioDb(studioId)`; API wymaga sesji, membershipu
studia (owner/manager/worker) i — przy mutacjach — zgodnego Origin. Mutacje
wymagają uprawnienia `orders:write`. `workOrderId` to `id` zlecenia, nie `DF-…`.
Zlecenie z innego studia i brak zlecenia → ten sam 404.

## Zdjęcia (`photos.ts`)

Bucket S3 (MinIO lokalnie, R2 w prod) jest prywatny. Klucz:
`studios/<studioId>/orders/<workOrderId>/<photoId>.<jpg|png|webp|heic>`.

1. `POST /api/studios/:studioId/orders/:workOrderId/photos`
   `{ contentType, sizeBytes, stage?, caption? }` → 201 z `uploadUrl` (podpisany PUT, 5 min),
   `key`, `no`. Rezerwuje numer zdjęcia w zleceniu; zdjęcie jest jeszcze niewidoczne.
   `stage` 1–4 (domyślnie bieżący etap zlecenia), do 20 MB, JPEG/PNG/WebP/HEIC.
2. Klient robi `PUT uploadUrl` z nagłówkiem `Content-Type` z odpowiedzi.
   Typ i długość ciała wchodzą do podpisu, więc inny plik dostaje 403 od S3.
3. `POST …/photos/confirm` `{ key }` → serwer sprawdza obiekt (`HeadObject`: rozmiar i typ).
   Niezgodny plik jest usuwany z bucketu i z bazy (400); brak pliku → 409.
   Dopiero potwierdzone zdjęcie trafia do listy. Wywołanie jest idempotentne.
4. `GET …/photos` → zdjęcia po numerze z metadanymi (`uploadedBy`, `createdAt`,
   `uploadedAt`, `stage`) i podpisanym GET (`url`, 5 min). Nie ma publicznych URL-i.

`key` spoza prefiksu `studios/<studioId>/` → **403** (`assertKeyInStudio`), zanim
cokolwiek trafi do bazy lub S3; klucz o złym kształcie (np. `..`) → 400.

Presigned URL musi być osiągalny z przeglądarki, a podpis obejmuje host. Dlatego
`S3_PUBLIC_ENDPOINT` (domyślnie `S3_ENDPOINT`) służy do podpisywania; w Compose
`S3_ENDPOINT` to `minio:9000`, więc lokalnie ustaw `S3_PUBLIC_ENDPOINT=http://localhost:9000`.

Niepotwierdzone wiersze (`uploadedAt = null`) nie są listowane. Worker co 15 s
usuwa do 100 takich wierszy na studio, starszych niż 24 h (próg
`UNCONFIRMED_PHOTO_TTL_MS` w `cleanup-photos.ts`). Najpierw usuwa obiekt S3,
także gdy go nie ma; błąd S3 zachowuje wiersz do ponowienia. Blokada wiersza
chroni równoległe potwierdzenie uploadu. Potwierdzone zdjęcia pozostają,
również po zakończeniu zlecenia — nie ustalono dla nich automatycznej retencji.

## Protokół przyjęcia (`intake.ts`)

Jeden `IntakeProtocol` na zlecenie (numer `DF-0248` → `P-0248`) i punkty
uszkodzeń `IntakeDamage` 1..n (kolejność tablicy). Punkt ma `title`, `part`,
`size?`, położenie `x`/`y` jako ułamek 0–1 szerokości/wysokości schematu auta
oraz opcjonalne `photoId` — wgrane (potwierdzone) zdjęcie **tego samego zlecenia**, inaczej 400.

- `PUT …/protocol` `{ damages: [{ title, part, size?, x, y, photoId? }] }` — tworzy protokół lub zastępuje punkty.
- `GET …/protocol` — protokół z punktami i podpisanym URL zdjęcia punktu; brak → 404.
- `POST …/protocol/accept` — akceptacja klienta jako flaga `acceptedAt` (idempotentna).
  UI portalu podłączy `acceptProtocol` później; portal nie ma jeszcze własnej ścieżki auth.

Po akceptacji protokół jest niezmienny (PUT → 409), także przy równoległym zapisie
i akceptacji — zapis blokuje wiersz protokołu warunkowym `UPDATE … WHERE acceptedAt IS NULL`.

## Testy

- `photos.test.ts` — Postgres z migracjami, S3 podmienione pamięcią: flow uploadu, numeracja
  przy równoległych żądaniach, 403 dla cudzego klucza, izolacja dwóch studiów, role, Origin, protokół.
- `storage.minio.test.ts` — prawdziwy MinIO, pomijany bez `S3_TEST_ENDPOINT` (instrukcja w pliku):
  podpisany Content-Type/długość, prywatność bucketu, wygasanie URL-i.

UI D-04/M-04 i przycisk aparatu na pulpicie wołają te endpointy. Podgląd bierze tylko
podpisany GET; klucz spoza `studios/<studioId>/` zostaje 403.
