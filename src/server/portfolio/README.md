# Portfolio realizacji (#145)

Studio samo oznacza zdjęcie jako publiczne. Nowy wiersz i seed nie publikują nic.

## Co jest publiczne

`GET /realizacje/:slug` (gość, bez sesji). Brak opublikowanych zdjęć to **200 i pusty stan**, nie 404.
Nieznany slug to 404. Odpowiedź HTML ma `Cache-Control: private, no-store`.

W HTML są tylko: nazwa studia, miasto, marka, model, nazwa usługi i ścieżka
`/realizacje/:slug/media/:photoId?v=`. Nie ma danych klienta, numeru zlecenia,
tablicy z bazy, opisu zdjęcia, kwoty, NIP-u, telefonu ani adresu studia.

`?v=` jest tylko odświeżeniem adresu. Autoryzacja nie czyta query, w tym `studioId`.

## Pochodna, nie oryginał

Oryginał zostaje pod `studios/<studioId>/orders/…` w prywatnym buckecie.
Publikacja czyta go na serwerze, buduje JPEG i zapisuje
`studios/<studioId>/portfolio/<photoId>/v<n>-<nonce>.jpg`.

- Domyślnie (`plateVisible: false`) trzeba podać prostokąt tablicy (min. 5% szerokości i 4% wysokości kadru).
  Obszar jest zmniejszany do 2×2 pikseli i rozciągany z powrotem. To niszczy znaki; nie da się ich odtworzyć z pochodnej.
  Schowanie pola „tablica” w JSON nie jest maską.
- `plateVisible: true` to osobna, świadoma decyzja. Kadr zostaje, ale plik jest nowym JPEG bez EXIF.
- Route mediów strumieniuje tylko `publicKey`. Nie woła `presignGet` i nie zwraca `Location` do S3.
- `Cache-Control: public, max-age=0, must-revalidate` plus `ETag`. Cache musi spytać serwer, zanim pokaże bajty.
  Po odpublikowaniu ten sam URL, także z poprzednim `If-None-Match`, dostaje 404 `no-store`.
- Odpublikowanie (`DELETE`, także przy wstrzymanym abonamencie) czyści flagę i kasuje pochodną.
  Klucz spoza `studios/<studioId>/portfolio/` nie jest usuwany, więc oryginał zostaje.
- Równoległa publikacja aktualizuje wiersz tylko przy zgodnym `publicVersion`. Przegrany kasuje własną pochodną.

Zapis: owner/manager, `portfolio:manage`, Origin, kontrola abonamentu. Odczyt listy w studiu: cały zespół.
Podgląd na `/portfolio` używa krótkiego podpisu oryginału i nie jest tą samą odpowiedzią co galeria.

Zapytania operacyjne idą przez `studioDb(studioId)`. Slug studia jest jawnym identyfikatorem publicznym
(`platformDb` tylko po to, żeby zamienić slug na `studioId`).
