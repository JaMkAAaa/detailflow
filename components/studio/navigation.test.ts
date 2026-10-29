import { expect, it } from "vitest";
import { activeStudioItem, studioNavigation } from "./navigation";

it("opens the service catalog from the studio menu", () => {
  expect(studioNavigation.find((item) => item.label === "Usługi i cennik")?.href).toBe("/services");
  expect(activeStudioItem("/services")?.href).toBe("/services");
});
