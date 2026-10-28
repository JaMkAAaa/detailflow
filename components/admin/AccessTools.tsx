"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { idleForm, type FormState } from "@/src/server/admin/errors";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

const when = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  hour: "2-digit",
  minute: "2-digit",
});

function Message({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p role={state.tone === "error" ? "alert" : "status"} className={state.tone === "error" ? "text-df-error" : "text-df-muted"}>
      {state.message}
    </p>
  );
}

export function SuspendForm({ publicCode, action }: { publicCode: string; action: Action }) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const ready = name.trim().length > 0 && reason.trim().length > 0;
  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="publicCode" value={publicCode} />
      <p className="text-df-body text-df-muted">
        Konto straci logowanie, jeśli to jedyne studio użytkownika. Zapis w aplikacji jest odcięty. Abonament Stripe nie jest tą akcją anulowany.
      </p>
      <label className="text-df-label text-df-muted">
        Powód
        <textarea
          name="reason"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 min-h-20 w-full rounded-lg bg-df-raised px-3 py-2 text-df-body text-df-text"
        />
      </label>
      <label className="text-df-label text-df-muted">
        Nazwa studia
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          className="mt-1 h-10 w-full rounded-lg bg-df-raised px-3 text-df-body text-df-text"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!ready} loading={pending} loadingLabel="Zawieszanie…">
          Zawieś konto
        </Button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function SupportSessionForm({ publicCode, action }: { publicCode: string; action: Action }) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const [reason, setReason] = useState("");
  const [ticket, setTicket] = useState("");
  const ready = reason.trim().length > 0 && ticket.trim().length > 0;
  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="publicCode" value={publicCode} />
      <p className="text-df-body text-df-muted">
        Podgląd tylko do odczytu przez 15 minut. Wpis trafia do audytu. Nie logujemy się jako właściciel studia i nie ma zapisu.
      </p>
      <label className="text-df-label text-df-muted">
        Powód
        <textarea
          name="reason"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 min-h-20 w-full rounded-lg bg-df-raised px-3 py-2 text-df-body text-df-text"
        />
      </label>
      <label className="text-df-label text-df-muted">
        Numer zgłoszenia
        <input
          name="ticket"
          value={ticket}
          onChange={(event) => setTicket(event.target.value)}
          autoComplete="off"
          className="mt-1 h-10 w-full rounded-lg bg-df-raised px-3 text-df-body text-df-text"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!ready} loading={pending} loadingLabel="Otwieranie…">
          Rozpocznij sesję
        </Button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function AccessTools({
  publicCode,
  supportSession,
  suspendAction,
  supportAction,
}: {
  publicCode: string;
  supportSession: { expiresAt: string; reason: string; ticketCode: string | null } | null;
  suspendAction: Action;
  supportAction: Action;
}) {
  const [which, setWhich] = useState<null | "support" | "suspend">(null);
  return (
    <section aria-labelledby="access-heading" className="rounded-xl bg-df-panel p-5 lg:col-span-2">
      <h2 id="access-heading" className="text-df-section">Narzędzia dostępu</h2>
      {supportSession ? (
        <p className="mt-3 text-df-body text-df-muted">
          Sesja wsparcia tylko do odczytu do {when.format(new Date(supportSession.expiresAt))}
          {supportSession.ticketCode ? ` · ${supportSession.ticketCode}` : ""}. {supportSession.reason}
        </p>
      ) : (
        <p className="mt-3 text-df-body text-df-muted">Brak aktywnej sesji wsparcia.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={() => setWhich(which === "support" ? null : "support")}>
          Sesja wsparcia
        </Button>
        <Button type="button" variant="secondary" onClick={() => setWhich(which === "suspend" ? null : "suspend")}>
          Zawieś konto
        </Button>
      </div>
      {which === "support" ? <SupportSessionForm publicCode={publicCode} action={supportAction} /> : null}
      {which === "suspend" ? <SuspendForm publicCode={publicCode} action={suspendAction} /> : null}
    </section>
  );
}
