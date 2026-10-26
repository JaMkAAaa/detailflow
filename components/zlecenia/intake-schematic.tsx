import type { IntakeDamage } from "./demo";

// Marker centres inside the 110 × 195 schematic (px), measured from the Figma
// markers; they match the order of damages 1–3 in the intake report.
const markers = [
  { x: 24, y: 41 },
  { x: 85, y: 135 },
  { x: 55, y: 174 },
];

/** Top view of the car with numbered damage points (Figma "Editable vehicle intake schematic"). */
export function IntakeSchematic({ damages }: { damages: IntakeDamage[] }) {
  return (
    <div
      role="img"
      aria-label={`Schemat auta z ${damages.length} zaznaczonymi uszkodzeniami`}
      className="relative h-[195px] w-[110px] shrink-0 overflow-clip"
    >
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
      {damages.slice(0, markers.length).map(({ no }, index) => (
        <span
          key={no}
          aria-hidden="true"
          style={{ left: markers[index]!.x, top: markers[index]!.y }}
          className="absolute -translate-x-1/2 -translate-y-1/2 text-[11px] leading-none text-df-bg"
        >
          {no}
        </span>
      ))}
    </div>
  );
}
