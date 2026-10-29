# #147 — abonament roczny Detailflow

Stan implementacji gałęzi PR #186, 29.10.2026. Moduł wymaga zielonego CI,
niezależnej kontroli OpenBot i kolejnego polecenia przed merge.

## Źródło decyzji i ceny

[Decyzja zapisana w #147](https://github.com/JaMkAAaa/detailflow/issues/147#issuecomment-6498220654).
Użytkownik na pytanie o ceny, pobranie z góry i coroczne odnowienie odpowiedział
**„dobierz sam”**, delegując wybór. **OpenBot**, korzystając z tej delegacji,
ustalił konkretne kwoty (użytkownik sam nie podał tych liczb):

| Plan | Netto PLN/miesiąc | Netto PLN/rok | Roczny lookup_key |
| --- | --- | --- | --- |
| Solo | 79.00 | 790.00 | `plan_solo_yearly` |
| Studio | 149.00 | 1490.00 | `plan_studio_yearly` |
| Pro | 279.00 | 2790.00 | `plan_pro_yearly` |

Pełna roczna opłata z góry, automatyczne coroczne odnowienie. Ceny netto,
Stripe dolicza właściwy podatek. Katalog `lib/billing/catalog.ts` przechowuje
kwoty PLN jako stringi i przelicza je przez Decimal do całkowitych groszy.
Miesięczne lookup_key `plan_*_monthly` pozostają bez zmian.

Poprzednie przygotowanie nie znalazło cen: issue nie miało komentarzy, a README,
specyfikacja, katalogi i komentarze repo wskazywały wyłącznie miesięczne ceny.
Nowa jawna delegacja i decyzja OpenBot usunęły tę zależność. Etykietę `blocked`
zdjęto. #110–114 są CLOSED, lista `blocked_by` #147 pusta. Baza prac:
`49e14d6449281a41fce0502202f0b12af93f0742`. Nie wznawiamy zamkniętych issue,
nie implementujemy #148 ani ustaleń osobnego audytu. #115 zostaje otwarty.

## Kontrakt implementacji

- `pnpm billing:setup` idempotentnie tworzy/weryfikuje sześć cen PLN exclusive,
  licensed ×1, recurring month/year ×1. Roczna cena używa produktu planu
  zweryfikowanego przy cenie miesięcznej. Błędna istniejąca cena przerywa skrypt;
  nie jest cicho zastępowana. Checkout nie tworzy cen.
- `POST /api/studios/:studioId/billing/checkout`: `{ plan, interval }`, gdzie
  interval to `monthly` lub `yearly`; brak pola zachowuje miesięczne API.
  Otwarte sesje są rozróżniane po planie i okresie. Zmiana jednego z nich wygasza
  poprzednią sesję; brak pola w starej sesji oznacza miesiąc. Nadal owner-only,
  membership przez `studioDb(studioId)`, Origin, trial 14 dni bez karty,
  lock transakcyjny per studio i zakaz równoległych abonamentów.
- Webhook weryfikuje pełną cenę/okres z katalogu. Bieżący odczyt subskrypcji
  pod lockiem wygrywa ze starym snapshotem i metadanymi okresu (portal może
  zmienić cenę bez zmiany metadata). Idempotencja `StripeEvent`, stan, audyt
  i wpływ są jedną transakcją. Niezgodny customer/tenant/cena = rollback.
- Addytywna migracja dodaje `Studio.billingInterval` (domyślnie monthly) i
  `subscriptionNet Decimal(12,2)` za pełny okres. Dotychczasowe subskrypcje
  dostają miesięczną cenę; seed/trial bez ceny używa katalogu danego okresu.
  Webhook zapisuje aktualny okres i zatwierdzoną cenę z walidowanego Price.
- MRR aktywnych rocznych = `subscriptionNet / 12`, sumowanie Decimal bez
  zaokrąglania pojedynczych kont; pozostałe statusy poza MRR. A-01/A-04 korzystają
  z okresu/ceny, A-02/A-03/CSV pokazują cenę pełnego okresu i jego nazwę.
  Historyczny wykres pozostaje istniejącą estymacją z aktualnego snapshotu
  konta (repo nie ma historii zmian cen/okresów); nie jest księgą historyczną MRR.
- Wpływy nadal pochodzą z rzeczywistej faktury `invoice.paid`, a nie katalogu.
  Faktura proration z zerowym `amount_paid` (kredyt/zerowe rozliczenie) kończy
  synchronizację bez fikcyjnego wpływu. Kwota kont past_due w A-04 to cena
  okresu, nie dokładne saldo Stripe po proration/kredytach — UI to wyjaśnia.

## Zmiana miesiąc ↔ rok: od razu z proration

Użytkownik wybrał dosłownie **„Od razu z proration”**. Właściciel używa przycisku
„Zarządzaj abonamentem w Stripe”. Aplikacja tworzy jawną konfigurację Customer
Portal i przekazuje jej ID do sesji; nie polega na domyślnej konfiguracji konta:

- tylko sześć zweryfikowanych cen katalogu, `default_allowed_updates=[price]`,
  bez dowolnej ilości i kodów promocyjnych;
- `proration_behavior=always_invoice`, `billing_cycle_anchor=now`,
  `schedule_at_period_end.conditions=[]` — bez odkładania skrócenia okresu
  i obniżenia planu na koniec bieżącego okresu;
- zmiana jest stosowana od razu, Stripe wylicza wykorzystaną część, kredyt,
  ewentualną należność i nowy okres. Ostateczna kwota i data odnowienia są
  widoczne w Stripe przed potwierdzeniem. Aplikacja nie obiecuje zachowania
  poprzedniej daty odnowienia ani automatycznego zwrotu kredytu na kartę;
- anulowanie pozostaje na koniec okresu; odnowienie po zmianie ceny/okresu
  i dostęp są synchronizowane webhookiem, nie powrotem z portalu;
- konfiguracja ma idempotency key będący hashem polityki i identyfikatorów cen.
  Stripe deduplikuje ponowienia w swoim oknie idempotencji; po jego wygaśnięciu
  może powstać kolejna równoważna konfiguracja. Nie edytuj tych konfiguracji
  ręcznie w Dashboard — są tworzone przez kod dla konkretnej polityki.

Stripe może ograniczać zmianę subskrypcji z pending update, harmonogramem lub
nieopłaconą fakturą. UI nie gwarantuje zmiany mimo tych ograniczeń: portal
prowadzi przez obsługiwany stan, a webhook odczytuje faktyczny abonament.

## Weryfikacja i bezpieczna aktywacja

Testy transportu Stripe używają atrap; integracje DB wyłącznie osobnej bazy
`df147_test` / `df147_acceptance` w dedykowanym kontenerze `detailflow-147-isolated-db` na 55447.
Brak seeda/resetu istniejącej bazy, realnych zakupów, maili/SMS/MF PROD,
restartów dev3002 i dedykowanego tunelu Redis. Audyt na 3104 pozostaje osobny.

Do hostowanego testu sandbox potrzebne są klucz sandbox i sekret webhooku przez
bezpieczny formularz, nigdy issue/log. Bez takich danych nie deklarujemy zakupu
w prawdziwym hostowanym Checkout ani wdrożenia na konto Stripe.

## Oficjalny kontrakt Stripe sprawdzony 29.10.2026

- [Create Price](https://docs.stripe.com/api/prices/create)
- [Create Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
- [Subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Change price](https://docs.stripe.com/billing/subscriptions/change-price)
- [Prorations](https://docs.stripe.com/billing/subscriptions/prorations)
- [Portal configuration API](https://docs.stripe.com/api/customer_portal/configurations/create)
- [Portal subscription management](https://docs.stripe.com/customer-management/configure-portal)

Stripe Billing rozlicza abonament Detailflow. Nie zapisuje faktur klienta studia
w `Invoice` ani KSeF i nie zmienia zasady faktury po zakończeniu zlecenia.
