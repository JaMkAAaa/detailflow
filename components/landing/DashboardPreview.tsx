import Image from "next/image";
import { formatPln, todayOrders } from "@/components/pulpit/demo";
import { LogoMark } from "@/components/brand/Logo";

/**
 * Statyczny podgląd pulpitu D-01 (Figma: Linked preview / Preview / Pulpit).
 * Dane z `components/pulpit/demo.ts` (Obsidian Studio, #DF-0248) — nie pochodzą z żadnego
 * prawdziwego studia. To kopia ekranu aplikacji: zmiany D-01 trzeba przenieść tutaj ręcznie.
 */

const statusStyle = {
  "in-progress": { label: "W trakcie", className: "bg-df-lime-dark text-df-lime" },
  "ready-for-pickup": { label: "Do odbioru", className: "bg-df-blue-dark text-df-blue" },
  scheduled: { label: "Zaplanowane", className: "bg-df-blue-dark text-df-blue" },
} as const;

const kpis = [
  { label: "Przychód w październiku", value: "28 450 zł", note: "↗ 18,6% vs wrzesień", tone: "text-df-lime" },
  { label: "Aktywne zlecenia", value: "7", note: "3 w trakcie · 2 do odbioru · 2 przyjęte", tone: "text-df-muted" },
  { label: "Obłożenie boksów", value: "82%", note: "13 h z 16 h dostępnych", tone: "text-df-blue" },
  { label: "Powracający klienci", value: "64%", note: "↗ 8 p.p. w tym miesiącu", tone: "text-df-lime" },
] as const;

const nav = ["Pulpit", "Kalendarz", "Zlecenia", "Faktury", "Klienci i auta", "Usługi i cennik", "Magazyn", "Statystyki", "Portfolio"];

