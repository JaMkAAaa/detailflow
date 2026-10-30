"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { idleForm, type FormState } from "@/src/server/admin/errors";
import { ROLE_LABEL, canManageFlags, canManageRoles } from "@/src/server/admin/operator-policy";
import type { Administration } from "@/src/server/admin/operators";
import type { PlatformRole } from "@/lib/db/generated/client";

type Action = (state: FormState, form: FormData) => Promise<FormState>;
type EnrollAction = (state: EnrollState, form: FormData) => Promise<EnrollState>;
type ConfirmAction = (state: ConfirmState, form: FormData) => Promise<ConfirmState>;

type EnrollState = FormState & { secret?: string; otpauthUrl?: string };
type ConfirmState = FormState & { backupCodes?: string[] };

const when = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function RoleForm({
  operator,
  action,
}: {
  operator: Administration["operators"][number];
  action: Action;
}) {
  const [state, formAction] = useActionState(action, idleForm);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={operator.userId} />
      <label className="sr-only" htmlFor={`role-${operator.userId}`}>Rola {operator.name}</label>
      <Select id={`role-${operator.userId}`} name="role" defaultValue={operator.role} className="w-auto" options={(Object.keys(ROLE_LABEL) as PlatformRole[]).map((role) => ({ value: role, label: ROLE_LABEL[role] }))} />
      <Button type="submit" variant="secondary">Zapisz</Button>
      <Message state={state} />
    </form>
  );
}

function FlagForm({
  flag,
  action,
}: {
  flag: Administration["flags"][number];
  action: Action;
}) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="key" value={flag.key} />
      <input type="hidden" name="enabled" value={flag.enabled ? "0" : "1"} />
      <Button type="submit" variant="secondary" loading={pending} loadingLabel="Zapisywanie…">
        {flag.enabled ? "Wyłącz" : "Włącz"}
      </Button>
      <Message state={state} />
    </form>
  );
}

function Message({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p role={state.tone === "error" ? "alert" : "status"} className={state.tone === "error" ? "text-df-label text-df-error" : "text-df-label text-df-muted"}>
      {state.message}
    </p>
  );
}

function EnrollPanel({ beginAction, confirmAction }: { beginAction: EnrollAction; confirmAction: ConfirmAction }) {
  const router = useRouter();
  const [begun, begin, beginning] = useActionState<EnrollState, FormData>(beginAction, idleForm);
  const [confirmed, confirm, confirming] = useActionState<ConfirmState, FormData>(confirmAction, idleForm);
  const [code, setCode] = useState("");
  return (
    <section aria-labelledby="mfa-heading" className="rounded-xl bg-df-panel p-5">
      <h2 id="mfa-heading" className="text-df-section">MFA</h2>
      <p className="mt-2 text-df-body text-df-muted">
        Administracja wymaga TOTP. Role, flagi i dziennik są dostępne po potwierdzeniu kodu.
      </p>
      <form action={begin} className="mt-4">
        <Button type="submit" variant="secondary" loading={beginning} loadingLabel="Generowanie…">
          Wygeneruj klucz
        </Button>
      </form>
      {begun.secret ? (
        <form action={confirm} className="mt-4 flex flex-col gap-3">
          <p className="break-all text-df-body">Klucz: {begun.secret}</p>
          <p className="break-all text-df-label text-df-muted">{begun.otpauthUrl}</p>
          <label className="text-df-label text-df-muted">
            Kod z aplikacji
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-1 h-10 w-40 rounded-lg bg-df-raised px-3 text-df-body text-df-text"
            />
          </label>
          <Button type="submit" disabled={!/^\d{6}$/.test(code.trim())} loading={confirming} loadingLabel="Sprawdzanie…">
            Potwierdź kod
          </Button>
        </form>
      ) : null}
      {confirmed.backupCodes ? (
        <div className="mt-4">
          <p className="text-df-body">Kody zapasowe. Pokazujemy je tylko teraz.</p>
          <ul className="mt-2 grid grid-cols-2 gap-2 text-df-body">
            {confirmed.backupCodes.map((backup) => <li key={backup} className="font-mono">{backup}</li>)}
          </ul>
          <Button type="button" className="mt-3" onClick={() => router.refresh()}>Otwórz administrację</Button>
        </div>
      ) : null}
      <Message state={begun} />
      <Message state={confirmed} />
    </section>
  );
}

