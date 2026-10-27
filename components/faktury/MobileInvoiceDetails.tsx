import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileHeader } from "@/components/studio/MobileHeader";
import { MaskIcon } from "@/components/studio/MaskIcon";
import { date, envLabel, money, totals, type InvoiceView } from "./model";
import { EnvironmentBanner } from "./shared";

export function MobileInvoiceDetails({
  invoice,
  label,
  seconds,
  copy,
  upo,
  xml,
  pdf,
  paid,
  correction,
  resend,
  more,
}: {
  invoice: InvoiceView;
  label: string;
  seconds: number | null;
  copy: () => void;
  upo: () => void;
  xml: () => void;
  pdf: () => void;
  paid: () => void;
  correction: () => void;
  resend: () => void;
  more: () => void;
}) {
  const isPaid = !!invoice.paidAt;
  const isCorrection = invoice.kind === "correction";
  return (
    <div className="space-y-4 pb-8 leading-[normal] print:hidden">
      <MobileHeader
        title={invoice.number}
        subtitle={`${invoice.buyer.name} · #${invoice.orderNumber}`}
        back="/invoices"
        centered
        action={
          <button
            type="button"
            aria-label="Więcej akcji faktury"
            onClick={more}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-df-panel"
          >
            <MaskIcon name="more" size={20} />
          </button>
        }
      />
      <EnvironmentBanner env={invoice.env} compact />
      <section className="flex flex-col items-center gap-2 rounded-[18px] bg-df-panel px-4 py-[22px]">
        <p className="text-[13px] text-df-muted">
          {isPaid ? "Opłacona" : "Do zapłaty"}
        </p>
        <p className="text-[34px] font-bold">{money(invoice.totalGross)}</p>
        <p className="text-[12px] text-df-muted">
          netto {money(invoice.totalNet)} · VAT {money(invoice.totalVat)}
        </p>
        <Badge
          variant={
            invoice.ksefStatus === "accepted"
              ? "accepted-test"
              : invoice.ksefStatus === "rejected"
                ? "rejected"
                : "processing"
          }
        >
          {label}
        </Badge>
      </section>
      <section className="space-y-2.5 rounded-[18px] bg-df-panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">KSeF</h2>
          <strong className="text-[11px] text-df-amber">
            {envLabel(invoice.env)}
          </strong>
        </div>
        <div className="rounded-[10px] bg-df-lime-dark px-3 py-2.5">
          <p className="text-[11px] text-df-muted">Numer KSeF</p>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-df-lime">
            <p
              className="min-w-0 flex-1 truncate"
              title={invoice.ksefNumber ?? undefined}
            >
              {invoice.ksefNumber ?? "Oczekiwanie na numer"}
            </p>
            <button
              type="button"
              disabled={!invoice.ksefNumber}
              onClick={copy}
              className="min-h-8 disabled:opacity-40"
            >
              Kopiuj
            </button>
          </div>
        </div>
        <dl className="space-y-2 text-[13px]">
          {[
            [label, date(invoice.acceptedAt, true)],
            ["Czas do przyjęcia", seconds === null ? "—" : `${seconds} s`],
            [
              "Płatność",
              `przelew do ${date(invoice.dueAt)} · ${isPaid ? "opłacona" : "nieopłacona"}`,
            ],
          ].map(([key, value]) => (
            <div key={key} className="flex justify-between gap-3">
              <dt className="text-df-muted">{key}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "UPO", action: upo },
            { label: "XML", action: xml },
            { label: "PDF", action: pdf },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className="flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] bg-df-raised text-[13px] font-semibold"
            >
              <span
                aria-hidden="true"
                className="size-4 bg-current"
                style={{
                  mask: "url(/mobile-sales/download.svg) center / contain no-repeat",
                }}
              />
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-2.5 rounded-[18px] bg-df-panel p-4">
        <h2 className="text-[16px] font-semibold">Pozycje</h2>
        {totals(invoice.items).lines.map((item, index) => (
          <div key={index} className="flex justify-between gap-3 text-[14px]">
            <span>{item.name}</span>
            <strong className="shrink-0 font-semibold">
              {money(item.gross)}
            </strong>
          </div>
        ))}
        <p className="break-words text-[11px] text-df-muted">
          {invoice.emailedAt
            ? `PDF wysłano ${date(invoice.emailedAt, true)}`
            : "PDF nie został wysłany"}
          <br />
          {invoice.buyer.email}
        </p>
        <button type="button" onClick={resend} className="min-h-11 text-[13px]">
          ↗ {invoice.emailedAt ? "Wyślij ponownie" : "Wyślij PDF"}
        </button>
      </section>
      <footer className="fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t border-df-line bg-df-side px-4 pt-3 pb-[max(30px,env(safe-area-inset-bottom))]">
        <Button
          disabled={isPaid || isCorrection}
          onClick={paid}
          className="min-w-0 flex-1 gap-2 px-2 text-[12px]"
        >
          <span
            aria-hidden="true"
            className="size-[18px] shrink-0 bg-current"
            style={{
              mask: "url(/mobile-sales/paid.svg) center / contain no-repeat",
            }}
          />
          {isPaid ? "Opłacona" : "Oznacz jako opłaconą"}
        </Button>
        <Button variant="secondary" disabled={isCorrection} onClick={correction}>
          Korekta
        </Button>
      </footer>
    </div>
  );
}