/** Pełny podgląd 1080×960, tylko od xl (poniżej pokazujemy telefon). */
export function DashboardPreview() {
  return (
    <div aria-hidden="true" inert className="pointer-events-none relative mx-auto h-[600px] w-[1100px] overflow-hidden select-none">
      <div className="absolute inset-x-0 top-0 rounded-t-[22px] border border-df-lime/25 bg-[#1c1f21] p-[10px] pb-0 shadow-[0_-10px_80px_rgba(212,245,107,0.18)]">
        <div className="flex h-[960px] overflow-hidden rounded-[16px] bg-df-bg text-[9px]">
          <div className="flex w-[165px] shrink-0 flex-col gap-2 bg-df-side p-3">
            <div className="flex h-[45px] items-center gap-2 px-2">
              <LogoMark size={24} />
              <span className="font-brand text-[15px] font-bold tracking-[-0.55px] text-df-text">detailflow</span>
            </div>
            <div className="rounded-[10px] bg-df-raised p-2.5 font-medium">
              <p className="text-df-text">OBSIDIAN STUDIO</p>
              <p className="text-df-muted">Warszawa, Mokotów</p>
            </div>
            <p className="mt-1.5 text-[9px] tracking-[0.08em] text-df-muted/55">TWOJE STUDIO</p>
            {nav.map((item, index) => (
              <div
                key={item}
                className={`flex h-[31px] items-center rounded-lg pl-[10px] text-[9.75px] ${
                  index === 0 ? "border-l-[1.5px] border-df-lime bg-df-raised text-df-text" : "text-df-muted"
                }`}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-[18px] p-[21px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[22px] font-semibold text-df-text">Dzień dobry, Michał.</p>
                <p className="text-[9.75px] text-df-muted">Sobota, 24 października 2026 · 4 auta w planie boksów · 2 do odbioru</p>
              </div>
              <span className="rounded-lg bg-df-lime px-3.5 py-2 font-medium text-df-bg">+ Nowe zlecenie</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="h-[99px] rounded-xl bg-df-panel p-3 font-medium">
                  <p className="text-df-muted">{kpi.label}</p>
                  <p className="text-[22px] text-df-text">{kpi.value}</p>
                  <p className={kpi.tone}>{kpi.note}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-[18px]">
              <div className="flex-1 rounded-xl bg-df-panel p-[15px]">
                <p className="mb-3 text-[12.75px] font-semibold text-df-text">Zlecenia na dziś</p>
                <div className="flex flex-col gap-3">
                  {todayOrders.map((order) => {
                    const status = statusStyle[order.status];
                    return (
                      <div key={order.number} className="flex items-center">
                        <div className="w-[170px]">
                          <p className="text-[10.5px] font-semibold text-df-text">{order.vehicle}</p>
                          <p className="font-medium text-df-muted">
                            {order.customer} · {order.plate}
                          </p>
                        </div>
                        <p className="w-[130px] text-[9.75px] text-df-muted">{order.service}</p>
                        <span className={`w-fit rounded-md px-2 py-1 font-medium ${status.className}`}>{status.label}</span>
                        <p className="ml-auto text-[10.5px] font-semibold text-df-text">{formatPln(order.grossPln)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex w-[283px] flex-col gap-4 rounded-xl bg-df-panel p-[15px]">
                <p className="text-[12.75px] font-semibold text-df-text">Na warsztacie</p>
                <Image src="/orders/porsche-panamera.jpg" alt="" width={500} height={333} className="h-[116px] w-full rounded-lg object-cover" />
                <div>
                  <p className="text-[12.75px] font-semibold text-df-text">Porsche Panamera</p>
                  <p className="font-medium text-df-muted">#DF-0248 · Adam Nowak · Boks 01</p>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-df-text">Korekta lakieru</span>
                  <span className="text-df-lime">Etap 2 z 4</span>
                </div>
                <div className="h-[3px] rounded-sm bg-df-raised">
                  <div className="h-full w-1/2 bg-df-lime" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 top-[330px] h-[270px] bg-gradient-to-b from-transparent to-[#0a0b0d]" />
      <div className="absolute top-[250px] right-[20px] rounded-[14px] border border-df-lime/35 bg-[#26292b] px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
        <p className="text-[13px] font-semibold text-df-lime">✓ Przyjęta (test)</p>
        <p className="text-[15px] font-bold text-df-text">FV/41/10/2026 · 60 s</p>
      </div>
      <div className="absolute top-[350px] left-[20px] rounded-[14px] border border-df-lime/35 bg-[#26292b] px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
        <p className="text-[13px] font-semibold text-df-lime">Klient zaakceptował wycenę</p>
        <p className="text-[15px] font-bold text-df-text">4 800 zł · Porsche Panamera</p>
      </div>
    </div>
  );
}

/** L-02: telefon z pulpitem pracownika. */
export function PhonePreview() {
  return (
    <div aria-hidden="true" className="mx-auto w-[300px] rounded-[36px] border border-df-line bg-[#1c1f21] p-2.5 shadow-[0_-10px_80px_rgba(212,245,107,0.18)]">
      <div className="flex flex-col gap-3 rounded-[28px] bg-df-bg p-4">
        <div className="flex items-center gap-2">
          <LogoMark size={20} />
          <span className="text-[11px] font-medium text-df-text">OBSIDIAN STUDIO</span>
        </div>
        <div>
          <p className="text-[20px] font-semibold text-df-text">Dzień dobry, Michał.</p>
          <p className="text-[11px] text-df-muted">24 października · 4 auta w planie · 2 do odbioru</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {kpis.slice(0, 2).map((kpi) => (
            <div key={kpi.label} className="rounded-xl bg-df-panel p-2.5 text-[10px] font-medium">
              <p className="text-df-muted">{kpi.label}</p>
              <p className="text-[18px] text-df-text">{kpi.value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2.5 rounded-xl bg-df-panel p-3">
          <p className="text-[12px] font-semibold text-df-text">Zlecenia na dziś</p>
          {todayOrders.slice(0, 3).map((order) => {
            const status = statusStyle[order.status];
            return (
              <div key={order.number} className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold text-df-text">{order.vehicle}</p>
                  <p className="text-[10px] text-df-muted">{order.service}</p>
                </div>
                <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${status.className}`}>{status.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
