# KSeF offline — decyzja przed implementacją (#146)

Stan i data dostępu do źródeł: **29.10.2026**. Przegląd kodu: `origin/main` / `6c75da0f92a03007eff605648a5a3ce5f1c51b7b`.
[Komentarz MF w #146](https://github.com/JaMkAAaa/detailflow/issues/146#issuecomment-6497749954).
Zakres tego wydania: badanie, komentarz w issue i dokumentacja. Klient, przycisk i dialog offline pozostają niewdrożone.

## Decyzja

**Studio może prawnie wystawiać w offline24**, również z wyboru, bez dowodzenia braku Internetu. MF nie ogranicza tej możliwości do konkretnej branży ani wielkości przedsiębiorstwa [MF1, MF2]. Wymagane są elektroniczna faktura FA(3), właściwe uprawnienia, uprzednio pobrany certyfikat offline oraz terminowe dosłanie do KSeF. To możliwość prawna, a nie deklaracja, że Detailflow już ją obsługuje.

**Numer faktury studia (`P_2`) istnieje przed numerem KSeF. Numer KSeF nadaje wyłącznie system po przesłaniu i przyjęciu dokumentu**; nie wolno go generować lokalnie ani zastępować numerem zlecenia, hashem, referencją sesji czy numerem TEST. Do tego czasu `ksefNumber` pozostaje pusty. Korekta faktury offline wymaga uprzedniego nadania numeru KSeF fakturze pierwotnej [P1: art. 106nda ust. 2, 10–12; MF1, MF7].

Zależności #110, #111, #112 sprawdzono w GitHub: wszystkie CLOSED, a lista zależności blokujących #146 jest pusta. Bariera „najpierw zasady MF” jest rozstrzygnięta niniejszą analizą i komentarzem. Po publikacji komentarza zdjęto `blocked` (29.10.2026); issue pozostaje otwarte do merge PR dokumentacyjnego. Brak danych lub certyfikatu konkretnego studia blokuje aktywację jego przyszłej integracji, nie dokumentację ani ogólną dopuszczalność prawną. #115 zostaje otwarty; #147 nie jest zakresem pracy.

## Obowiązujące reguły i rozdział trybów

Podstawa: ustawa o VAT, tekst jednolity Dz.U. 2026 poz. 1263, tekst ujednolicony z 16.10.2026 [P1]; nowela wprowadzająca offline24: Dz.U. 2025 poz. 1203 [P2]. Poniższe reguły są obowiązujące na datę przeglądu, nie projektem v2.

| Procedura | Warunek | Dokument i termin przesłania |
| --- | --- | --- |
| offline24 | wybór podatnika, także problemy z łącznością | elektroniczna FA(3); **niezwłocznie, najpóźniej następnego dnia roboczego po wystawieniu**, art. 106nda ust. 1–2 [MF1] |
| offline — niedostępność | okres niedostępności MF z art. 106ne ust. 4 (np. prace serwisowe) | elektroniczna FA(3); **najpóźniej następnego dnia roboczego po zakończeniu niedostępności**, art. 106nh ust. 1–2 [MF3] |
| awaryjna | awaria ogłoszona w BIP MF i interfejsie, art. 106ne ust. 1 | elektroniczna FA(3); **7 dni roboczych od zakończenia awarii**, art. 106nf ust. 1–4 [MF4] |
| awaria całkowita | komunikat w środkach społecznego przekazu, art. 106ne ust. 3 | papier lub dokument elektroniczny poza KSeF, bez obowiązkowego FA(3), bez dosyłania i bez QR KSeF; art. 106ng [MF5] |

Timeout aplikacji ani błąd Redis nie dowodzi ogłoszonej awarii MF. Dla faktury offline24 wystawionej przed ogłoszeniem awarii stosuje się art. 106nha: awaria zwykła odsyła do art. 106nf ust. 4, 5, 7–11 i 13, a całkowita znosi dosłanie. Przy niedostępności przejście reguluje art. 106nh ust. 3. Kolejna awaria w terminie dosyłania uruchamia termin od końca tej kolejnej awarii (art. 106nf ust. 5); awaria całkowita w okresie awarii lub terminie z ust. 4–5 znosi dosłanie (ust. 7). Nie należy mechanicznie przedłużać terminów bez zapisania właściwego komunikatu i podstawy.

Datą wystawienia offline jest `P_1`, a nie dzień otrzymania numeru/UPO. Nazwa offline24 **nie oznacza 24 godzin**. Terminy liczy się w dniach roboczych, nie jako odcinki po 24 godziny. Plan implementacyjny: osobna data podatkowa i znaczniki czasu UTC; datę lokalną wyznaczać w `Europe/Warsaw` (CET/CEST), zgodnie z istniejącym `plDate`, bez obcinania ISO UTC. Kalendarz musi uwzględniać polskie dni wolne, weekendy, zmianę czasu i północ; przed kodem należy potwierdzić szczegóły interpretacji czasu w przypiętej wersji kontraktu MF. Przejrzane strony prawne nie specyfikują formatu offsetów API — jest to jawna kwestia kontraktowa, nie przeszkoda prawna.

Istotne także dla obecnego kodu: art. 106nda ust. 16 obejmuje dokument deklarowany online, przesłany później niż `P_1`. `offlineMode: false` nie chroni przed kwalifikacją offline przez MF. Oficjalna dokumentacja techniczna opisuje porównanie dni `issueDate` i `invoicingDate` [T1]. Ten PR nie naprawia ani nie rozszerza aktualnego klienta.

## Nabywca, QR i identyfikacja przed numerem KSeF

- **offline24 i niedostępność, krajowy podatnik z NIP:** fakturę otrzymuje przez KSeF; datą otrzymania jest przydzielenie numeru KSeF. Przed nim można wydać dobrowolne **potwierdzenie transakcji**, które nie jest fakturą [P1: art. 106nda ust. 3, 11 i art. 106nh ust. 4; MF7].
- **Nabywca z art. 106gb ust. 4:** uzgodniony sposób przekazania (m.in. konsument, zagraniczny nabywca, podmiot bez NIP; również wskazane w przepisie transakcje zagraniczne i procedura SME). Przed dosłaniem, przy przekazaniu poza KSeF, faktura ma dwa QR/linki z podpisami **OFFLINE** i **CERTYFIKAT**. Datą otrzymania jest faktyczny odbiór poza KSeF. Po dosłaniu i nadaniu numeru — jeden kod z numerem KSeF. Gdy konsument/nabywca bez identyfikatora otrzymuje w KSeF, trzeba zapewnić dostęp kodem i danymi identyfikującymi [art. 106nda ust. 4–11, art. 106gb ust. 6; MF1, MF6].
- **Ogłoszona awaria:** uzgodniony kanał dla każdego nabywcy, w tym krajowego B2B. Przekazanie poza KSeF przed dosłaniem wymaga dwóch kodów. Data otrzymania zasadniczo jest wcześniejszą z dat faktycznego odbioru i nadania numeru; dla art. 106gb ust. 4 z uzgodnionym odbiorem poza KSeF zawsze faktyczny odbiór (art. 106nf ust. 2–3, 10) [MF4].
- **Awaria całkowita:** osobny przypadek, bez kodów i bez oczekiwania na numer [MF5].

KOD I wiąże datę `P_1`, NIP sprzedawcy i wyróżnik z SHA-256 **dokładnego XML**. KOD II wiąże kontekst/uprawnionego wystawcę, NIP sprzedawcy, identyfikator certyfikatu oraz hash; jest podpisany kluczem prywatnym certyfikatu offline. Numer `P_2`, dane nabywcy i kwota służą także dostępowi do faktury. Nie regenerować innego XML po wydaniu kodu. Szczegóły: § 2 pkt 6, § 7 i § 9 rozporządzenia [P3] oraz [T2].

Potwierdzenie transakcji ma nazwę, dane stron, `P_2`, `P_15` i dwa kody/linki. Według MF nad nimi są napisy „sprawdź fakturę w KSeF” oraz „zweryfikuj wystawcę faktury”; **pod nimi nie ma napisów OFFLINE/CERTYFIKAT**. Nie mylić tego dobrowolnego dokumentu z wizualizacją faktury offline [MF7].

## Uprawnienia, certyfikat, podmioty i środowiska

Wymagane jest prawo wystawiania faktur w kontekście NIP studia, a nie tylko rola owner w Detailflow. Wynika to z § 3–6 rozporządzenia [P3]. Uprzednio trzeba pobrać **certyfikat KSeF typu 2 (offline)** i bezpiecznie posiadać odpowiadający klucz prywatny. Typ 1 służy uwierzytelnieniu; token API ani certyfikat typu 1 nie zastąpi typu 2 dla KODU II. Certyfikat nie zastępuje uprawnień. Wydanie wymaga uwierzytelnienia podatnika/osoby uprawnionej; ważność maksymalnie 2 lata (§ 6 ust. 2). Od lutego 2026 pobieranie jest dostępne w API i Aplikacji Podatnika KSeF 2.0 [MF8, T2].

Branża detailingowa nie jest wykluczona. **Możliwość offline nie oznacza obowiązku KSeF dla każdej faktury**: art. 106ga ust. 2–4 określa wyjątki i dobrowolność (m.in. B2C, podmioty zagraniczne, procedury szczególne); art. 145m do końca 2026 dopuszcza wystawianie poza KSeF przy limicie 10 000 zł brutto miesięcznie, z utratą prawa od faktury przekraczającej limit. Art. 145n przewiduje przejściowe zasady dla faktur z kas i paragonów uznanych za faktury. Nie jest to offline24 z późniejszym obowiązkowym dosłaniem. Samo zwolnienie z VAT nie wyłącza obowiązku KSeF. Nie ustalono sytuacji konkretnego studia; nie wymyślamy NIP, obrotów, certyfikatu ani uprawnień [P1, MF9].

FA(3) obowiązuje od 1.02.2026 w opisanych trzech procedurach dosyłania [MF1–MF4]. TEST nie powoduje skutków prawnych i wymaga zanonimizowanych danych; nie zastępuje wystawienia faktury rzeczywistej [MF10]. Planowane testy użyją tylko TEST, oddzielnych sekretów i adresów QR (`qr-test`); nigdy MF PROD. W repo PROD pozostaje za flagą `ksef_prod`, z osobnym środowiskiem faktury i szyfrowaniem tokenu. Samo włączenie flagi nie daje certyfikatu ani prawa do działania za studio.

## Przyszłe zmiany i granice pewności

- Sankcje administracyjne z art. 106ni ust. 1–3 i 5–7 są przewidziane od **1.01.2027**; brak ich stosowania w 2026 nie znosi terminów dosyłania [P1, MF9].
- Przejściowy limit art. 145m i zasady kas art. 145n kończą się 31.12.2026 według sprawdzonego tekstu. Nie oznacza to zniesienia trwałych wyjątków art. 106ga.
- Tekst ujednolicony [P1] oznacza także przyszłe brzmienia. Ogłoszona nowela Dz.U. 2026 poz. 1270 [P5] ma daty wejścia od grudnia 2026 i w latach 2027–2028 — nie stosujemy ich przedwcześnie. Sprawdzono też metadane nowelizacji VAT oraz zmianę Dz.U. 2026 poz. 846 uwzględnioną w tekście ujednoliconym [P6].
- MF informuje w FAQ o zamiarze bezterminowego pozostawienia tokenów i zapowiada zmianę rozporządzenia [MF11]. To komunikat o przyszłej legislacji; nie zakładamy, że sam FAQ zmienił przepis. Przyszła implementacja musi ponownie sprawdzić uwierzytelnianie na datę wdrożenia.
- Nie potwierdzono certyfikatu/uprawnień rzeczywistego studia ani wyniku wysyłki do MF. To nie jest indywidualna interpretacja podatkowa ani dowód produkcyjnej gotowości. Kontrakt API, format QR, kalendarz i stan prawny wymagają ponownego przypięcia przed osobnym PR z kodem.

## Stan repo i plan przyszłej implementacji

**Istnieje:** `src/ksef/fa3.ts` i lokalny XSD/walidator; `src/ksef/submissions.ts` zapisujący XML + hash w transakcji przed enqueue; `src/worker/ksef.ts` odzyskujący niejednoznaczną wysyłkę bez ślepego ponawiania POST; numer/UPO dopiero z MF. Model `Invoice` rozdziela `number`, `ksefNumber`, `ksefEnv`; dokument wymaga `WorkOrder.completed`. Kwoty pozostają `Decimal`, zapytania dokumentów przez `studioDb(studioId)`.

**Nie istnieje:** wybór procedury offline, rejestr komunikatów MF i terminów, cykl życia certyfikatu typu 2, podpis KODU II, właściwe wizualizacje QR/potwierdzenia transakcji. `src/ksef/client.ts` wysyła `offlineMode: false`. Obecny outbox/retry nie jest prawnym trybem offline. Starszy opis #43 w `src/ksef/README.md` jest historyczny — generator już istnieje w kodzie; nie jest zależnością blokującą #146.

**Osobny PR z kodem dopiero po komentarzu i zdjęciu blocked, z osobnym zakresem implementacyjnym.** Plan (przyszły, żaden punkt poniżej nie jest wykonany przez #146):

1. Ustalić obsługiwane scenariusze studia/nabywców i przypiąć wersję API/XSD/QR MF. Wprowadzić procedurę, datę wystawienia, termin i dowód komunikatu MF; migracje wyłącznie addytywne, bez resetu danych.
2. Zaprojektować bezpieczne pozyskanie/przechowywanie klucza i certyfikatu typu 2 per tenant i środowisko, ważność, odwołanie i rotację; brak sekretu wyłącza aktywację. Sekrety tylko bezpiecznym formularzem, nie w issue, logach ani Redis.
3. W chwili wystawienia utrwalić dokładny XML FA(3), snapshot danych i hash, przed wydaniem QR. Dodać podpisane QR oraz osobno potwierdzenie transakcji, egzekwować dozwolony kanał odbioru; żadnego pozornego numeru KSeF ani automatycznego przejścia online → awaria.
4. Rozszerzyć outbox/worker o świadomą wysyłkę offline, terminy, alarm przed terminem i po nim, restart i rekonsyliację. Wyczerpanie 10 prób obecnej kolejki nie może porzucić obowiązku dosłania. Zachować idempotencję, numer po akceptacji i niezależne ponawianie UPO; rozpatrzyć korektę techniczną odrzuconego XML zgodnie z kontraktem MF.
5. Dopiero potem podłączyć UI/dialog, autoryzację i komunikaty: procedura, termin, kanał przekazania, brak numeru do przyjęcia. Nie zmieniać przy okazji Stripe Billing ani reguły FV po `completed`.
6. Testy kontraktowe i dwóch tenantów: uprawnienia/certyfikat nieważny lub odwołany, TEST≠PROD również QR, `P_1`/UTC/północ/DST/święta/weekendy, kolejne awarie i awaria całkowita, snapshot/hash/podpis, krajowy B2B vs B2C, retry/restart/utrata odpowiedzi/odrzucenie/UPO/korekta. Zapisy i migracje tylko na osobnej izolowanej bazie. Integracja MF tylko TEST, bez rzeczywistych maili/płatności.

Rzeczywiste dane i certyfikat studia oraz dowód kontraktu MF TEST są warunkami późniejszej aktywacji/testu integracyjnego. Nie są wymagane do ukończenia dokumentacyjnego #146. W tym PR nie ma zmian w zapytaniach, bazie, runtime ani UI; nie uruchamiamy serwera, workera, tunelu ani MF PROD.

## Źródła oficjalne

Wszystkie poniższe URL sprawdzono **29.10.2026**. Ustawy/rozporządzenie są podstawą normatywną; strony MF wyjaśniają ich stosowanie; dokumentacja CIRFMF opisuje kontrakt techniczny (jej historyczne określenie „projekt” nie zastępuje obowiązującej ustawy).

- **P1** — ustawa o VAT, Dz.U. 2026 poz. 1263, tekst ujednolicony 16.10.2026: https://eli.gov.pl/eli/DU/2026/1263/ogl/pol ; https://eli.gov.pl/api/acts/DU/2026/1263/text/U/D20261263Lj.pdf — art. 106e ust. 1 pkt 1–2, 106ga–106gb, 106nda, 106ne–106ni, 145l–145n.
- **P2** — nowela z 5.08.2025, Dz.U. 2025 poz. 1203: https://eli.gov.pl/eli/DU/2025/1203/ogl/pol ; https://eli.gov.pl/api/acts/DU/2025/1203/text/T/D20251203L.pdf — art. 2 pkt 1 lit. g (dodanie art. 106nda), zmiany procedur i terminów wejścia.
- **P3** — rozporządzenie z 12.12.2025, Dz.U. 2025 poz. 1815: https://eli.gov.pl/eli/DU/2025/1815/ogl/pol ; https://eli.gov.pl/api/acts/DU/2025/1815/text/O/D20251815.pdf — § 3–6 (uprawnienia/certyfikat), § 7 (dostęp), § 9 (QR).
- **P4** — zmiana rozporządzenia, Dz.U. 2026 poz. 169: https://eli.gov.pl/api/acts/DU/2026/169/text/O/D20260169.pdf — zmienia daty § 13 i § 15; nie zmienia opisanych reguł QR.
- **P5** — ogłoszona nowela VAT z przyszłymi datami wejścia: https://eli.gov.pl/eli/DU/2026/1270/ogl/pol .
- **P6** — nowelizacje ustawy i rozporządzenia sprawdzone w oficjalnych metadanych: https://api.sejm.gov.pl/eli/acts/DU/2004/535 ; https://api.sejm.gov.pl/eli/acts/DU/2025/1815 ; https://api.sejm.gov.pl/eli/acts/DU/2026/846/text.pdf .
- **MF1** — offline24: https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/tryb-offline24/ .
- **MF2** — rozdział procedur: https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/tryby-szczegolne-wystawiania-faktur/ .
- **MF3** — niedostępność: https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/tryb-offline-niedostepnosc-ksef/ .
- **MF4** — awaria: https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/tryb-awaryjny/ .
- **MF5** — awaria całkowita: https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/awaria-calkowita/ .
- **MF6** — QR: https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/kody-weryfikujace-qr/ .
- **MF7** — potwierdzenie transakcji: https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/potwierdzenie-transakcji/ .
- **MF8** — certyfikaty: https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/certyfikaty-ksef/ .
- **MF9** — terminy i obowiązek: https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/podstawy-prawne-oraz-kluczowe-terminy/ ; https://www.gov.pl/web/kas/co-warto-wiedziec-przed-startem-ii-etapu-wdrozenia-krajowego-systemu-e-faktur ; https://podatki.gov.pl/aktualnosci/co-warto-wiedziec-przed-startem-ii-etapu-wdrozenia-krajowego-systemu-e-faktur .
- **MF10** — TEST bez skutków prawnych: https://ksef.podatki.gov.pl/wyjasnienia/rozpoczelismy-testy-otwarte-aplikacji-podatnika-ksef-20/ .
- **MF11** — FAQ (w tym zapowiedź zmiany tokenów): https://ksef.podatki.gov.pl/pytania-i-odpowiedzi-ksef-20/?query=token .
- **T1** — MF/CIRFMF, techniczne rozpoznanie offline: https://github.com/CIRFMF/ksef-api/blob/main/offline/automatyczne-okreslanie-trybu-offline.md ; https://github.com/CIRFMF/ksef-api/blob/main/tryby-offline.md .
- **T2** — MF/CIRFMF, hash/podpis i hosty QR: https://github.com/CIRFMF/ksef-api/blob/main/kody-qr.md .
