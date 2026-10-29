"use client";

import { useState } from "react";
import type { IntakeDamage, OrderDetailsData, OrderPhoto } from "./order-types";
import { IntakeSchematic } from "./intake-schematic";
import { acceptOrderProtocol, MAX_PROTOCOL_DAMAGES, OrderMediaError, saveOrderProtocol, type ProtocolRecord } from "./order-media";

const control = "h-11 w-full rounded-lg bg-df-raised px-3 text-df-body text-df-text";
const legacy = [
  { x: 24 / 110, y: 41 / 195 },
  { x: 85 / 110, y: 135 / 195 },
  { x: 55 / 110, y: 174 / 195 },
];

function round(value: number) {
  return Math.round(Math.min(1, Math.max(0, value)) * 10000) / 10000;
}

function pointOf(damage: IntakeDamage, index: number) {
  if (typeof damage.x === "number" && typeof damage.y === "number") return { x: round(damage.x), y: round(damage.y) };
  const marker = legacy[index] ?? { x: 0.5, y: 0.5 };
  return { x: round(marker.x), y: round(marker.y) };
}

function toIntake(record: ProtocolRecord, previous: OrderDetailsData["intake"]): OrderDetailsData["intake"] {
  return {
    protocol: record.number,
    at: record.createdAt,
    by: record.createdByName ?? previous.by,
    acceptedAt: record.acceptedAt ?? "",
    damages: record.damages.map((damage) => ({
      no: damage.no,
      title: damage.title,
      part: damage.part,
      size: damage.size ?? "—",
      x: damage.x,
      y: damage.y,
      photoId: damage.photoId,
      photo: damage.photoNo,
    })),
  };
}

export function IntakeEditor({
  intake,
  studioId,
  workOrderId,
  photos,
  onSaved,
  onError,
}: {
  intake: OrderDetailsData["intake"];
  studioId: string;
  workOrderId: string;
  photos: OrderPhoto[];
  onSaved: (intake: OrderDetailsData["intake"]) => void;
  onError: (message: string) => void;
}) {
  const [damages, setDamages] = useState<IntakeDamage[]>(intake.damages);
  const [baseline, setBaseline] = useState(intake.damages);
  const [busy, setBusy] = useState<"save" | "accept" | null>(null);
  const dirty = JSON.stringify(damages) !== JSON.stringify(baseline);
  const linked = photos.filter((photo) => photo.id);

  function addPoint(point: { x: number; y: number }) {
    setDamages((current) => {
      if (current.length >= MAX_PROTOCOL_DAMAGES) return current;
      return [...current, { no: current.length + 1, title: "", part: "", size: "", x: round(point.x), y: round(point.y) }];
    });
  }

  function update(no: number, patch: Partial<IntakeDamage>) {
    setDamages((current) => current.map((damage) => damage.no === no ? { ...damage, ...patch } : damage));
  }

  function remove(no: number) {
    setDamages((current) => current.filter((damage) => damage.no !== no).map((damage, index) => ({ ...damage, no: index + 1 })));
  }

  function payload() {
    return damages.map((damage, index) => {
      const point = pointOf(damage, index);
      const size = damage.size.trim();
      return {
        title: damage.title.trim(),
        part: damage.part.trim(),
        ...(size && size !== "—" ? { size } : {}),
        x: point.x,
        y: point.y,
        ...(damage.photoId ? { photoId: damage.photoId } : {}),
      };
    });
  }

  async function save() {
    if (damages.some((damage) => !damage.title.trim() || !damage.part.trim())) {
      onError("Każdy punkt potrzebuje nazwy i elementu.");
      return;
    }
    setBusy("save");
    onError("");
    try {
      const next = toIntake(await saveOrderProtocol(studioId, workOrderId, payload()), intake);
      setDamages(next.damages);
      setBaseline(next.damages);
      onSaved(next);
    } catch (error) {
      lockIfAccepted(error);
    } finally {
      setBusy(null);
    }
  }

  async function accept() {
    setBusy("accept");
    onError("");
    try {
      onSaved(toIntake(await acceptOrderProtocol(studioId, workOrderId), intake));
    } catch (error) {
      lockIfAccepted(error);
    } finally {
      setBusy(null);
    }
  }

  function lockIfAccepted(error: unknown) {
    const message = error instanceof Error ? error.message : "Nie udało się zapisać protokołu.";
    onError(message);
    if (error instanceof OrderMediaError && error.status === 409 && /zaakceptowany/i.test(message)) {
      onSaved({ ...intake, acceptedAt: new Date().toISOString(), damages });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-df-body text-df-muted">Kliknij schemat, aby dodać punkt uszkodzenia. Po akceptacji protokół jest tylko do odczytu.</p>
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex h-[227px] w-[280px] shrink-0 justify-center rounded-lg bg-df-raised p-4">
          <IntakeSchematic damages={damages} onPlace={busy ? undefined : addPoint} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {damages.length === 0 ? (
            <p className="rounded-[10px] bg-df-raised p-6 text-center text-df-body text-df-muted">Nie dodano jeszcze punktów uszkodzeń.</p>
          ) : damages.map((damage) => (
            <fieldset key={damage.no} className="grid gap-3 rounded-[10px] bg-df-raised p-4 sm:grid-cols-2">
              <legend className="px-1 text-df-label text-df-muted">Punkt {damage.no}</legend>
              <label className="flex flex-col gap-1 text-df-label text-df-muted">
                Uszkodzenie
                <input aria-label={`Nazwa uszkodzenia ${damage.no}`} className={control} maxLength={120} value={damage.title} onChange={(event) => update(damage.no, { title: event.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-df-label text-df-muted">
                Element
                <input aria-label={`Element ${damage.no}`} className={control} maxLength={80} value={damage.part} onChange={(event) => update(damage.no, { part: event.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-df-label text-df-muted">
                Rozmiar
                <input aria-label={`Rozmiar ${damage.no}`} className={control} maxLength={80} value={damage.size === "—" ? "" : damage.size} onChange={(event) => update(damage.no, { size: event.target.value })} />
              </label>
              {linked.length > 0 && (
                <label className="flex flex-col gap-1 text-df-label text-df-muted">
                  Zdjęcie
                  <select aria-label={`Zdjęcie punktu ${damage.no}`} className={control} value={damage.photoId ?? ""} onChange={(event) => update(damage.no, { photoId: event.target.value || undefined })}>
                    <option value="">Bez zdjęcia</option>
                    {linked.map((photo) => <option key={photo.id} value={photo.id}>#{String(photo.no).padStart(2, "0")} {photo.caption}</option>)}
                  </select>
                </label>
              )}
              <button type="button" onClick={() => remove(damage.no)} className="h-11 justify-self-start text-df-label text-df-muted hover:text-df-text">
                Usuń punkt {damage.no}
              </button>
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy !== null || (damages.length === 0 && !intake.protocol)} onClick={() => void save()} className="h-11 rounded-lg bg-df-lime px-5 text-df-body font-medium text-df-bg disabled:opacity-40">
              {busy === "save" ? "Zapisywanie…" : "Zapisz protokół"}
            </button>
            {intake.protocol && (
              <button type="button" disabled={busy !== null || dirty} onClick={() => void accept()} className="h-11 rounded-lg bg-df-raised px-5 text-df-body font-medium disabled:opacity-40">
                {busy === "accept" ? "Zapisywanie…" : "Zaakceptuj stan"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
