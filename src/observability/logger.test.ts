import { Writable } from "node:stream";
import { expect, it } from "vitest";
import { createLogger } from "./logger";

it("writes one JSON line and redacts the KSeF token", () => {
  let line = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      line += chunk.toString();
      callback();
    },
  });
  const token = "super-secret-ksef-token";
  const log = createLogger(stream);
  log.info({ studioId: "stu_obsidian", ksefToken: token, nested: { authorization: `Bearer ${token}` } }, `failed token=${token}`);
  const parsed = JSON.parse(line) as { level: string; studioId: string; ksefToken: string; message: string; nested: { authorization: string } };
  expect(parsed.level).toBe("info");
  expect(parsed.studioId).toBe("stu_obsidian");
  expect(parsed.ksefToken).toBe("[redacted]");
  expect(parsed.nested.authorization).toBe("[redacted]");
  expect(line).not.toContain(token);
});