function ChallengePanel({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const [code, setCode] = useState("");
  return (
    <section aria-labelledby="mfa-heading" className="rounded-xl bg-df-panel p-5">
      <h2 id="mfa-heading" className="text-df-section">MFA</h2>
      <p className="mt-2 text-df-body text-df-muted">Wpisz kod TOTP albo kod zapasowy, aby otworzyć administrację.</p>
      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <label className="text-df-label text-df-muted">
          Kod MFA
          <input
            name="code"
            aria-label="Kod MFA"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="mt-1 h-10 w-48 rounded-lg bg-df-raised px-3 text-df-body text-df-text"
          />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={code.trim().length < 6} loading={pending} loadingLabel="Sprawdzanie…">
            Potwierdź
          </Button>
          <Message state={state} />
        </div>
      </form>
    </section>
  );
}

export function OperatorsScreen({
  actorRole,
  access,
  administration,
  beginAction,
  confirmAction,
  challengeAction,
  roleAction,
  flagAction,
}: {
  actorRole: PlatformRole;
  access: "enroll" | "challenge" | "ready";
  administration: Administration | null;
  beginAction: EnrollAction;
  confirmAction: ConfirmAction;
  challengeAction: Action;
  roleAction: Action;
  flagAction: Action;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-df-headline">Administracja</h1>
        <p className="mt-1 text-df-body text-df-muted">Role operatorów, MFA, flagi i dziennik audytu.</p>
      </header>
      {access === "enroll" ? <EnrollPanel beginAction={beginAction} confirmAction={confirmAction} /> : null}
      {access === "challenge" ? <ChallengePanel action={challengeAction} /> : null}
      {access === "ready" && administration ? (
        <>
          <section aria-labelledby="roles-heading" className="rounded-xl bg-df-panel p-5">
            <h2 id="roles-heading" className="text-df-section">Role operatorów</h2>
            <ul className="mt-4 divide-y divide-df-line">
              {administration.operators.map((operator) => (
                <li key={operator.userId} className="flex flex-wrap items-end justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{operator.name}</p>
                    <p className="text-df-label text-df-muted">{operator.email} · MFA {operator.mfaEnabled ? "włączone" : "brak"}</p>
                  </div>
                  {canManageRoles(actorRole) ? (
                    <RoleForm operator={operator} action={roleAction} />
                  ) : (
                    <p className="text-df-body">{ROLE_LABEL[operator.role]}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="flags-heading" className="rounded-xl bg-df-panel p-5">
            <h2 id="flags-heading" className="text-df-section">Flagi</h2>
            <ul className="mt-4 divide-y divide-df-line">
              {administration.flags.map((flag) => (
                <li key={flag.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{flag.label}</p>
                    <p className="text-df-label text-df-muted">{flag.description}</p>
                  </div>
                  {canManageFlags(actorRole) ? (
                    <FlagForm flag={flag} action={flagAction} />
                  ) : (
                    <p className="text-df-label text-df-muted">{flag.enabled ? "Włączona" : "Wyłączona"}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="audit-heading" className="rounded-xl bg-df-panel p-5">
            <h2 id="audit-heading" className="text-df-section">Dziennik audytu</h2>
            {administration.audit.length === 0 ? (
              <p className="mt-3 text-df-body text-df-muted">Brak wpisów.</p>
            ) : (
              <ol className="mt-3 divide-y divide-df-line">
                {administration.audit.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                    <span className="text-df-body">
                      {row.label}
                      {row.detail ? <span className="text-df-muted"> · {row.detail}</span> : null}
                      <span className="text-df-muted"> · {row.actor}</span>
                      {row.studio !== "—" ? <span className="text-df-muted"> · {row.studio}</span> : null}
                    </span>
                    <time dateTime={row.at} className="text-df-label text-df-muted">{when.format(new Date(row.at))}</time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
