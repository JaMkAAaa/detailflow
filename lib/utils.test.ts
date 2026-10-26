import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn — Detailflow typography", () => {
  it("preserves custom font sizes alongside text colors and allows size overrides", () => {
    expect(cn("text-df-label text-df-lime", false && "hidden")).toBe("text-df-label text-df-lime");
    expect(cn("text-df-label text-df-lime", "text-df-body text-df-blue")).toBe("text-df-body text-df-blue");
    expect(cn("text-df-label", "text-sm")).toBe("text-sm");
  });
});
