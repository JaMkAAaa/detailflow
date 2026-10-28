import * as Sentry from "@sentry/node";
import { afterEach, expect, it } from "vitest";
import { scrubSentryEvent } from "./scrub";
import { captureWorkerError, reportControlledWorkerError } from "./sentry";

afterEach(async () => {
  await Sentry.close(0);
});

it("sends a controlled worker error to Sentry with studioId and without the KSeF token", async () => {
  const token = "super-secret-ksef-token";
  const events: unknown[] = [];
  Sentry.initWithoutDefaultIntegrations({
    dsn: "https://public@o0.ingest.sentry.io/0",
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    includeLocalVariables: false,
    beforeSend(event) {
      events.push(structuredClone(scrubSentryEvent(event)));
      return null;
    },
  });
  const error = new Error(`KSeF authenticate failed token=${token}`);
  Object.assign(error, { ksefToken: token });
  await captureWorkerError(error, { studioId: "stu_obsidian", queue: "ksef-test" });
  await reportControlledWorkerError("stu_obsidian");
  expect(events.length).toBeGreaterThanOrEqual(2);
  for (const event of events) {
    const payload = JSON.stringify(event);
    expect(payload).toContain("stu_obsidian");
    expect(payload).not.toContain(token);
  }
  const controlled = events.map(event => JSON.stringify(event)).find(payload => payload.includes("ControlledWorkerError"));
  expect(controlled).toContain("controlled worker failure");
});
