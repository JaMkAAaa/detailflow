import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { MobileHeader } from "@/components/studio/MobileHeader";
import { MaskIcon } from "@/components/studio/MaskIcon";
import { cn } from "@/lib/utils";
import { pln, preview, services, sizes, type Draft } from "./demo";

export function MobileQuoteStep({
  draft,
  client,
  vehicle,
  update,
  toggle,
  catalog,
  changeClient,
  next,
  options,
}: {
  draft: Draft;
  client: string;
  vehicle: string;
  update: (patch: Partial<Draft>) => void;
  toggle: (id: Draft["serviceIds"][number]) => void;
  catalog: () => void;
  changeClient: () => void;
  next: () => void;
  options: () => void;
}) {
  const price = preview(draft);
  return (
    <div className="space-y-4 pb-40 leading-[normal]">
      <MobileHeader
        title="Nowa wycena"
        subtitle="Krok 2 z 3"
        back="/"
        backIcon="close"
        centered
      />
      <nav aria-label="Kroki wyceny" className="flex gap-1.5">
        {[1, 2, 3].map((step) => (
          <button
            key={step}
            type="button"
            aria-label={`Krok ${step}`}
            aria-current={step === 2 ? "step" : undefined}
            onClick={step === 1 ? changeClient : step === 3 ? next : undefined}
            disabled={step === 3 && !price.selected.length}
            className="flex h-5 flex-1 items-center"
          >
            <span
              className={cn(
                "h-1 w-full rounded",
                step <= 2 ? "bg-df-lime" : "bg-df-line",
              )}
            />
          </button>
        ))}
      </nav>
      <section className="flex items-center gap-3 rounded-[18px] bg-df-panel px-4 py-3.5">
        {vehicle.startsWith("Porsche Panamera") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/mobile-sales/quote-car.png"
            width={48}
            height={48}
            alt=""
            className="size-12 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-df-raised">
            <span
              aria-hidden="true"
              className="size-6 bg-df-muted"
              style={{
                mask: "url(/studio/klienci.svg) center / contain no-repeat",
              }}
            />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{vehicle.split(" · ")[0]}</p>
          <p className="text-[12px] text-df-muted">
            {client}
            {vehicle.includes(" · ") && ` · ${vehicle.split(" · ")[1]}`}
          </p>
        </div>
        <button
          type="button"
          onClick={changeClient}
          className="min-h-11 text-[13px] font-semibold text-df-lime"
        >
          Zmień
        </button>
      </section>
      <fieldset>
        <legend className="mb-4 text-[13px] font-semibold text-df-muted">
          Wielkość auta
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {sizes.map((size) => (
            <label
              key={size.id}
              className={cn(
                "cursor-pointer rounded-[14px] border py-3 text-center",
                draft.size === size.id
                  ? "border-df-muted bg-df-line"
                  : "border-transparent bg-df-panel",
              )}
            >
              <input
                type="radio"
                name="mobile-size"
                className="peer sr-only"
                checked={draft.size === size.id}
                onChange={() => update({ size: size.id })}
              />
              <span className="block text-[15px] font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-df-lime">
                {size.label.split(" · ")[0]}
              </span>
              <span className="text-[12px] text-df-muted">
                ×{size.multiplier.replace(".", ",").replace(/0$/, "")}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <h2 className="text-[13px] font-semibold text-df-muted">Usługi</h2>
      <div className="rounded-[18px] bg-df-panel px-4 py-1">
        {services
          .filter(
            (service, index) =>
              index < 3 || draft.serviceIds.includes(service.id),
          )
          .map((service) => {
            const selected = draft.serviceIds.includes(service.id);
            const item =
              price.selected.find((item) => item.id === service.id) ?? service;
            return (
              <label
                key={service.id}
                className="flex min-h-[62px] cursor-pointer items-center gap-3 border-b border-df-line py-3 last:border-0"
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggle(service.id)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-[7px] border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-df-lime",
                    selected
                      ? "border-df-lime bg-df-lime text-df-bg"
                      : "border-df-muted",
                  )}
                >
                  {selected && <MaskIcon name="check" size={14} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px]">{item.name}</span>
                  <span className="text-[12px] text-df-muted">
                    {service.id === "correction"
                      ? "2 etapy · "
                      : service.id === "ceramic"
                        ? "3 lata · "
                        : ""}
                    {service.hours} h
                  </span>
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-[14px] font-semibold",
                    !selected && "text-df-muted",
                  )}
                >
                  {!selected && "+ "}
                  {pln(new Decimal(item.price).times(price.multiplier))}
                </span>
              </label>
            );
          })}
      </div>
      <button
        type="button"
        onClick={catalog}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-df-line text-[14px] font-semibold text-df-muted"
      >
        <MaskIcon name="plus" size={16} />
        Dodaj z katalogu
      </button>
      <footer className="fixed inset-x-0 bottom-0 z-30 space-y-3 rounded-t-[22px] bg-df-side px-4 pt-3.5 pb-[max(30px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[12px] text-df-muted">
              Razem brutto · {price.hours.toString().replace(".", ",")} h pracy
            </p>
            <output
              aria-label="Kwota brutto"
              aria-live="polite"
              className="text-[26px] font-bold"
            >
              {pln(price.gross)}
            </output>
          </div>
          <button
            type="button"
            onClick={options}
            className="min-h-11 text-right text-[12px] font-semibold text-df-lime"
          >
            Więcej opcji: lakier i wnętrze
          </button>
        </div>
        <Button
          className="w-full"
          disabled={!price.selected.length}
          onClick={next}
        >
          Dalej: wybierz termin
        </Button>
      </footer>
    </div>
  );
}
