# Panel platformy — A-01, A-04, A-05

`platformDb` jest powierzchnią operatora, nie tenantem. MRR: `calculateMrr` —
wyłącznie `Studio.status = active`. Trial, `past_due`, `suspended` i
`canceled` odpadają.

A-04 (`getPlatformSubscriptions`): skład MRR per plan, wpływy z
`SubscriptionPayment` (Stripe `invoice.paid`, netto PLN), zaległości =
`past_due` × cena planu, churn = anulowane w miesiącu / płacące na początku
miesiąca. Nieudany trial nie jest churnem. Koszty działania to ręczny wpis
`PlatformCost`. Faktury KSeF nie wchodzą do wpływów.

A-05 (`getPlatformAnalytics`): aktywacja wymaga pełnych 7 dni i ≥ 3 zleceń.
Konwersja trialu: płatne / zakończone triale. Retencja kohortowa: brak pełnego
okna to `null` („—”, nie 0%). Wykorzystanie „Faktury PROD” liczy tylko
`ksefEnv = production`.

Testy: `overview.test.ts`, `platform-metrics.test.ts`, `analytics.test.ts`
oraz seed 64×79 + 48×149 + 16×279.
