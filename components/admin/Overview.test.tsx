// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Overview } from "./Overview";
import type { PlatformOverview } from "@/src/server/admin/metrics";

afterEach(cleanup);

const data: PlatformOverview = {
  dateLabel: "poniedziałek, 26 października 2026",
  studioTotal: 166,
  mrr: "16672.00",
  mrrDelta: "1752.00",
  growth: 0.117,
  paying: 128,
  trials: 24,
  activity: { active: 112, paying: 128, rate: 0.875 },
  series: [
    { label: "maj", mrr: "12000.00" },
    { label: "paz", mrr: "16672.00" },
  ],
  activation: { activated: 24, eligible: 40, rate: 0.6 },
  conversion: { paid: 9, completed: 30, rate: 0.3 },
  inbox: [
    { id: "1", href: "/admin/studios", title: "Studio Demo · zaległość", detail: "ST-D0001", tone: "error" },
  ],
};

it("pokazuje MRR, konwersję z zakończonych triali i kolejkę do reakcji", () => {
  render(<Overview data={data} />);
  expect(screen.getByRole("heading", { name: "Przegląd platformy" })).toBeTruthy();
  expect(screen.getByText("16 672 zł")).toBeTruthy();
  expect(screen.getByText("128")).toBeTruthy();
  expect(screen.getByText("24")).toBeTruthy();
  expect(screen.getByText("87,5%")).toBeTruthy();
  expect(screen.getByText("9 / 30 zakończonych triali, nie bieżących")).toBeTruthy();
  expect(screen.getByText("24 / 40 · ≥ 3 zlecenia w 7 dniach od rejestracji")).toBeTruthy();
  expect(screen.getByText("Studio Demo · zaległość")).toBeTruthy();
});
