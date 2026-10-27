import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatPln } from "@/components/pulpit/demo";
import type { ClientProfile, ClientVehicle, ClientVisit } from "@/src/server/klienci/directory";
import { SoonButton } from "./SoonButton";
import { formatDate, formatShortDate, formatSince, visitsLabel } from "./format";

const panel = "rounded-xl bg-df-panel p-5";

const activeBadge = {
  accepted: { variant: "accepted", label: "Zlecenie przyjęte" },
  in_progress: { variant: "in-progress", label: "Zlecenie w trakcie" },
  ready_for_pickup: { variant: "ready-for-pickup", label: "Do odbioru" },
} as const;

const visitStatus: Partial<Record<ClientVisit["status"], string>> = {
  accepted: "przyjęte",
  in_progress: "w trakcie",
  ready_for_pickup: "do odbioru",
};

const join = (parts: (string | number | null | false | undefined)[]) => parts.filter(Boolean).join(" · ");

function VehicleItem({ vehicle }: { vehicle: ClientVehicle }) {
  if (vehicle.active) {
    const badge = activeBadge[vehicle.active.status];
    return (
      <li className="flex gap-3">
        {/* Pojazd nie ma jeszcze zdjęcia w modelu danych — zamiast cudzej fotografii jest slot z ramką. */}
        <div aria-hidden="true" className="flex h-[72px] w-[108px] shrink-0 items-center justify-center rounded-[10px] bg-df-raised text-[28px] text-df-muted">▱</div>
        <div className="flex min-w-0 flex-col items-start gap-1">
          <p className="max-w-full truncate text-df-strong">{vehicle.make} {vehicle.model}</p>
          <p className="max-w-full truncate text-df-label text-df-muted">{join([vehicle.plate, vehicle.year, vehicle.color])}</p>
          <Link href={`/orders/${vehicle.active.number}`} aria-label={`${badge.label}: #${vehicle.active.number}`}>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </Link>
        </div>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-3">
      <div aria-hidden="true" className="flex h-12 w-14 shrink-0 items-center justify-center rounded-lg bg-df-raised text-[28px] text-df-muted">▱</div>
      <div className="min-w-0">
        <p className="truncate text-df-strong">{vehicle.make} {vehicle.model} · {vehicle.plate}</p>
        <p className="mt-1 truncate text-df-label text-df-muted">
          {join([vehicle.year, vehicle.color, vehicle.lastVisit && `ostatnia wizyta ${formatShortDate(vehicle.lastVisit)}`])}
        </p>
      </div>
    </li>
  );
}

function Vehicles({ profile }: { profile: ClientProfile }) {
  return (
    <section aria-labelledby="profile-vehicles" className={panel}>
      <div className="flex h-7 items-center gap-2">
        <h2 id="profile-vehicles" className="min-w-0 flex-1 text-df-section">Samochody</h2>
        <SoonButton
          variant="secondary"
          className="h-7 bg-transparent px-0 text-df-label text-df-muted hover:bg-transparent hover:text-df-text"
          title="Dodaj samochód — wkrótce"
          description="Dodawanie samochodów do klienta będzie dostępne w kolejnym etapie."
        >
          ＋ Dodaj
        </SoonButton>
      </div>
      {profile.vehicles.length === 0 ? (
        <p className="mt-3 text-df-body text-df-muted">Klient nie ma jeszcze zapisanych samochodów.</p>
      ) : (
        <ul tabIndex={0} aria-label="Samochody klienta" className="mt-3 flex max-h-[300px] flex-col gap-3 divide-y divide-df-line overflow-y-auto [&>li]:pt-3 [&>li:first-child]:pt-0">
          {profile.vehicles.map((vehicle) => (
            <VehicleItem key={vehicle.id} vehicle={vehicle} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Visits({ profile }: { profile: ClientProfile }) {
  return (
    <section aria-labelledby="profile-visits" className={panel}>
      <div className="flex h-7 items-center gap-2">
        <h2 id="profile-visits" className="min-w-0 flex-1 text-df-section">Ostatnie wizyty</h2>
        <SoonButton
          variant="secondary"
          className="h-7 bg-transparent px-0 text-df-label text-df-muted hover:bg-transparent hover:text-df-text"
          title="Cała historia — wkrótce"
          description="Pełna historia wizyt klienta będzie dostępna w kolejnym etapie."
        >
          Cała historia ↗
        </SoonButton>
      </div>
      {profile.visits.length === 0 ? (
        <p className="mt-4 text-df-body text-df-muted">Brak wizyt. Pierwsze zlecenie pojawi się tutaj.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-4">
          {profile.visits.map((visit) => (
            <li key={visit.number}>
              <p className="whitespace-pre text-df-strong">{formatDate(visit.at)}{"  ·  "}{formatPln(visit.totalGross)}</p>
              <p className="mt-1 truncate text-df-label text-df-muted">
                {visit.status === "completed" ? join([visit.vehicle, visit.service]) : join([visit.service, visitStatus[visit.status]])}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Karta wybranego klienta (D-05, prawa kolumna). */
export function ClientProfileCard({ profile }: { profile: ClientProfile | null }) {
  if (!profile) {
    return (
      <aside aria-label="Karta klienta" className={panel}>
        <p className="text-df-body text-df-muted">Wybierz klienta z listy, żeby zobaczyć jego auta i historię wizyt.</p>
      </aside>
    );
  }
  return (
    <aside aria-labelledby="profile-name" className="flex min-w-0 flex-col gap-5">
      <section className={`${panel} flex flex-col items-start gap-4`}>
        <div className="flex flex-wrap gap-2">
          <Badge variant={profile.isRegular ? "in-progress" : "accepted"}>{profile.isRegular ? "Stały klient" : "Klient"}</Badge>
          {profile.coatingService && <Badge variant="draft">Serwis powłoki</Badge>}
        </div>
        <h2 id="profile-name" className="max-w-full text-df-headline [overflow-wrap:anywhere]">{profile.name}</h2>
        <p className="text-df-body text-df-muted">{profile.phone ?? "Brak numeru telefonu"}</p>
        <p className="max-w-full truncate text-df-body text-df-muted">{profile.email ?? "Brak adresu e-mail"}</p>
        <p className="text-df-label text-df-muted">
          Klient od {formatSince(profile.since)} · {visitsLabel(profile.visitCount)}
        </p>
      </section>
      <Vehicles profile={profile} />
      <Visits profile={profile} />
    </aside>
  );
}
