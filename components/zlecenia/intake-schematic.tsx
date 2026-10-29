import type { MouseEvent } from "react";
import type { IntakeDamage } from "./order-types";

// Marker centres inside the 110 × 195 schematic (px), measured from the Figma
// markers; they match the order of damages 1–3 in the intake report when the
// record has no stored fractions.
const markers = [
  { x: 24, y: 41 },
  { x: 85, y: 135 },
  { x: 55, y: 174 },
];

function markerStyle(damage: IntakeDamage, index: number) {
  if (typeof damage.x === "number" && typeof damage.y === "number") {
    return { left: `${damage.x * 100}%`, top: `${damage.y * 100}%` };
  }
  const legacy = markers[index];
  return legacy ? { left: legacy.x, top: legacy.y } : null;
}

/** Top view of the car with numbered damage points (Figma "Editable vehicle intake schematic"). */
export function IntakeSchematic({ damages, onPlace }: { damages: IntakeDamage[]; onPlace?: (point: { x: number; y: number }) => void }) {
  function place(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || (event.clientX === 0 && event.clientY === 0)) {
      onPlace?.({ x: 0.5, y: 0.5 });
      return;
    }
    onPlace?.({
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    });
  }

  const marks = damages.map((damage, index) => {
    const style = markerStyle(damage, index);
    if (!style) return null;
    return (
      <span
        key={damage.no}
        aria-hidden="true"
        style={style}
        className="absolute -translate-x-1/2 -translate-y-1/2 text-[11px] leading-none text-df-bg"
      >
        {damage.no}
      </span>
    );
  });

  const art = (
    <>
      <div className="absolute inset-[3.59%_14.55%_5.64%_14.55%]">
        <div className="absolute inset-[-0.56%_-1.28%]">
          {/* Local decorative Figma SVGs keep their original geometry. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/orders/intake-body.svg" alt="" className="block size-full max-w-none" />
        </div>
      </div>
      <div className="absolute inset-[15.9%_13.64%_5.64%_12.73%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/orders/intake-glass.svg" alt="" className="absolute inset-0 block size-full max-w-none" />
      </div>
      {marks}
    </>
  );

  if (!onPlace) {
    return (
      <div
        role="img"
        aria-label={`Schemat auta z ${damages.length} zaznaczonymi uszkodzeniami`}
        className="relative h-[195px] w-[110px] shrink-0 overflow-clip"
      >
        {art}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={place}
      aria-label="Dodaj punkt uszkodzenia na schemacie auta"
      className="relative h-[195px] w-[110px] shrink-0 overflow-clip"
    >
      {art}
    </button>
  );
}
