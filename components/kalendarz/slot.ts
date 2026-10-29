"use client";

import { createContext } from "react";

/** Wolne okno wybrane w kalendarzu: boks i godziny lokalne (`YYYY-MM-DDTHH:mm`, Europe/Warsaw). */
export type ReservationSlot = { bayId: string; from: string; to: string; key: number };

/** Kalendarz podaje okno formularzowi w oknie dialogowym; `null` = „Nowa rezerwacja” bez okna. */
export const ReservationSlotContext = createContext<ReservationSlot | null>(null);
