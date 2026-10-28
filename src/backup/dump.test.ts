import { expect, it } from "vitest";
import { pgDumpArgs } from "./dump";

it("puts the database password in the environment, not in pg_dump arguments", () => {
  const spec = pgDumpArgs("postgresql://detailflow:s%40cret@postgres:5432/detailflow");
  expect(spec.args).toContain("--format=custom");
  expect(spec.args).toContain("postgres");
  expect(spec.args).toContain("detailflow");
  expect(spec.args.join(" ")).not.toContain("s@cret");
  expect(spec.args.join(" ")).not.toContain("s%40cret");
  expect(spec.env.PGPASSWORD).toBe("s@cret");
});
