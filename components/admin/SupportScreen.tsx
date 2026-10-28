"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { idleForm, type FormState } from "@/src/server/admin/errors";
import type { getSupportQueue } from "@/src/server/admin/support";

type Queue = Awaited<ReturnType<typeof getSupportQueue>>;
type Action = (state: FormState, form: FormData) => Promise<FormState>;

const when = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const SLA_CLASS = { ok: "text-df-green", breached: "text-df-error", done: "text-df-muted" } as const;

function Message({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p role={state.tone === "error" ? "alert" : "status"} className={state.tone === "error" ? "text-df-label text-df-error" : "text-df-label text-df-muted"}>
      {state.message}
    </p>
  );
}

function ReplyForm({ publicCode, action }: { publicCode: string; action: Action }) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const [body, setBody] = useState("");
  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="ticket" value={publicCode} />
      <label className="text-df-label text-df-muted">
        Odpowiedź
        <textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="mt-1 min-h-24 w-full rounded-lg bg-df-raised px-3 py-2 text-df-body text-df-text"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={body.trim().length === 0} loading={pending} loadingLabel="Wysyłanie…">
          Wyślij odpowiedź
        </Button>
        <Message state={state} />
      </div>
    </form>
  );
}

function OpenForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [studio, setStudio] = useState("");
  const ready = subject.trim().length >= 3 && body.trim().length > 0 && studio.trim().length > 0;
  return (
    <form action={formAction} className="mt-4 grid gap-3">
      <label className="text-df-label text-df-muted">
        Kod studia
        <input name="publicCode" value={studio} onChange={(event) => setStudio(event.target.value)} className="mt-1 h-10 w-full rounded-lg bg-df-raised px-3 text-df-body text-df-text" />
      </label>
      <label className="text-df-label text-df-muted">
        Temat
        <input name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1 h-10 w-full rounded-lg bg-df-raised px-3 text-df-body text-df-text" />
      </label>
      <label className="text-df-label text-df-muted">
        Priorytet
        <select name="priority" defaultValue="normal" className="mt-1 h-10 w-full rounded-lg bg-df-raised px-3 text-df-body text-df-text">
          <option value="normal">Zwykły · 8 godz.</option>
          <option value="urgent">Pilny · 1 godz.</option>
        </select>
      </label>
      <label className="text-df-label text-df-muted">
        Opis
        <textarea name="body" value={body} onChange={(event) => setBody(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg bg-df-raised px-3 py-2 text-df-body text-df-text" />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={!ready} loading={pending} loadingLabel="Zapisywanie…">
          Otwórz zgłoszenie
        </Button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function SupportScreen({
  data,
  replyAction,
  openAction,
  resolveAction,
}: {
  data: Queue;
  replyAction: Action;
  openAction: Action;
  resolveAction: Action;
}) {
  const selected = data.selected;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-df-headline">Wsparcie</h1>
        <p className="mt-1 text-df-body text-df-muted">Kolejka zgłoszeń i SLA. Pilne: 1 godzina, zwykłe: 8 godzin.</p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.3fr)]">
        <section aria-labelledby="queue-heading" className="rounded-xl bg-df-panel p-5">
          <h2 id="queue-heading" className="text-df-section">Kolejka</h2>
          {data.tickets.length === 0 ? (
            <p className="mt-3 text-df-body text-df-muted">Brak zgłoszeń.</p>
          ) : (
            <ul className="mt-3 divide-y divide-df-line">
              {data.tickets.map((ticket) => (
                <li key={ticket.publicCode}>
                  <Link href={`/admin/support?ticket=${ticket.publicCode}`} className="block py-3 hover:text-df-lime" aria-current={selected?.publicCode === ticket.publicCode ? "page" : undefined}>
                    <span className="block font-medium">{ticket.subject}</span>
                    <span className="mt-1 block text-df-label text-df-muted">
                      {ticket.publicCode} · {ticket.studioName} · {ticket.statusLabel} · {ticket.priorityLabel}
                    </span>
                    <span className={`mt-1 block text-df-label ${SLA_CLASS[ticket.sla]}`}>
                      {ticket.sla === "done" ? "SLA zamknięte" : ticket.remaining}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <details className="mt-4">
            <summary className="cursor-pointer text-df-label text-df-muted">Nowe zgłoszenie</summary>
            <OpenForm action={openAction} />
          </details>
        </section>
        <section aria-labelledby="thread-heading" className="rounded-xl bg-df-panel p-5">
          {selected ? (
            <>
              <h2 id="thread-heading" className="text-df-section">{selected.subject}</h2>
              <p className={`mt-1 text-df-label ${SLA_CLASS[selected.sla]}`}>
                {selected.publicCode} · {selected.statusLabel} · {selected.sla === "done" ? "zamknięte" : selected.remaining}
              </p>
              <article className="mt-4 rounded-lg bg-df-raised p-4">
                <h3 className="text-df-label text-df-muted">Konto</h3>
                <p className="mt-1 text-df-body">
                  <Link href={`/admin/studios/${selected.studio.publicCode}`} className="hover:text-df-lime">{selected.studio.name}</Link>
                  {" · "}{selected.studio.publicCode} · {selected.studio.statusLabel} · {selected.studio.planName}
                </p>
                <p className="mt-1 text-df-label text-df-muted">
                  {[selected.studio.city, selected.studio.phone].filter(Boolean).join(" · ") || "Brak telefonu i miasta"}
                </p>
              </article>
              <ol className="mt-4 flex flex-col gap-3">
                {selected.messages.map((message) => (
                  <li key={message.id} className="rounded-lg border border-df-line px-3 py-2">
                    <p className="text-df-label text-df-muted">
                      {message.fromStudio ? "Studio" : "Wsparcie"} · <time dateTime={message.at}>{when.format(new Date(message.at))}</time>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-df-body">{message.body}</p>
                  </li>
                ))}
              </ol>
              {selected.status === "resolved" ? null : (
                <>
                  <ReplyForm publicCode={selected.publicCode} action={replyAction} />
                  <ResolveForm publicCode={selected.publicCode} action={resolveAction} />
                </>
              )}
            </>
          ) : (
            <>
              <h2 id="thread-heading" className="text-df-section">Wątek</h2>
              <p className="mt-3 text-df-body text-df-muted">Wybierz zgłoszenie z kolejki.</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ResolveForm({ publicCode, action }: { publicCode: string; action: Action }) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  return (
    <form action={formAction} className="mt-3 flex items-center gap-3">
      <input type="hidden" name="ticket" value={publicCode} />
      <Button type="submit" variant="secondary" loading={pending} loadingLabel="Zamykanie…">
        Zamknij zgłoszenie
      </Button>
      <Message state={state} />
    </form>
  );
}
