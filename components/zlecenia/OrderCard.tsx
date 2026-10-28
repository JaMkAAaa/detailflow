import { formatPln } from "@/lib/format-pln";
import type { BoardOrder } from "./board-demo";

/** Karta zlecenia z D-03 (Figma 6:617 / 6:640). Zawartość statyczna; klikalność i DnD dodaje rodzic. */
export function OrderCardBody({ order }: { order: BoardOrder }) {
  return (
    <>
      {order.photo && (
        // Zdjęcie z Figmy (6:641), lokalny zasób 2× dla slotu 239 × 82.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={order.photo}
          width={239}
          height={82}
          alt={`Zdjęcie: ${order.vehicle}`}
          draggable={false}
          className="h-[82px] w-full rounded-[10px] object-cover"
        />
      )}
      <span className="text-df-strong">{order.vehicle}</span>
      <span className="text-df-body font-medium text-df-muted">
        #{order.number} · {order.customer}
      </span>
      <span className="text-df-body">{order.service}</span>
      <span className="h-px w-full bg-df-line" />
      <span className="flex w-full items-start gap-2 font-medium">
        <span className="min-w-0 flex-1 text-[11px] text-df-muted">
          {order.dueLabel}
        </span>
        <span className="shrink-0 text-df-body whitespace-nowrap">
          {formatPln(order.grossPln)}
        </span>
      </span>
    </>
  );
}

export const cardClass =
  "flex min-h-[186px] w-full touch-manipulation flex-col items-start gap-4 rounded-xl bg-df-panel p-5 text-left text-df-text hover:bg-df-raised motion-reduce:transition-none";
