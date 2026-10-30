"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { EmptyState, NoResultsState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { OrderCreateDialog, type OrderClientChoice, type OrderServiceChoice } from "./OrderCreateDialog";
import { OrderCardBody, cardClass } from "./OrderCard";
import { OrdersList } from "./OrdersList";
import { columns, filterOrders, ordersLabel, type BoardOrder, type OrderStatus } from "./board-demo";

const fieldClass = "h-10 rounded-lg bg-df-raised px-4 text-df-label text-df-text";

function DraggableCard({ order }: { order: BoardOrder }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: order.id ?? order.number });
  return <Link ref={setNodeRef} {...listeners} href={`/orders/${order.number}`} className={cn(cardClass, isDragging && "opacity-40")}>
    <OrderCardBody order={order} />
  </Link>;
}

function Column({ status, title, color, orders, onAdd }: {
  status: OrderStatus; title: string; color: string; orders: BoardOrder[]; onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return <section ref={setNodeRef} aria-labelledby={`column-${status}`} className={cn("flex min-h-[200px] min-w-0 flex-col gap-4 rounded-xl", isOver && "outline outline-2 -outline-offset-2 outline-df-line")}>
    <div className="flex h-[38px] items-start gap-2.5">
      <h2 id={`column-${status}`} className={cn("text-df-strong", color)}><span aria-hidden="true">● </span>{title}</h2>
      <span aria-label={`Liczba zleceń: ${orders.length}`} className="flex h-7 items-center rounded-md bg-df-raised px-2.5 text-df-body font-medium text-df-muted">{orders.length}</span>
    </div>
    {orders.map((order) => <DraggableCard key={order.id ?? order.number} order={order} />)}
    {orders.length === 0 && <p className="rounded-xl border border-dashed border-df-line p-5 text-center text-df-body text-df-muted">Brak zleceń</p>}
    {status === "accepted" && <Button variant="secondary" className="h-10 w-full text-df-label" onClick={onAdd}>＋ Dodaj zlecenie</Button>}
  </section>;
}

export function OrdersBoard({ studioId, orders, clients, services, onCreated, onChangeStatus }: {
  studioId: string; orders: BoardOrder[]; clients: OrderClientChoice[]; services: OrderServiceChoice[];
  onCreated: (order: unknown) => void;
  onChangeStatus: (order: BoardOrder, status: OrderStatus) => Promise<void>;
}) {
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [service, setService] = useState("");
  const [dragged, setDragged] = useState<BoardOrder | null>(null);
  const [dropNotice, setDropNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const serviceNames = [...new Set(orders.map((order) => order.service))].sort((a, b) => a.localeCompare(b, "pl"));
  const visible = filterOrders(orders, { query, service });

  function clearFilters() { setQuery(""); setService(""); }
  function onDragStart({ active }: DragStartEvent) {
    setDropNotice("");
    setDragged(orders.find((order) => (order.id ?? order.number) === active.id) ?? null);
  }
  async function onDragEnd({ active, over }: DragEndEvent) {
    setDragged(null);
    const order = orders.find((item) => (item.id ?? item.number) === active.id);
    const target = columns.find((column) => column.status === over?.id);
    if (!order || !target || target.status === order.status) return;
    try {
      await onChangeStatus(order, target.status);
      setDropNotice(`Status zmieniono na „${target.title}”.`);
    } catch (cause) {
      setDropNotice(cause instanceof Error ? cause.message : "Nie udało się zmienić statusu. Karta wróciła na poprzednie miejsce.");
    }
  }

  return <div className="flex flex-col gap-6">
    <div className="flex min-h-[70px] items-start justify-between gap-4">
      <div><h1 className="text-df-headline">Zlecenia</h1><p className="mt-1 text-df-body text-df-muted">{ordersLabel(visible.length)} w widoku. Od przyjęcia auta do ostatniego połysku.</p></div>
      <Button className="h-10 w-[190px] text-df-label" onClick={() => setCreateOpen(true)}>＋ Nowe zlecenie</Button>
    </div>
    <div className="flex min-h-11 items-start gap-3">
      <div className="relative w-[300px] shrink-0"><span aria-hidden="true" className="pointer-events-none absolute top-0 left-3.5 flex h-10 items-center text-df-label text-df-muted">⌕</span>
        <input type="search" aria-label="Szukaj auta lub klienta" placeholder="Szukaj auta lub klienta…" value={query} onChange={(event) => setQuery(event.target.value)} className={cn(fieldClass, "w-full pl-9 placeholder:text-df-text/60")} />
      </div>
      <Select aria-label="Filtruj usługę" size="filter" className="w-[180px] shrink-0" value={service} onChange={(event) => setService(event.target.value)} options={[{ value: "", label: "Wszystkie usługi" }, ...serviceNames.map((name) => ({ value: name, label: name }))]} />
      <p role="status" className="min-w-0 flex-1 truncate pt-2 text-df-body">{dropNotice}</p>
      <div role="group" aria-label="Widok zleceń" className="flex gap-3">{([ ["board", "Tablica"], ["list", "Lista"] ] as const).map(([value, label]) => <button key={value} aria-pressed={view === value} onClick={() => setView(value)} className={cn("h-7 rounded-md border px-2.5 text-df-body font-medium", view === value ? "border-df-muted bg-df-line text-df-text" : "border-transparent bg-df-raised text-df-muted hover:bg-df-hover")}>{label}</button>)}</div>
    </div>
    {orders.length === 0 ? <EmptyState title="Brak zleceń" description="Utwórz pierwsze zlecenie, aby zacząć pracę w tablicy." actions={<Button onClick={() => setCreateOpen(true)}>＋ Nowe zlecenie</Button>} />
      : visible.length === 0 ? <NoResultsState query={query} onClearFilters={clearFilters} />
        : view === "list" ? <OrdersList orders={visible} />
          : <DndContext id="orders-board" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragged(null)}>
            <div role="group" aria-label="Tablica zleceń" className="grid grid-cols-5 items-start gap-4">{columns.map((column) => <Column key={column.status} {...column} orders={visible.filter((order) => order.status === column.status)} onAdd={() => setCreateOpen(true)} />)}</div>
            <DragOverlay dropAnimation={null}>{dragged && <div className={cn(cardClass, "cursor-grabbing shadow-lg ring-1 ring-df-line")}><OrderCardBody order={dragged} /></div>}</DragOverlay>
          </DndContext>}
    {createOpen && <OrderCreateDialog studioId={studioId} clients={clients} services={services} onCreated={onCreated} onClose={() => setCreateOpen(false)} />}
  </div>;
}
