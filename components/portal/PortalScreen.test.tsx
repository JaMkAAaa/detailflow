// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PortalExpired, PortalStatus, type PortalOrder, type PortalPhoto, type PortalProtocol } from "./PortalScreen";

afterEach(cleanup);
const studio = { name: "Studio Test", phone: "+48500600700", address: "Testowa 5" };
const order: PortalOrder = {
  number: "DF-1234", customerName: "Anna Nowak", vehicle: { make: "Volvo", model: "V60", plate: "WA TEST" },
  status: "in_progress", stage: 2, pickupAt: new Date("2026-10-30T15:00:00Z"),
  totalGross: "1234.56", service: "Korekta + ceramika", updatedAt: new Date("2026-10-29T10:30:00Z"),
};
it("shows the supplied order, Warsaw pickup date, exact gross and studio phone", () => {
  render(<PortalStatus studio={studio} order={order} />);
  expect(screen.getByRole("heading", { name: "Cześć, Anna." })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Volvo V60" })).toBeTruthy();
  expect(screen.getByText(/WA TEST · Zlecenie #DF-1234/)).toBeTruthy();
  const stages = within(screen.getByRole("list", { name: "Etapy zlecenia" })).getAllByRole("listitem");
  expect(stages).toHaveLength(3);
  expect(stages[1]!.getAttribute("aria-current")).toBe("step");
  expect(screen.getByRole("region", { name: "Kwota brutto" }).textContent).toContain("1234,56 zł");
  expect(screen.getByRole("region", { name: "Planowany odbiór" }).textContent).toContain("30 października 2026 16:00");
  expect(screen.getAllByRole("link").every(link => link.getAttribute("href") === `tel:${studio.phone}`)).toBe(true);
  expect(screen.queryByText(/Porsche|Adam|4 800|Rzemieślnicza/)).toBeNull();
});
it("maps studio stage four to the third portal step", () => {
  render(<PortalStatus studio={studio} order={{ ...order, stage: 4 }} />);
  const stages = within(screen.getByRole("list", { name: "Etapy zlecenia" })).getAllByRole("listitem");
  expect(stages).toHaveLength(3);
  expect(stages[2]!.textContent).toContain("Ceramika i kontrola");
  expect(stages[2]!.getAttribute("aria-current")).toBe("step");
});
it.each(["ready_for_pickup", "completed", "accepted", "canceled"] as const)("does not show an active step for %s", status => {
  render(<PortalStatus studio={{ ...studio, phone: null }} order={{ ...order, status }} />);
  expect(screen.getAllByRole("listitem").every(item => !item.hasAttribute("aria-current"))).toBe(true);
  expect(screen.queryByRole("link")).toBeNull();
  if (status === "canceled") expect(screen.queryByRole("region", { name: "Planowany odbiór" })).toBeNull();
});
const photos: PortalPhoto[] = [{ no: 1, caption: "Maska", url: "/p/media/photoa?l=linka&e=1&s=sig" }];
const protocol: PortalProtocol = {
  number: "P-1234", acceptedAt: null,
  damages: [{ no: 1, title: "Rysa na masce", part: "Maska", size: "2 cm", x: 0.2, y: 0.3 }],
};
it("hides photos and protocol when the order has neither", () => {
  render(<PortalStatus studio={studio} order={order} />);
  expect(screen.queryByRole("region", { name: "Zdjęcia zlecenia" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Protokół przyjęcia" })).toBeNull();
  expect(screen.queryByText(/Nie znaleziono|pusty/)).toBeNull();
  expect(within(screen.getByRole("list", { name: "Etapy zlecenia" })).getAllByRole("listitem")).toHaveLength(3);
});
it("shows this order's photos and a one-step protocol acceptance without the portal token", () => {
  const token = "portal-token-secret";
  render(<PortalStatus studio={studio} order={order} photos={photos} protocol={protocol} protocolAction={`/p/${token}/protocol`} />);
  const img = screen.getByRole("img", { name: "Volvo V60 — Maska" });
  expect(img.getAttribute("src")).toBe(photos[0]!.url);
  expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(img.getAttribute("src")).not.toContain(token);
  expect(screen.getByRole("region", { name: "Protokół przyjęcia" }).textContent).toContain("Protokół #P-1234");
  expect(screen.getByText("Rysa na masce")).toBeTruthy();
  const form = screen.getByRole("button", { name: "Akceptuję stan auta" }).closest("form");
  expect(form?.getAttribute("action")).toBe(`/p/${token}/protocol`);
  expect(form?.getAttribute("method")).toBe("post");
  expect(form?.querySelector("button")?.getAttribute("type")).toBe("submit");
  expect(within(screen.getByRole("list", { name: "Etapy zlecenia" })).getAllByRole("listitem")).toHaveLength(3);
});
it("keeps an accepted protocol unchanged and hides the form", () => {
  render(<PortalStatus studio={studio} order={order} photos={photos} protocol={{ ...protocol, acceptedAt: new Date("2026-10-29T09:30:00Z") }} protocolAction="protocol" />);
  expect(screen.queryByRole("button", { name: "Akceptuję stan auta" })).toBeNull();
  expect(screen.getByText(/Stan zaakceptowany · 29 października 2026/)).toBeTruthy();
  expect(screen.getByText("Rysa na masce")).toBeTruthy();
});
it("renders an unavailable link without revealing studio or order data", () => {
  render(<PortalExpired />);
  expect(screen.getByRole("heading", { name: "Ten link już wygasł" })).toBeTruthy();
  expect(screen.getByText(/Skontaktuj się ze studiem/)).toBeTruthy();
  expect(screen.queryByText(/OBSIDIAN|Porsche|Adam|4 800/)).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
});
