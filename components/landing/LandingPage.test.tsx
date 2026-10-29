// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

afterEach(cleanup);

it("sends every sign-up CTA to /start", () => {
  render(<LandingPage />);
  const ctas = screen.getAllByRole("link", { name: /Zacznij 14 dni za darmo/ });
  expect(ctas.length).toBeGreaterThanOrEqual(6);
  for (const cta of ctas) expect(cta.getAttribute("href")).toBe("/start");
});

it("shows only monthly net prices 79 / 149 / 279 and no yearly toggle", () => {
  render(<LandingPage />);
  const pricing = within(document.getElementById("pricing")!);
  for (const price of ["79 zł", "149 zł", "279 zł"]) expect(pricing.getByText(price)).toBeTruthy();
  expect(screen.queryByText(/Rocznie/)).toBeNull();
  expect(screen.queryByRole("tab")).toBeNull();
  expect(screen.queryByRole("switch")).toBeNull();
});

it("has no fake social proof: ratings, stars, client logos or review counts", () => {
  const { container } = render(<LandingPage />);
  expect(container.textContent).not.toMatch(/★|⭐|\d[,.]\d\s*\/\s*5|zadowolonych|gwarancj|\+31%|124 realizacje/i);
  expect(screen.getAllByText("SCENARIUSZ DEMO")).toHaveLength(3);
});

it("labels the calculator as an estimate and updates it from the sliders", () => {
  render(<LandingPage />);
  const calc = within(document.getElementById("kalkulator")!);
  expect(calc.getByText(/estymacja, a nie pomiar wyników klientów/i)).toBeTruthy();
  expect(calc.getByText("23×")).toBeTruthy();
  fireEvent.change(calc.getByLabelText("Liczba boksów"), { target: { value: "5" } });
  expect(calc.getByText(/Koszt planu Pro/)).toBeTruthy();
  expect(calc.getByText("12×")).toBeTruthy();
});

it("marks out-of-v1 modules as coming soon", () => {
  render(<LandingPage />);
  expect(within(document.getElementById("funkcje")!).getAllByText("Wkrótce")).toHaveLength(1);
});

it("opens and closes the L-03 mobile menu", () => {
  render(<LandingPage />);
  const menu = document.getElementById("landing-menu")!;
  expect(menu.hidden).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
  expect(menu.hidden).toBe(false);
  expect(within(menu).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(
    expect.arrayContaining(["#funkcje", "#ksef", "#aplikacja", "#kalkulator", "#pricing", "#faq", "/start", "/login"]),
  );
  fireEvent.keyDown(document, { key: "Escape" });
  expect(menu.hidden).toBe(true);
});
