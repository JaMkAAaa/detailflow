import { describe, expect, it } from "vitest";
import { acceptedPercent, queueAgeMinutes, queueIncidents, splitKsefGroups, topErrorCategories } from "./ksef-health";

describe("mianowniki KSeF", () => {
  it("liczy 828/842 jako 98,3% i nie miesza PROD do TEST", () => {
    const split = splitKsefGroups([
      { env: "test", status: "accepted", count: 828 },
      { env: "test", status: "rejected", count: 9 },
      { env: "test", status: "queued", count: 4 },
      { env: "test", status: "retrying", count: 1 },
      { env: "test", status: "not_sent", count: 12 },
      { env: "production", status: "accepted", count: 4 },
      { env: "production", status: "rejected", count: 4 },
    ]);
    expect(split.test).toMatchObject({ accepted: 828, rejected: 9, pending: 5, total: 842, rateLabel: "98,3%" });
    expect(split.production).toMatchObject({ accepted: 4, rejected: 4, pending: 0, total: 8, rateLabel: "50,0%" });
    expect(split.test.total).not.toBe(split.test.accepted + split.production.accepted);
    expect(acceptedPercent(0, 0)).toBeNull();
  });

  it("zgłasza incydent osobno dla środowiska, które stoi ponad 15 min", () => {
    expect(queueAgeMinutes(null, new Date())).toBeNull();
    const now = new Date("2026-10-28T12:00:00.000Z");
    expect(queueAgeMinutes(new Date("2026-10-28T11:40:00.000Z"), now)).toBe(20);
    const incidents = queueIncidents({ test: 20, production: 3 });
    expect(incidents.map((item) => item.env)).toEqual(["test"]);
    expect(incidents[0]?.title).toContain("TEST");
    expect(topErrorCategories([{ message: "  NIP nabywcy  ", count: 2 }, { message: "timeout", count: 9 }])[0]).toEqual({ message: "timeout", count: 9 });
  });
});
