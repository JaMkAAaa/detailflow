// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import PortalPage from "../../app/p/[token]/page";

afterEach(cleanup);

it("opens the public demo with exactly three stages and the studio phone", async () => {
  render(await PortalPage({ params: Promise.resolve({ token: "obsidian-df-0248-demo" }) }));
  expect(screen.getByRole("heading", { name: "Cześć, Adam." })).toBeTruthy();
  const stages = within(screen.getByRole("list", { name: "Etapy zlecenia" })).getAllByRole("listitem");
  expect(stages).toHaveLength(3);
  expect(stages[1]!.getAttribute("aria-current")).toBe("step");
  expect(stages[2]!.textContent).toContain("Ceramika i kontrola");
  expect(screen.getByRole("region", { name: "Wycena" }).textContent).toContain("4 800 zł");
  expect(screen.getAllByRole("link", { name: "Zadzwoń do studia" }).every((link) => link.getAttribute("href") === "tel:+48500100200")).toBe(true);
  expect(screen.queryByRole("navigation")).toBeNull();
});

it("renders the expired demo as a calm state with working contact links", async () => {
  render(await PortalPage({ params: Promise.resolve({ token: "obsidian-df-0244-expired" }) }));
  expect(screen.getByRole("heading", { name: "Ten link już wygasł" })).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Poproś o nowy link" }).every((link) => link.getAttribute("href")?.startsWith("mailto:obsidian@example.com?subject="))).toBe(true);
  expect(screen.queryByText(/Porsche|WA 911PC|DF-0248/)).toBeNull();
});

it.each(["unknown-token", "", "obsidian-df-0248-demo-extra"])("handles unknown token %s without revealing demo data", async (token) => {
  render(await PortalPage({ params: Promise.resolve({ token }) }));
  expect(screen.getByRole("heading", { name: "Ten link już wygasł" })).toBeTruthy();
  expect(screen.getByText(/Skontaktuj się ze studiem/)).toBeTruthy();
  expect(screen.queryByText(/OBSIDIAN|Porsche|Adam|4 800/)).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
});
