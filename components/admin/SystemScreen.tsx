import type { SystemSnapshot } from "@/src/server/admin/system";

const STATUS_TEXT = { ok: "Działa", down: "Niedostępna", unconfigured: "Brak konfiguracji" } as const;
const STATUS_CLASS = { ok: "text-df-green", down: "text-df-error", unconfigured: "text-df-amber" } as const;

function EnvPanel({
  title,
  stats,
}: {
  title: string;
  stats: SystemSnapshot["ksef"]["test"];
}) {
  return (
    <article aria-label={title} className="rounded-xl bg-df-panel p-5">
      <h2 className="text-df-section">{title}</h2>
      <p className="mt-1 text-df-number">{stats.rateLabel ?? "—"}</p>
      <p className="mt-1 text-df-label text-df-muted">
        {stats.accepted} przyjętych / {stats.total} w mianowniku tego środowiska
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-df-body">
        <div>
          <dt className="text-df-label text-df-muted">Przyjęte</dt>
          <dd>{stats.accepted}</dd>
        </div>
        <div>
          <dt className="text-df-label text-df-muted">Błędy</dt>
          <dd>{stats.rejected}</dd>
        </div>
        <div>
          <dt className="text-df-label text-df-muted">Oczekujące</dt>
          <dd>{stats.pending}</dd>
        </div>
      </dl>
      <p className="mt-4 text-df-label text-df-muted">
        {stats.ageMinutes === null ? "Kolejka pusta." : `Najstarszy dokument w kolejce: ${stats.ageMinutes} min.`}
      </p>
    </article>
  );
}

function ErrorList({ title, rows }: { title: string; rows: { message: string; count: number }[] }) {
  return (
    <article className="rounded-xl bg-df-panel p-5">
      <h2 className="text-df-section">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-df-body text-df-muted">Brak odrzuceń w tym środowisku.</p>
      ) : (
        <ul className="mt-3 divide-y divide-df-line">
          {rows.map((row) => (
            <li key={row.message} className="flex items-baseline justify-between gap-3 py-3">
              <span className="text-df-body">{row.message}</span>
              <span className="text-df-label text-df-muted">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function SystemScreen({ data }: { data: SystemSnapshot }) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-df-headline">System i KSeF</h1>
        <p className="mt-1 text-df-body text-df-muted">
          Udział przyjętych liczy tylko jedno środowisko. Szkice niewysłane nie wchodzą do mianownika.
        </p>
      </header>
      <section aria-label="Kondycja usług" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data.services.map((service) => (
          <article key={service.key} className="rounded-xl bg-df-panel p-4">
            <h2 className="text-df-label text-df-muted">{service.label}</h2>
            <p className={`mt-1 text-df-section ${STATUS_CLASS[service.status]}`}>{STATUS_TEXT[service.status]}</p>
            <p className="mt-1 text-df-label text-df-muted">{service.hint}</p>
          </article>
        ))}
      </section>
      <section aria-label="KSeF TEST i PROD" className="grid gap-6 lg:grid-cols-2">
        <EnvPanel title="KSeF TEST" stats={data.ksef.test} />
        <EnvPanel title="KSeF PROD" stats={data.ksef.production} />
      </section>
      <article className="rounded-xl bg-df-panel p-5">
        <h2 className="text-df-section">Incydent</h2>
        {data.incidents.length === 0 ? (
          <p className="mt-3 text-df-body text-df-muted">Brak otwartego incydentu. Kolejka nie stoi dłużej niż 15 min.</p>
        ) : (
          <ul className="mt-3 divide-y divide-df-line">
            {data.incidents.map((incident) => (
              <li key={incident.env} className="py-3">
                <p className="font-medium text-df-amber">{incident.title}</p>
                <p className="mt-1 text-df-body text-df-muted">{incident.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </article>
      <section aria-label="Kategorie błędów" className="grid gap-6 lg:grid-cols-2">
        <ErrorList title="Błędy TEST" rows={data.errors.test} />
        <ErrorList title="Błędy PROD" rows={data.errors.production} />
      </section>
    </div>
  );
}
