import { describe, expect, it } from "vitest";
import type { StudioStatus } from "@/lib/db/generated/client";
import {
  parseStudiosQuery,
  partitionByStatus,
  planNet,
  statusesForFilter,
  studiosToCsv,
  subscriptionNet,
  type StudioCsvRow,
} from "./accounts";

const ALL: StudioStatus[] = ["trial", "active", "past_due", "suspended", "canceled"];

describe("filtry kont A-02", () => {
  it("pokrywa każdy status dokładnie raz, a Wstrzymane obejmuje anulowane", () => {
    const sets = (["active", "trial", "past_due", "suspended"] as const).map(statusesForFilter);
    const flat = sets.flat();
    expect(new Set(flat).size).toBe(flat.length);
    expect(new Set(flat)).toEqual(new Set(ALL));
    expect(partitionByStatus(ALL.map((status) => ({ status })))).toEqual({
      all: 5,
      active: 1,
      trial: 1,
      past_due: 1,
      suspended: 2,
    });
  });

  it("liczy 166 = 128 + 24 + 6 + 8", () => {
    const rows = [
      ...Array.from({ length: 128 }, () => ({ status: "active" as const })),
      ...Array.from({ length: 24 }, () => ({ status: "trial" as const })),
      ...Array.from({ length: 6 }, () => ({ status: "past_due" as const })),
      ...Array.from({ length: 8 }, () => ({ status: "suspended" as const })),
    ];
    const counts = partitionByStatus(rows);
    expect(counts).toEqual({ all: 166, active: 128, trial: 24, past_due: 6, suspended: 8 });
    expect(counts.active + counts.trial + counts.past_due + counts.suspended).toBe(counts.all);
  });

  it("trial nie dostaje kwoty abonamentu; ceny planów są netto w groszach", () => {
    expect(planNet("solo")).toBe("79.00");
    expect(planNet("studio")).toBe("149.00");
    expect(planNet("pro")).toBe("279.00");
    expect(subscriptionNet("trial", "studio")).toBeNull();
    expect(subscriptionNet("past_due", "studio")).toBe("149.00");
  });

  it("śmieci w URL wracają do wartości domyślnych", () => {
    expect(parseStudiosQuery({ filter: "nope", page: "0", q: "  ab  " })).toEqual({ q: "ab", filter: "all", page: 1 });
    expect(parseStudiosQuery({ filter: "suspended", page: "3" })).toMatchObject({ filter: "suspended", page: 3 });
  });

  it("CSV ucieka formuły i używa średnika", () => {
    const row: StudioCsvRow = {
      publicCode: "ST-00001",
      name: '=HYPERLINK("http://evil")',
      status: "active",
      plan: "solo",
      city: "Kraków",
      ownerName: "A",
      ownerEmail: "a@example.com",
      phone: null,
      lastActivityAt: new Date("2026-10-24T09:30:00.000Z"),
      subscriptionNet: "79.00",
      stripeCustomerId: "cus_seed",
      stripeSubscriptionId: "sub_seed",
    };
    const csv = studiosToCsv([row]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"kod";"nazwa";"status";"plan"');
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain("cus_seed");
    expect(csv).toContain("79.00");
  });
});
