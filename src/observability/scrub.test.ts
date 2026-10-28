import { expect, it } from "vitest";
import { redactString, sanitizeError, scrubSentryEvent } from "./scrub";

const token = "super-secret-ksef-token";

it("keeps studioId and strips a KSeF token from a Sentry event", () => {
  const encrypted = "test:v1:AAAAAAAAAAAAAAAA:BBBBBBBBBBBBBBBB:CCCCCCCCCCCCCCCC";
  const event = {
    tags: { studioId: "stu_obsidian", service: "worker" },
    extra: { studioId: "stu_obsidian", ksefToken: token, note: `token=${token}` },
    request: {
      headers: { Authorization: `Bearer ${token}`, cookie: "session=abc", "x-request-id": "req_1" },
      url: `postgresql://detailflow:${token}@postgres:5432/detailflow`,
    },
    exception: { values: [{ type: "Error", value: `KSeF authenticate failed token=${token} ${encrypted}` }] },
    contexts: { job: { studioId: "stu_obsidian", token } },
  };
  scrubSentryEvent(event);
  const payload = JSON.stringify(event);
  expect(event.tags.studioId).toBe("stu_obsidian");
  expect(event.extra.studioId).toBe("stu_obsidian");
  expect(event.contexts.job.studioId).toBe("stu_obsidian");
  expect(event.request.headers["x-request-id"]).toBe("req_1");
  expect(payload).not.toContain(token);
  expect(payload).not.toContain(encrypted);
  expect(event.extra.ksefToken).toBe("[redacted]");
  expect(event.request.headers.Authorization).toBe("[redacted]");
  expect(redactString(`studioId=stu_obsidian token=${token}`)).toBe("studioId=stu_obsidian [redacted]");
});

it("drops the token from an error without copying secret fields", () => {
  const error = new Error(`authenticate failed token=${token}`);
  error.stack = `${error.stack}\ntoken=${token}`;
  Object.assign(error, { ksefToken: token, studioId: "stu_obsidian" });
  const safe = sanitizeError(error);
  const payload = JSON.stringify({ name: safe.name, message: safe.message, stack: safe.stack });
  expect(payload).not.toContain(token);
  expect(safe.message).toContain("[redacted]");
  expect("ksefToken" in safe).toBe(false);
});
