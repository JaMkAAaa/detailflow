# Naprawa lokalnej migracji `coating_reminders`

## Przyczyna

Na lokalnej bazie `detailflow` migracja tworząca `CoatingReminder` została
wykonana jako `20261026120000_coating_reminders`. Repozytorium zawiera ten sam
SQL pod nazwą `20261026230000_coating_reminders`. Obie wersje mają SHA-256:

```text
70e2f6b023b6b72192d7fe45b3c5e133808e93c7c214f43d843afd5a54b38312
```

Próba wykonania migracji pod obecną nazwą zakończyła się błędem PostgreSQL
`42P07: relation "CoatingReminder" already exists` na pierwszym `CREATE TABLE`.
W `_prisma_migrations` pozostał wpis bez `finished_at` i `rolled_back_at`,
z `applied_steps_count = 0`, blokujący kolejne migracje.

Istniejąca tabela miała wszystkie pięć kolumn, klucz główny, indeks
`CoatingReminder_studioId_completedAt_dueAt_idx` i oba klucze obce, w tym
złożony klucz `(vehicleId, studioId)`. Nieudana próba nie wykonała nowych zmian.
To rozbieżność lokalnej historii migracji; obecny plik SQL jest poprawny.

## Procedura dla tego przypadku

Nie stosuj `resolve --applied` wyłącznie na podstawie istnienia tabeli.
Najpierw potwierdź zgodność całej migracji, w tym kolumn, indeksów, ograniczeń
i sumy kontrolnej. Inny błąd albo niekompletny schemat wymaga osobnej diagnozy.

1. Sprawdź `_prisma_migrations` oraz definicję `CoatingReminder` poleceniami
   tylko do odczytu. Nie odczytuj `.env`; użyj istniejącego połączenia lub
   dostępu lokalnego przez kontener PostgreSQL.
2. Przed zmianą bazy wykonaj `pg_dump --format=custom`, zapisz backup poza
   repozytorium z ograniczonymi uprawnieniami i oblicz jego SHA-256.
   Sprawdź archiwum przez `pg_restore --list` oraz odtworzenie w osobnej bazie.
3. Zapisz liczby rekordów i skróty pełnych wierszy istniejących tabel.
   Zachowaj listy kolumn sprzed migracji, aby nowe kolumny nie zmieniały
   porównania. Nie zapisuj danych klientów w repozytorium.
4. Na odtworzonej kopii wykonaj poniższe polecenia projektową wersją Prisma.
   `DATABASE_URL` musi wskazywać kopię; nie wypisuj danych uwierzytelniających.

   ```sh
   pnpm exec prisma migrate resolve --applied 20261026230000_coating_reminders
   pnpm exec prisma migrate deploy
   pnpm exec prisma migrate status
   pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
   ```

5. Sprawdź zgodność istniejących danych przed i po naprawie oraz wykonaj
   `migrate deploy` na osobnej, pustej bazie z migracjami aktualnego `main`.
6. Po udanej próbie ustaw połączenie do głównej lokalnej bazy i powtórz
   polecenia z punktu 4 oraz porównanie danych. Nie wykonuj resetu ani seeda.

`resolve --applied` zachowuje historię: oznacza nieudaną próbę jako wycofaną
i dodaje wpis potwierdzający zastosowanie obecnej nazwy. Wcześniejszy udany
wpis pozostaje w historii. Nie trzeba usuwać tabeli ani ręcznie kasować
wpisów `_prisma_migrations`.

## Wynik naprawy z 27 października 2026

Weryfikacja dotyczy `main` w commicie `73e022b`:

- Backup został poprawnie odtworzony, a procedura przeszła na kopii.
- Wszystkie 7 migracji przeszło na pustej bazie.
- Na głównej bazie zastosowano brakujące `order_photos_intake`, `order_state`
  i `portal_decisions` po rozwiązaniu wpisu `coating_reminders`.
- `migrate status` potwierdziło aktualny stan, a `migrate diff` brak różnic
  względem schematu Prisma na wszystkich trzech bazach.
- Liczby rekordów i skróty danych wszystkich istniejących tabel były
  identyczne przed i po naprawie.
- Nie pozostały nierozwiązane migracje. Tymczasowe bazy testowe usunięto.

Backup i raport z lokalnymi ścieżkami pozostają poza repozytorium.
