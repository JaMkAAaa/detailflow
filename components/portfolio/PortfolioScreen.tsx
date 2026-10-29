"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MASK_MIN_H, MASK_MIN_W, maskError, type MaskRect } from "@/lib/portfolio/rules";

type Photo = {
  id: string;
  no: number;
  caption: string | null;
  published: boolean;
  plateVisible: boolean;
  mask: MaskRect | null;
  previewUrl: string;
  urlExpiresIn: number;
  make: string;
  model: string;
  plate: string;
  service: string;
  clientName: string;
  orderNumber: string;
};
type Result = { ok: true; value: unknown } | { ok: false; error: string };
export type PortfolioActions = {
  publish: (studioId: string, photoId: string, input: unknown) => Promise<Result>;
  unpublish: (studioId: string, photoId: string) => Promise<Result>;
};

const emptyBox = { x: "", y: "", w: "", h: "" };

function percentMask(box: typeof emptyBox): MaskRect | null {
  if ([box.x, box.y, box.w, box.h].some((value) => value.trim() === "")) return null;
  const mask = { x: Number(box.x) / 100, y: Number(box.y) / 100, w: Number(box.w) / 100, h: Number(box.h) / 100 };
  if (Object.values(mask).some((value) => Number.isNaN(value))) return null;
  return mask;
}

export function PortfolioScreen({
  studioId, publicHref, photos, truncated, canPublish, canUnpublish, actions,
}: {
  studioId: string;
  publicHref: string;
  photos: Photo[];
  truncated: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  actions: PortfolioActions;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-df-section">Portfolio realizacji</h1>
        <p className="mt-2 text-df-muted">
          Zdjęcia zleceń są prywatne, dopóki ich nie opublikujesz. Domyślnie powstaje osobna wersja z zamaskowaną tablicą.
          Oryginał zostaje w prywatnym magazynie i nie wchodzi na stronę publiczną. Żeby tablica została widoczna, zaznacz to wprost.
        </p>
        <p className="mt-3"><Link href={publicHref} className="text-df-lime">Strona publiczna</Link></p>
      </header>
      {photos.length === 0 ? (
        <p role="status" className="rounded-xl bg-df-panel p-5 text-df-muted">
          Brak potwierdzonych zdjęć. Wgraj zdjęcie przy zleceniu, a potem zdecyduj, czy ma być publiczne.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {photos.map((photo) => (
            <PhotoCard key={photo.id} studioId={studioId} photo={photo} canPublish={canPublish} canUnpublish={canUnpublish} actions={actions} />
          ))}
        </ul>
      )}
      {truncated && <p className="text-df-muted">Pokazano 48 ostatnich potwierdzonych zdjęć.</p>}
      {!canPublish && !canUnpublish && <p className="text-df-muted">Publikację ustawia właściciel lub manager.</p>}
      {canUnpublish && !canPublish && <p className="text-df-muted">Abonament nie pozwala dodawać publikacji. Zdjęcie już publiczne można cofnąć.</p>}
    </div>
  );
}

function PhotoCard({
  studioId, photo, canPublish, canUnpublish, actions,
}: {
  studioId: string;
  photo: Photo;
  canPublish: boolean;
  canUnpublish: boolean;
  actions: PortfolioActions;
}) {
  const router = useRouter();
  const [plateVisible, setPlateVisible] = useState(false);
  const [box, setBox] = useState(emptyBox);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mask = percentMask(box);
  const maskReady = mask !== null && maskError(mask) === null;
  const label = `${photo.make} ${photo.model} nr ${photo.no}`;
  const preview = mask ?? photo.mask;

  async function publish() {
    setBusy(true);
    setError("");
    try {
      const result = await actions.publish(studioId, photo.id, plateVisible ? { plateVisible: true } : { plateVisible: false, mask });
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    } catch {
      setError("Nie udało się opublikować zdjęcia.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    setError("");
    try {
      const result = await actions.unpublish(studioId, photo.id);
      if (!result.ok) { setError(result.error); return; }
      setPlateVisible(false);
      setBox(emptyBox);
      router.refresh();
    } catch {
      setError("Nie udało się cofnąć publikacji.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-4 rounded-xl bg-df-panel p-5">
      <div className="relative overflow-hidden rounded-lg bg-df-raised">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.previewUrl}
          alt={`Prywatny podgląd ${photo.make} ${photo.model}, tablica ${photo.plate}`}
          referrerPolicy="no-referrer"
          className="aspect-[4/3] w-full object-cover"
        />
        {preview && !plateVisible && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute border-2 border-df-lime bg-df-bg/70"
            style={{ left: `${preview.x * 100}%`, top: `${preview.y * 100}%`, width: `${preview.w * 100}%`, height: `${preview.h * 100}%` }}
          />
        )}
      </div>
      <div>
        <h2 className="text-df-strong">{photo.make} {photo.model}</h2>
        <p className="mt-1 text-df-muted">{photo.service} · zlecenie {photo.orderNumber} · {photo.clientName}</p>
        <p className="mt-1">Tablica w danych zlecenia: {photo.plate}. To pole nie maskuje tablicy na fotografii.</p>
        {photo.caption && <p className="mt-1 text-df-muted">{photo.caption}</p>}
        <p className="mt-2 text-df-label text-df-muted">
          {photo.published
            ? (photo.plateVisible ? "Opublikowane. Tablica została świadomie zostawiona." : "Opublikowane. Tablica jest zamaskowana na wersji publicznej.")
            : "Prywatne. Nie widać go na stronie publicznej."}
        </p>
      </div>
      {error && <p role="alert" className="text-df-amber">{error}</p>}
      {photo.published && canUnpublish && (
        <Button type="button" variant="secondary" loading={busy} onClick={() => void unpublish()}>Cofnij publikację {label}</Button>
      )}
      {!photo.published && canPublish && (
        <div className="flex flex-col gap-4">
          <label className="flex items-start gap-3 text-df-body">
            <input
              type="checkbox"
              className="mt-1"
              checked={plateVisible}
              onChange={(event) => setPlateVisible(event.target.checked)}
            />
            <span>Zostaw tablicę widoczną na zdjęciu {label}</span>
          </label>
          {!plateVisible && (
            <fieldset className="flex flex-col gap-3">
              <legend className="text-df-label text-df-muted">Obszar tablicy w procentach kadru. Minimum {MASK_MIN_W * 100}% szerokości i {MASK_MIN_H * 100}% wysokości.</legend>
              <div className="grid gap-3 sm:grid-cols-4">
                {([
                  ["x", "Lewa krawędź (%)"],
                  ["y", "Górna krawędź (%)"],
                  ["w", "Szerokość (%)"],
                  ["h", "Wysokość (%)"],
                ] as const).map(([key, fieldLabel]) => (
                  <label key={key} className="flex flex-col gap-2 text-df-label text-df-muted">
                    {fieldLabel} {label}
                    <Input inputMode="decimal" value={box[key]} onChange={(event) => setBox({ ...box, [key]: event.target.value })} />
                  </label>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setBox({ x: "30", y: "62", w: "40", h: "16" })}
              >
                Dolny środek kadru {label}
              </Button>
            </fieldset>
          )}
          {plateVisible && (
            <p className="text-df-amber">Tablica zostanie opublikowana bez maski. Oryginał z krótkim podpisem i tak nie trafi na stronę publiczną.</p>
          )}
          <Button type="button" loading={busy} disabled={!plateVisible && !maskReady} onClick={() => void publish()}>
            Opublikuj {label}
          </Button>
        </div>
      )}
    </li>
  );
}
