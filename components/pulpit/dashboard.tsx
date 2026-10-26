"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Kpis } from "./kpis";
import { Schedule } from "./schedule";
import { OrdersToday } from "./orders-today";
import { todayOrders, type TodayOrder } from "./demo";

export function Dashboard() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [notice, setNotice] = useState({ title: "", description: "" });
  function showNotice(title: string, description: string) {
    setNotice({ title, description });
    dialog.current?.showModal();
  }
  function openOrder(order: TodayOrder) {
    showNotice(
      `${order.vehicle} · #${order.number}`,
      `Szczegóły zlecenia będą dostępne wkrótce. ${order.customer} · ${order.plate} · ${order.service}.`,
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex min-h-[66px] items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-df-headline">Dzień dobry, Michał.</h1>
          <p className="mt-1 text-df-body text-df-muted">
            Sobota, 24 października 2026 · 4 auta w planie boksów · 2 do odbioru
          </p>
        </div>
        <div className="flex shrink-0 gap-2.5">
          <Button
            variant="secondary"
            className="h-10 px-[18px] text-df-label"
            onClick={() =>
              showNotice(
                "Nowa wycena",
                "Tworzenie wycen będzie dostępne wkrótce.",
              )
            }
          >
            Nowa wycena
          </Button>
          <Button
            variant="secondary"
            className="h-10 px-[18px] text-df-label"
            onClick={() =>
              showNotice(
                "Wystaw fakturę",
                "Fakturę wystawisz po zakończeniu zlecenia. Wybór zakończonego zlecenia i tworzenie faktur będą dostępne wkrótce.",
              )
            }
          >
            Wystaw fakturę
          </Button>
          <Button
            className="h-10 px-[18px] text-df-label"
            onClick={() =>
              showNotice(
                "Nowe zlecenie",
                "Przyjmowanie nowych zleceń będzie dostępne wkrótce.",
              )
            }
          >
            + Nowe zlecenie
          </Button>
        </div>
      </div>
      <Kpis />
      <div className="grid grid-cols-[minmax(0,2.016fr)_minmax(300px,1fr)] items-start gap-6">
        <div className="flex min-w-0 flex-col gap-6">
          <Schedule />
          <OrdersToday orders={todayOrders} onOpenOrder={openOrder} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <section
            aria-labelledby="featured-title"
            className="flex flex-col gap-3 rounded-xl bg-df-panel p-5 pb-3.5"
          >
            <div className="flex h-7 items-center justify-between">
              <h2 id="featured-title" className="text-df-section">
                Na warsztacie
              </h2>
              <button
                aria-label="Opcje Porsche Panamera"
                className="rounded px-1 text-df-muted hover:bg-df-raised"
                onClick={() => openOrder(todayOrders[0]!)}
              >
                •••
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- Original editorial photo from Figma D-01. */}
            <img
              src="/pulpit/porsche.png"
              alt="Czarne Porsche Panamera na drodze"
              width={338}
              height={155}
              className="h-[155px] w-full rounded-lg object-cover"
            />
            <div className="h-11">
              <h3 className="text-df-section">Porsche Panamera</h3>
              <p className="mt-0.5 text-df-label text-df-muted">
                #DF-0248 · Adam Nowak · Boks 01
              </p>
            </div>
            <div className="flex h-[52px] shrink-0 flex-col gap-2 text-df-label">
              <div className="flex h-5 shrink-0 justify-between gap-2">
                <span>Korekta lakieru</span>
                <span className="text-df-lime">Etap 2 z 4</span>
              </div>
              <div
                role="progressbar"
                aria-label="Postęp zlecenia Porsche Panamera"
                aria-valuemin={0}
                aria-valuemax={4}
                aria-valuenow={2}
                aria-valuetext="Etap 2 z 4 — Korekta lakieru"
                className="h-1 shrink-0 overflow-hidden rounded-sm bg-df-raised"
              >
                <div className="h-full w-1/2 bg-df-lime" />
              </div>
              <p className="text-df-muted">Planowany odbiór: jutro, 16:00</p>
            </div>
            <div className="flex gap-2.5">
              <Button
                variant="secondary"
                className="h-[38px] min-w-0 flex-1 px-2 text-df-label"
                onClick={() => openOrder(todayOrders[0]!)}
              >
                Szczegóły zlecenia
              </Button>
              <Button
                variant="secondary"
                className="h-[38px] min-w-0 flex-1 px-2 text-df-label"
                onClick={() =>
                  showNotice(
                    "Link dla klienta",
                    "Portal klienta będzie dostępny wkrótce.",
                  )
                }
              >
                Link dla klienta ↗
              </Button>
            </div>
          </section>
          <section
            aria-labelledby="attention-title"
            className="flex flex-col gap-3.5 rounded-xl bg-df-panel p-5"
          >
            <div className="flex h-7 items-center justify-between">
              <h2 id="attention-title" className="text-df-section">
                Wymaga uwagi
              </h2>
              <span className="text-df-label text-df-muted">3</span>
            </div>
            <div className="min-h-[57px]">
              <h3 className="text-df-strong text-df-amber">
                <span aria-hidden="true">●</span> Niski stan: CarPro CQuartz
              </h3>
              <p className="mt-1 text-df-label text-df-muted">
                Pozostało 50 ml · minimum 100 ml
              </p>
            </div>
            <div className="h-px bg-df-line" />
            <div className="min-h-[57px]">
              <h3 className="text-df-strong">
                <span aria-hidden="true" className="text-df-blue">
                  ●
                </span>{" "}
                Serwis ceramiki · 3 klientów
              </h3>
              <p className="mt-1 text-df-label text-df-muted">
                Zbliża się termin konserwacji.{" "}
                <Link href="/customers" className="hover:text-df-text">
                  Zobacz ↗
                </Link>
              </p>
            </div>
            <div className="h-px bg-df-line" />
            <Link href="/invoices?filter=attention" className="group">
              <h3 className="text-df-strong">
                <span aria-hidden="true" className="text-df-error">
                  ●
                </span>{" "}
                Faktura odrzucona przez KSeF
              </h3>
              <p className="mt-1 text-df-label text-df-muted">
                FV/39/10/2026 · nieprawidłowy NIP.{" "}
                <span className="text-df-error group-hover:underline">
                  Napraw ↗
                </span>
              </p>
            </Link>
          </section>
        </div>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="dashboard-dialog-title"
        aria-describedby="dashboard-dialog-description"
        className="fixed inset-0 m-auto w-[440px] max-w-[calc(100%-32px)] rounded-xl border border-df-line bg-df-panel p-6 text-df-text backdrop:bg-black/60"
      >
        <h2 id="dashboard-dialog-title" className="text-df-section">
          {notice.title}
        </h2>
        <p
          id="dashboard-dialog-description"
          className="mt-3 text-df-body text-df-muted"
        >
          {notice.description}
        </p>
        <form method="dialog" className="mt-5 flex justify-end">
          <Button type="submit" variant="secondary">
            Zamknij
          </Button>
        </form>
      </dialog>
    </div>
  );
}
