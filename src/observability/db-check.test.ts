import { expect, it } from "vitest";
import { checkDatabase } from "./db-check";

it("reads the application database", async () => {
  await expect(checkDatabase()).resolves.toBeUndefined();
});
