"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ClientPrivacyActions({ studioId, clientId }: { studioId: string; clientId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(action: "export" | "erase") {
    if (action === "erase" && !window.confirm("Usunąć dane klienta i zdjęcia? Historia zleceń zostanie zanonimizowana, a dokumenty księgowe zachowane. Tej operacji nie można cofnąć.")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/studios/${studioId}/clients/${clientId}/privacy`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Nie udało się wykonać operacji. Spróbuj ponownie.");
      }
      if (action === "export") {
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = url; link.download = "client-data.json"; link.click();
        URL.revokeObjectURL(url);
        setMessage("Pobrano dane klienta.");
      } else {
        const { outcome } = await response.json();
        if (outcome === "deleted") router.push("/customers");
        else setMessage("Dane klienta zanonimizowane. Dokumenty księgowe zachowane.");
        router.refresh();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Nie udało się wykonać operacji."); }
    finally { setBusy(false); }
  }
  return <section className="flex flex-col items-start gap-3">
    <h2 className="text-df-strong">Dane osobowe</h2>
    <p className="text-df-body text-df-muted">Eksport danych klienta lub usunięcie danych kontaktowych i zdjęć. Faktury i zaakceptowane protokoły pozostają w historii.</p>
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" disabled={busy} onClick={() => run("export")}>Eksportuj dane JSON</Button>
      <Button variant="secondary" disabled={busy} onClick={() => run("erase")}>Usuń dane osobowe</Button>
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}
