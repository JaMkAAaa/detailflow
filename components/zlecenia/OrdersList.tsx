import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatPln } from "@/lib/format-pln";
import { columns, type BoardOrder } from "./board-demo";

const badge = {
  accepted: "accepted",
  in_progress: "in-progress",
  ready_for_pickup: "ready-for-pickup",
  completed: "completed",
  canceled: "error",
} as const;

const headings = ["ZLECENIE", "AUTO / KLIENT", "USŁUGA", "PRACOWNIK", "STATUS", "TERMIN", "WARTOŚĆ"];

/** Widok „Lista” — te same zlecenia co na tablicy, w kolejności kolumn. */
export function OrdersList({
  orders,
}: {
  orders: BoardOrder[];
}) {
  const rows = columns.flatMap(({ status }) => orders.filter((order) => order.status === status));
  return (
    <section aria-label="Lista zleceń" className="rounded-xl bg-df-panel p-5">
      <table className="w-full table-fixed text-left">
        <caption className="sr-only">Zlecenia — widok listy</caption>
        <colgroup>
          <col className="w-[10%]" />
          <col className="w-[22%]" />
          <col className="w-[20%]" />
          <col className="w-[10%]" />
          <col className="w-[13%]" />
          <col className="w-[15%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="h-8 border-b border-df-line text-df-label text-df-muted">
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col" className="pb-3 font-medium">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.number} className="h-[59px]">
              <td className="pr-2 text-df-body text-df-muted">#{order.number}</td>
              <td className="pr-2">
                <Link href={`/orders/${order.number}`} className="text-left hover:text-df-lime">
                  <span className="block text-df-strong">{order.vehicle}</span>
                  <span className="mt-px block text-df-label text-df-muted">{order.customer}</span>
                </Link>
              </td>
              <td className="pr-2 text-df-body text-df-muted">{order.service}</td>
              <td className="pr-2 text-df-body text-df-muted">—</td>
              <td className="pr-2">
                <Badge variant={badge[order.status]} />
              </td>
              <td className="pr-2 text-df-body text-df-muted">{order.dueLabel}</td>
              <td className="whitespace-nowrap text-df-strong">{formatPln(order.grossPln)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
