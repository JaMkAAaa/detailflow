import { expect, it } from "vitest";
import { activeStudioItem, studioNavigation } from "./navigation";

it("opens the service catalog from the studio menu", () => {
  expect(studioNavigation.find((item) => item.label === "Usługi i cennik")?.href).toBe("/services");
  expect(activeStudioItem("/services")?.href).toBe("/services");
});

it("opens owner statistics from the studio menu instead of a 'Wkrótce' item", () => {
  expect(studioNavigation.find((item) => item.label === "Statystyki")?.href).toBe("/statistics");
  expect(activeStudioItem("/statistics")?.href).toBe("/statistics");
});

it("opens the studio portfolio from the menu", () => {
  expect(studioNavigation.find((item) => item.label === "Portfolio")?.href).toBe("/portfolio");
  expect(activeStudioItem("/portfolio")?.href).toBe("/portfolio");
});
