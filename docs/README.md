# Detailflow — dokumentacja

Stan kodu opisuje **[`../README.md`](../README.md)** — to jedyny dokument, który mówi, co faktycznie działa, co ma ograniczenia i czego nie zweryfikowano. Przy sprzeczności: kod i migracje > README > specyfikacja produktu > makieta.

- **[Dokumentacja wdrożenia](./dokumentacja-wdrozenia.md)** — **specyfikacja docelowego produktu** (nie opis stanu kodu): problem, ekrany, architektura, Prisma, Stripe, KSeF, Docker, fazy prac.
- **[Naprawa migracji coating_reminders](./naprawa-migracji-coating-reminders.md)** — diagnoza lokalnej historii, backup, procedura odzyskania i wynik weryfikacji.
- **Źródło UI:** [Figma Detailflow](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S)
- **Mapa ekranów makiety:** [`../file-structure.md`](../file-structure.md)
- **Panel platformy (projekt UX i definicje metryk):** [`../audit/admin/README.md`](../audit/admin/README.md); implementacja: [README §3.3](../README.md#33-panel-platformy-a-01a-10) i [§9.15](../README.md#915-panel-platformy-admin).
- **Testy E2E:** [`../e2e/README.md`](../e2e/README.md); CI: [README §13.3](../README.md#133-ci).
- **Backup i odtwarzanie:** [README §14.5](../README.md#145-backup-i-odtwarzanie).
- **Pracujący szkic prawny:** strony `/regulamin`, `/polityka-prywatnosci`, `/umowa-powierzenia` w aplikacji są projektami do zatwierdzenia prawnego — nie są obowiązującymi dokumentami.
- **Backlog:** [Issues](https://github.com/JaMkAAaa/detailflow/issues) — epiki `type:epic`, ekrany `type:ui`, backend `type:implement`. Agenty: [`../AGENTS.md`](../AGENTS.md).
