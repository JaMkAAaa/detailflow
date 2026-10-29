"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatPln } from "@/lib/format-pln";
import { cn } from "@/lib/utils";
import { IntakeEditor } from "./intake-editor";
import { IntakeSchematic } from "./intake-schematic";
import { displayPhotoSrc } from "./order-media";
import { PhotoFileButton } from "./photo-file-button";
import {
  type HistoryEvent,
  type OrderDetailsData,
  type OrderPhoto,
} from "./order-types";
import { formatDay, formatDayTime, formatDayYear, formatTime } from "./order-format";
import type { PendingPhoto } from "./use-order-photos";

export function pluralPhotos(count: number) {
  if (count === 1) return "1 zdjęcie";
  const tail = count % 10;
  const teen = count % 100 >= 12 && count % 100 <= 14;
  return `${count} ${tail >= 2 && tail <= 4 && !teen ? "zdjęcia" : "zdjęć"}`;
}

function Card({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-4 rounded-xl bg-df-panel p-5", className)}>
      <div className="flex min-h-7 items-center gap-2">
        <h2 className="flex-1 text-df-section">{title}</h2>
        {aside && <div className="shrink-0 text-df-label text-df-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

const textButton = "rounded-sm hover:text-df-text";

export type PhotoActions = {
  pending: PendingPhoto[];
  uploading: boolean;
  onFiles: (files: File[]) => void;
};

function PhotoFrame({ photo, vehicle, className, sizes }: { photo: OrderPhoto; vehicle: string; className?: string; sizes: string }) {
  const src = displayPhotoSrc(photo.src);
  const alt = `${vehicle} — ${photo.caption.toLowerCase()}`;
  if (!src) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-1 rounded-[10px] bg-df-raised text-df-muted", className)}>
        <span className="text-df-section text-df-text">#{String(photo.no).padStart(2, "0")}</span>
        <span className="text-df-label">Podgląd niedostępny</span>
      </div>
    );
  }
  if (src.startsWith("/")) {
    return (
      <div className={cn("relative overflow-hidden rounded-[10px] bg-df-raised", className)}>
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden rounded-[10px] bg-df-raised", className)}>
      {/* Podpisany URL S3. next/image proxuje żądanie i gubi query z podpisem. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="absolute inset-0 size-full object-cover" />
    </div>
  );
}

function IntakeSummary({ data }: { data: OrderDetailsData }) {
  const { intake } = data;
  if (!intake.protocol) return <p className="rounded-[10px] bg-df-raised p-6 text-center text-df-body text-df-muted">Protokół przyjęcia nie został jeszcze utworzony.</p>;
  if (intake.damages.length === 0) return <p className="rounded-[10px] bg-df-raised p-6 text-center text-df-body text-df-muted">Protokół #{intake.protocol} nie zawiera jeszcze punktów uszkodzeń.</p>;
  return (
    <>
      <div className="flex gap-6">
        <div className="flex h-[227px] w-[280px] shrink-0 justify-center rounded-lg bg-df-raised p-4">
          <IntakeSchematic damages={intake.damages} />
        </div>
        <ol className="flex min-w-0 flex-1 flex-col gap-4 p-2">
          {intake.damages.map((damage) => (
            <li key={damage.no}>
              <p className="text-df-strong">
                <span aria-hidden="true" className="mr-3">{damage.no}</span>
                {damage.title}
              </p>
              <p className="mt-1 text-df-label text-df-muted">{damage.size}{damage.photo ? ` · zdjęcie #${String(damage.photo).padStart(2, "0")}` : ""}</p>
            </li>
          ))}
        </ol>
      </div>
      {intake.acceptedAt && <p className="text-df-label text-df-green">
        ✓ Stan zaakceptowany przez klienta · {formatDayYear(intake.acceptedAt)}, {formatTime(intake.acceptedAt)}
      </p>}
    </>
  );
}

export function Overview({
  data,
  onOpenTab,
  photos,
}: {
  data: OrderDetailsData;
  onOpenTab: (tab: "zdjecia" | "stan-auta") => void;
  photos: PhotoActions;
}) {
  const latest = data.photos.at(-1);
  const { customer, quote } = data;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_378px] items-start gap-6">
      <div className="flex min-w-0 flex-col gap-5">
        <Card
          title="Dokumentacja zlecenia"
          aside={
            <span className="flex gap-2">
              <button type="button" onClick={() => onOpenTab("zdjecia")} className={textButton}>{pluralPhotos(data.photos.length)}</button>
              <span aria-hidden="true">·</span>
              <PhotoFileButton ariaLabel="Dodaj zdjęcia" multiple disabled={photos.uploading} onFiles={photos.onFiles} className={cn(textButton, "cursor-pointer")}>
                {photos.uploading ? "Wgrywanie…" : "Dodaj zdjęcia ＋"}
              </PhotoFileButton>
            </span>
          }
        >
          {latest ? (
            <>
              <PhotoFrame photo={latest} vehicle={data.vehicle} className="h-[220px] w-full" sizes="(min-width: 1280px) 722px, 60vw" />
              <div className="flex items-center gap-3 text-df-label text-df-muted">
                <Badge variant={data.status}>{data.status === "error" ? "Anulowane" : undefined}</Badge>
                <span>{formatDayTime(latest.at)} · {data.intake.by}</span>
              </div>
            </>
          ) : (
            <p className="rounded-[10px] bg-df-raised p-6 text-center text-df-body text-df-muted">Brak zdjęć. Dodaj pierwsze zdjęcie przy przyjęciu auta.</p>
          )}
          {photos.pending.filter((item) => item.error).map((item) => (
            <p key={item.localId} role="alert" className="text-df-label text-df-error">{item.caption}: {item.error}</p>
          ))}
        </Card>
        <Card
          title="Stan auta przy przyjęciu"
          aside={data.intake.protocol ? <button type="button" onClick={() => onOpenTab("stan-auta")} className={textButton}>Protokół #{data.intake.protocol}</button> : <span>Protokół przyjęcia</span>}
        >
          <IntakeSummary data={data} />
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card title="Postęp prac" aside={data.bay} className="gap-2">
          <div><Badge variant={data.status}>{data.status === "error" ? "Anulowane" : undefined}</Badge></div>
          <Stages stages={data.stages} />
        </Card>
        <Card title="Wycena" aside={quote.status === "—" ? "Kwota zlecenia" : `${quote.status} ✓`}>
          <dl className="flex flex-col gap-4 text-df-body">
            {quote.items.map((item) => (
              <div key={item.name} className="flex justify-end gap-6">
                <dt>{item.name}</dt>
                <dd className="w-[70px] text-right">{formatPln(item.grossPln)}</dd>
              </div>
            ))}
          </dl>
          <div className="h-px bg-df-line" />
          <p className="flex justify-end gap-6 text-df-section">
            <span>Razem brutto</span>
            <span className="w-[100px] text-right">{formatPln(quote.totalGrossPln)}</span>
          </p>
        </Card>
        <section aria-label="Kontakt do klienta" className="flex flex-col gap-4 rounded-xl bg-df-panel p-5">
          <h2 className="text-df-section">{customer.name}</h2>
          {customer.phone && <a href={`tel:${customer.phone.replaceAll(" ", "")}`} className="w-fit text-df-body text-df-muted hover:text-df-text">{customer.phone}</a>}
          {customer.email && <a href={`mailto:${customer.email}`} className="w-fit text-df-body text-df-muted hover:text-df-text">{customer.email}</a>}
          {customer.id && <Link href={`/customers/${customer.id}`} className="flex h-10 items-center justify-center rounded-md bg-df-raised px-4 text-df-label font-medium hover:bg-df-hover">Otwórz kartę klienta ↗</Link>}
        </section>
      </div>
    </div>
  );
}

export function Stages({ stages }: { stages: OrderDetailsData["stages"] }) {
  const symbol = { done: "✓", current: "●", todo: "○" } as const;
  const label = { done: "Zakończony", current: "W trakcie", todo: "Oczekuje" } as const;
  return (
    <ol aria-label="Etapy zlecenia" className="flex flex-col gap-2">
      {stages.map((stage) => (
        <li key={stage.name} aria-current={stage.state === "current" ? "step" : undefined} className="flex flex-col gap-0.5 py-0.5">
          <p className={cn("text-df-strong", stage.state === "current" ? "text-df-lime" : "text-df-muted")}>
            <span aria-hidden="true" className="mr-3">{symbol[stage.state]}</span>
            {stage.name}
            <span className="sr-only"> — {label[stage.state]}</span>
          </p>
          <p className="text-df-label text-df-muted">{stage.note}</p>
        </li>
      ))}
    </ol>
  );
}

export function PhotosTab({ data, photos }: { data: OrderDetailsData; photos: PhotoActions }) {
  const tiles = photos.pending.length + data.photos.length;
  return (
    <Card
      title="Zdjęcia"
      aside={
        <PhotoFileButton
          ariaLabel="Dodaj zdjęcia"
          multiple
          disabled={photos.uploading}
          onFiles={photos.onFiles}
          className={buttonVariants({ variant: "secondary", className: "h-9 cursor-pointer text-df-label" })}
        >
          {photos.uploading ? "Wgrywanie…" : "Dodaj zdjęcia ＋"}
        </PhotoFileButton>
      }
    >
      {tiles === 0 ? (
        <p className="rounded-[10px] bg-df-raised p-6 text-center text-df-body text-df-muted">Brak zdjęć. Dodaj pierwsze zdjęcie przy przyjęciu auta.</p>
      ) : (
        <>
          {data.photos.length > 0 && <p className="text-df-label text-df-muted">{pluralPhotos(data.photos.length)} · od najnowszych</p>}
          <ul className="grid grid-cols-3 gap-5 xl:grid-cols-4">
            {photos.pending.map((item) => (
              <li key={item.localId} className="flex flex-col gap-2">
                <div className="relative flex aspect-[3/2] w-full flex-col items-center justify-center overflow-hidden rounded-[10px] bg-df-raised text-df-label text-df-muted">
                  {item.previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt="" className="absolute inset-0 size-full object-cover" />
                  )}
                  {!item.error && <span className="relative">Wgrywanie…</span>}
                </div>
                <p className="text-df-strong">{item.caption}</p>
                {item.error && <p role="alert" className="text-df-label text-df-error">{item.error}</p>}
              </li>
            ))}
            {[...data.photos].reverse().map((photo) => (
              <li key={photo.no} className="flex flex-col gap-2">
                <PhotoFrame photo={photo} vehicle={data.vehicle} className="aspect-[3/2] w-full" sizes="(min-width: 1280px) 25vw, 33vw" />
                <p className="text-df-strong">
                  <span className="text-df-muted">#{String(photo.no).padStart(2, "0")}</span> {photo.caption}
                </p>
                <p className="text-df-label text-df-muted">{photo.stage} · {formatDay(photo.at)}, {formatTime(photo.at)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function IntakeTab({
  data,
  studioId,
  onIntake,
}: {
  data: OrderDetailsData;
  studioId: string;
  onIntake?: (intake: OrderDetailsData["intake"]) => void;
}) {
  const [intake, setIntake] = useState(data.intake);
  const [error, setError] = useState("");
  function publish(next: OrderDetailsData["intake"]) {
    setIntake(next);
    onIntake?.(next);
  }
  return (
    <Card title="Stan auta przy przyjęciu" aside={intake.protocol ? `Protokół #${intake.protocol}` : undefined}>
      {error && <p role="alert" className="text-df-body text-df-error">{error}</p>}
      {intake.acceptedAt ? <IntakeReadonly data={{ ...data, intake }} /> : (
        <IntakeEditor intake={intake} studioId={studioId} workOrderId={data.id} photos={data.photos} onSaved={publish} onError={setError} />
      )}
    </Card>
  );
}

function IntakeReadonly({ data }: { data: OrderDetailsData }) {
  const { intake } = data;
  return (
    <>
      {!intake.protocol ? <p className="rounded-[10px] bg-df-raised p-6 text-center text-df-body text-df-muted">Protokół przyjęcia nie został jeszcze utworzony.</p> : <>
        <p className="text-df-body text-df-muted">Przyjęto {formatDayTime(intake.at)} · przyjął {intake.by} · {data.vehicle}, {data.plate}</p>
        {intake.damages.length === 0 ? <p className="rounded-[10px] bg-df-raised p-6 text-center text-df-body text-df-muted">Nie dodano jeszcze punktów uszkodzeń.</p> : <div className="flex flex-col gap-6 overflow-x-auto lg:flex-row">
          <div className="flex h-[227px] w-[280px] shrink-0 justify-center rounded-lg bg-df-raised p-4"><IntakeSchematic damages={intake.damages} /></div>
          <table className="h-fit w-full min-w-0 text-left text-df-body">
            <caption className="sr-only">Uszkodzenia zapisane w protokole #{intake.protocol}</caption>
            <thead className="text-df-label text-df-muted"><tr className="border-b border-df-line">
              <th scope="col" className="py-2 pr-4 font-medium">Nr</th><th scope="col" className="py-2 pr-4 font-medium">Uszkodzenie</th><th scope="col" className="py-2 pr-4 font-medium">Element</th><th scope="col" className="py-2 pr-4 font-medium">Rozmiar</th><th scope="col" className="py-2 font-medium">Zdjęcie</th>
            </tr></thead>
            <tbody>{intake.damages.map((damage) => <tr key={damage.no} className="border-b border-df-line last:border-0"><td className="py-3 pr-4 text-df-muted">{damage.no}</td><td className="py-3 pr-4 text-df-strong">{damage.title}</td><td className="py-3 pr-4">{damage.part}</td><td className="py-3 pr-4">{damage.size}</td><td className="py-3">{damage.photo ? `#${String(damage.photo).padStart(2, "0")}` : "—"}</td></tr>)}</tbody>
          </table>
        </div>}
        {intake.acceptedAt && <p className="text-df-label text-df-green">✓ Stan zaakceptowany przez klienta · {formatDayYear(intake.acceptedAt)}, {formatTime(intake.acceptedAt)}</p>}
      </>}
    </>
  );
}

const actorLabel: Record<HistoryEvent["kind"], string> = { studio: "Studio", client: "Klient", system: "System" };

export function HistoryTab({ data }: { data: OrderDetailsData }) {
  const events = [...data.history].reverse();
  return (
    <Card title="Historia zlecenia" aside={`${events.length} zdarzeń · od najnowszych`}>
      {events.length === 0 ? (
        <p className="rounded-[10px] bg-df-raised p-6 text-center text-df-body text-df-muted">Brak zdarzeń w historii zlecenia.</p>
      ) : (
        <ol className="flex flex-col">
          {events.map((event) => (
            <li key={event.at + event.title} className="group grid grid-cols-[150px_16px_minmax(0,1fr)] gap-x-4 pb-5 last:pb-0">
              <time dateTime={event.at} className="pt-0.5 text-right text-df-label text-df-muted">
                {formatDayTime(event.at)}
              </time>
              <span aria-hidden="true" className="relative flex justify-center">
                <span className="absolute top-0 bottom-[-20px] w-px bg-df-line group-last:hidden" />
                <span className={cn("relative mt-1.5 size-2.5 rounded-full", event.kind === "client" ? "bg-df-blue" : event.kind === "system" ? "bg-df-muted" : "bg-df-lime")} />
              </span>
              <div>
                <p className="text-df-strong">{event.title}</p>
                {event.detail && <p className="mt-0.5 text-df-body text-df-muted">{event.detail}</p>}
                <p className="mt-0.5 text-df-label text-df-muted">{event.kind === "system" ? event.actor : `${actorLabel[event.kind]} · ${event.actor}`}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
