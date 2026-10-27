import Link from "next/link";
import { formatDate } from "@/components/klienci/format";
import { formatPln } from "@/components/pulpit/demo";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/src/server/admin/accounts";
import type { StudioCard as StudioCardData } from "@/src/server/admin/directory";
import type { StudioStatus } from "@/lib/db/generated/client";

const statusVariant: Record<StudioStatus, "completed" | "scheduled" | "overdue" | "error" | "draft"> = {
  active: "completed",
  trial: "scheduled",
  past_due: "overdue",
  suspended: "error",
  canceled: "draft",
};

const when = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-df-muted">{label}</dt>
      <dd className="min-w-0 break-all text-df-text">{value || "—"}</dd>
    </>
  );
}

function Limit({ label, used, max }: { label: string; used: number; max: number | null }) {
  const over = max !== null && used > max;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-df-line py-3 last:border-b-0">
      <dt className="text-df-muted">{label}</dt>
      <dd className={over ? "text-df-amber" : "text-df-text"}>{max === null ? `${used} / bez limitu` : `${used} / ${max}`}</dd>
    </div>
  );
}

export function StudioCard({ card }: { card: StudioCardData }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/studios" className="text-df-label text-df-muted hover:text-df-text">← Studia</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-df-headline">{card.name}</h1>
          <Badge variant={statusVariant[card.status]}>{STATUS_LABEL[card.status]}</Badge>
        </div>
        <p className="mt-1 text-df-body text-df-muted">
          {card.publicCode}
          {card.city ? ` · ${card.city}` : ""}
          {card.district ? `, ${card.district}` : ""}
          {" · "}
          ostatnia aktywność {formatDate(card.lastActivityAt)}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="contact-heading" className="rounded-xl bg-df-panel p-5">
          <h2 id="contact-heading" className="text-df-section">Kontakt</h2>
          <dl className="mt-4 grid grid-cols-[140px_minmax(0,1fr)] gap-y-3 text-df-body">
            <Field label="Właściciel" value={card.ownerName} />
            <Field label="E-mail" value={card.ownerEmail} />
            <Field label="Telefon" value={card.phone} />
            <Field label="Adres" value={card.addressLine} />
            <Field label="NIP" value={card.nip} />
          </dl>
        </section>
        <section aria-labelledby="limits-heading" className="rounded-xl bg-df-panel p-5">
          <h2 id="limits-heading" className="text-df-section">Limity · {card.planName}</h2>
          <dl className="mt-2">
            <Limit label="Użytkownicy" used={card.limits.users.used} max={card.limits.users.max} />
            <Limit label="Boksy" used={card.limits.bays.used} max={card.limits.bays.max} />
          </dl>
        </section>
        <section aria-labelledby="stripe-heading" className="rounded-xl bg-df-panel p-5">
          <h2 id="stripe-heading" className="text-df-section">Stripe</h2>
          <dl className="mt-4 grid grid-cols-[140px_minmax(0,1fr)] gap-y-3 text-df-body">
            <Field label="Abonament netto" value={card.subscriptionNet ? formatPln(card.subscriptionNet) : null} />
            <Field label="Customer" value={card.stripeCustomerId} />
            <Field label="Subscription" value={card.stripeSubscriptionId} />
          </dl>
        </section>
        <section aria-labelledby="events-heading" className="rounded-xl bg-df-panel p-5 lg:col-span-2">
          <h2 id="events-heading" className="text-df-section">Zdarzenia</h2>
          {card.events.length === 0 ? (
            <p className="mt-4 text-df-body text-df-muted">Brak zdarzeń konta.</p>
          ) : (
            <ol className="mt-4 flex flex-col">
              {card.events.map((event) => (
                <li key={`${event.at.toISOString()}-${event.label}`} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-df-line py-3 last:border-b-0">
                  <span className="text-df-body text-df-text">
                    {event.label}
                    {event.detail ? <span className="text-df-muted"> · {event.detail}</span> : null}
                  </span>
                  <time dateTime={event.at.toISOString()} className="text-df-label text-df-muted">{when.format(event.at)}</time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
