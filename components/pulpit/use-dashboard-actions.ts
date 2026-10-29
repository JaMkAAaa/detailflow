"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardMetrics } from "@/src/server/pulpit/metrics";

export type DashboardProps = { data: DashboardMetrics; name: string; studioId: string; canInvoice: boolean };
export function useDashboardActions(studioId: string) {
  const router = useRouter();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ title: string; description: string } | null>(null);
  async function act(orderId: string, action: "advance" | "portal-links") {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      const base = `/api/studios/${encodeURIComponent(studioId)}`;
      const response = await fetch(action === "advance" ? `${base}/orders/${encodeURIComponent(orderId)}/advance` : `${base}/portal-links`, {
        method: "POST",
        ...(action === "portal-links" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workOrderId: orderId }) } : {}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Nie udało się zapisać zmiany.");
      if (action === "portal-links") {
        if (typeof result.path !== "string" || !/^\/p\/[A-Za-z0-9_-]+$/.test(result.path)) throw new Error("Nieprawidłowa odpowiedź serwera.");
        setNotice({ title: "Link dla klienta — skopiuj teraz", description: new URL(result.path, window.location.origin).href });
      } else router.refresh();
    } catch (error) {
      setNotice({ title: "Nie udało się wykonać akcji", description: error instanceof Error ? error.message : "Spróbuj ponownie." });
    } finally { locked.current = false; setBusy(false); }
  }
  return { busy, notice, setNotice, act };
}
