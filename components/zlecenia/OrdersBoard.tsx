"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { NoResultsState } from "@/components/states/no-results-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrderCardBody, cardClass } from "./OrderCard";
import { OrdersList } from "./OrdersList";
import {
  boardOrders,
  columns,
  employees,
  filterOrders,
  ordersLabel,
  type BoardOrder,
  type OrderStatus,
} from "./demo";

const fieldClass = "h-10 rounded-lg bg-df-raised px-4 text-df-label text-df-text";

function DraggableCard({ order, onOpen }: { order: BoardOrder; onOpen: (order: BoardOrder) => void }) {
  // Tylko wskaźnik: Enter/Spacja na karcie otwierają zlecenie, nie startują przeciągania.
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: order.number });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      onClick={() => onOpen(order)}
      className={cn(cardClass, isDragging && "opacity-40")}
    >
      <OrderCardBody order={order} />
    </button>
  );
}

function Column({
  status,
  title,
  color,
  orders,
  onOpen,
  onAdd,
}: {
  status: OrderStatus;
  title: string;
  color: string;
  orders: BoardOrder[];
  onOpen: (order: BoardOrder) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`column-${status}`}
      className={cn("flex min-h-[200px] min-w-0 flex-col gap-4 rounded-xl", isOver && "outline outline-2 -outline-offset-2 outline-df-line")}
    >
      <div className="flex h-[38px] items-start gap-2.5">
        <h2 id={`column-${status}`} className={cn("text-df-strong", color)}>
          <span aria-hidden="true">● </span>
          {title}
        </h2>
        <span
          aria-label={`Liczba zleceń: ${orders.length}`}
          className="flex h-7 items-center rounded-md bg-df-raised px-2.5 text-df-body font-medium text-df-muted"
        >
          {orders.length}
        </span>
      </div>
      {orders.map((order) => (
        <DraggableCard key={order.number} order={order} onOpen={onOpen} />
      ))}
      {orders.length === 0 && (
        <p className="rounded-xl border border-dashed border-df-line p-5 text-center text-df-body text-df-muted">
          Brak zleceń
        </p>
      )}
      {status === "accepted" && (
        <Button variant="secondary" className="h-10 w-full text-df-label" onClick={onAdd}>
          ＋ Dodaj zlecenie
        </Button>
      )}
    </section>
  );
}

export function OrdersBoard({ orders = boardOrders }: { orders?: BoardOrder[] }) {
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [employee, setEmployee] = useState("");
  const [service, setService] = useState("");
  const [dragged, setDragged] = useState<BoardOrder | null>(null);
  const [dropNotice, setDropNotice] = useState("");
  const [notice, setNotice] = useState({ title: "", description: "" });
  const dialog = useRef<HTMLDialogElement>(null);
  // Przeciągnięcie startuje dopiero po 6 px, więc zwykłe kliknięcie nadal otwiera kartę.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const services = [...new Set(orders.map((order) => order.service))].sort((a, b) => a.localeCompare(b, "pl"));
  const visible = filterOrders(orders, { query, employee, service });

  function showNotice(title: string, description: string) {
    setNotice({ title, description });
    dialog.current?.showModal();
  }
  function openOrder(order: BoardOrder) {
    showNotice(
      `${order.vehicle} · #${order.number}`,
      `Szczegóły zlecenia będą dostępne wkrótce. ${order.customer} · ${order.service}.`,
    );
  }
  function newOrder() {
    showNotice("Nowe zlecenie — wkrótce", "Tworzenie zleceń będzie dostępne w kolejnym etapie.");
  }
  function clearFilters() {
    setQuery("");
    setEmployee("");
    setService("");
  }
  function onDragStart({ active }: DragStartEvent) {
    setDropNotice("");
    setDragged(orders.find((order) => order.number === active.id) ?? null);
  }
  // Drop jest wizualny: status nie zmienia się do czasu zapisu zmiany etapu (5.2).
  function onDragEnd({ active, over }: DragEndEvent) {
    setDragged(null);
    const order = orders.find((item) => item.number === active.id);
    const target = columns.find((column) => column.status === over?.id);
    if (order && target && target.status !== order.status) {
      setDropNotice(`Zmiana statusu na „${target.title}” zapisze się w kolejnym etapie.`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex min-h-[70px] items-start justify-between gap-4">
        <div>
          <h1 className="text-df-headline">Zlecenia</h1>
          <p className="mt-1 text-df-body text-df-muted">
            {ordersLabel(visible.length)} w widoku. Od przyjęcia auta do ostatniego połysku.
          </p>
        </div>
        <Button className="h-10 w-[190px] text-df-label" onClick={newOrder}>
          ＋ Nowe zlecenie
        </Button>
      </div>
      <div className="flex min-h-11 items-start gap-3">
        <div className="relative w-[300px] shrink-0">
          <span aria-hidden="true" className="pointer-events-none absolute top-0 left-3.5 flex h-10 items-center text-df-label text-df-muted">
            ⌕
          </span>
          <input
            type="search"
            aria-label="Szukaj auta lub klienta"
            placeholder="Szukaj auta lub klienta…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={cn(fieldClass, "w-full pl-9 placeholder:text-df-text/60")}
          />
        </div>
        <select
          aria-label="Filtruj pracownika"
          value={employee}
          onChange={(event) => setEmployee(event.target.value)}
          className={cn(fieldClass, "w-[150px]")}
        >
          <option value="">Pracownik</option>
          {employees.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <select
          aria-label="Filtruj usługę"
          value={service}
          onChange={(event) => setService(event.target.value)}
          className={cn(fieldClass, "w-[180px]")}
        >
          <option value="">Wszystkie usługi</option>
          {services.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <p role="status" className="min-w-0 flex-1 truncate pt-2 text-df-body">
          {dropNotice}
        </p>
        <div role="group" aria-label="Widok zleceń" className="flex gap-3">
          {([["board", "Tablica"], ["list", "Lista"]] as const).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={cn(
                "h-7 rounded-md border px-2.5 text-df-body font-medium",
                view === value
                  ? "border-df-muted bg-df-line text-df-text"
                  : "border-transparent bg-df-raised text-df-muted hover:bg-df-hover",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <NoResultsState query={query} onClearFilters={clearFilters} />
      ) : view === "list" ? (
        <OrdersList orders={visible} onOpenOrder={openOrder} />
      ) : (
        <DndContext id="orders-board" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragged(null)}>
          <div role="group" aria-label="Tablica zleceń" className="grid grid-cols-4 items-start gap-4">
            {columns.map((column) => (
              <Column
                key={column.status}
                {...column}
                orders={visible.filter((order) => order.status === column.status)}
                onOpen={openOrder}
                onAdd={newOrder}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {dragged && (
              <div className={cn(cardClass, "cursor-grabbing shadow-lg ring-1 ring-df-line")}>
                <OrderCardBody order={dragged} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="orders-dialog-title"
        aria-describedby="orders-dialog-description"
        className="fixed inset-0 m-auto w-[440px] max-w-[calc(100%-32px)] rounded-xl border border-df-line bg-df-panel p-6 text-df-text backdrop:bg-black/60"
      >
        <h2 id="orders-dialog-title" className="text-df-section">{notice.title}</h2>
        <p id="orders-dialog-description" className="mt-3 text-df-body text-df-muted">{notice.description}</p>
        <form method="dialog" className="mt-5 flex justify-end">
          <button className={buttonVariants({ variant: "secondary" })}>Zamknij</button>
        </form>
      </dialog>
    </div>
  );
}
