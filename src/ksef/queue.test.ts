import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getJob: vi.fn(), add: vi.fn(), state: vi.fn(), remove: vi.fn() }));
vi.mock("bullmq", () => ({ Queue: class { getJob = mocks.getJob; add = mocks.add; } }));
import { assertKsefRetryIdle, enqueueKsef } from "./queue";
const job = { studioId: "a", invoiceId: "invoice" };
beforeEach(() => {
  vi.stubEnv("KSEF_ENV", "test");
  mocks.getJob.mockReset(); mocks.add.mockReset(); mocks.remove.mockReset(); mocks.state.mockReset();
  mocks.getJob.mockResolvedValue({ getState: mocks.state, remove: mocks.remove });
});
it.each(["active", "waiting", "delayed", "unknown"])("refuses snapshot mutation for a %s job", async state => {
  mocks.state.mockResolvedValue(state);
  await expect(assertKsefRetryIdle(job)).rejects.toMatchObject({ status: 409 });
  expect(mocks.remove).not.toHaveBeenCalled();
});
it.each(["failed", "completed"])("revives a %s job instead of silently reusing its terminal ID", async state => {
  mocks.state.mockResolvedValue(state);
  await assertKsefRetryIdle(job);
  await enqueueKsef(job);
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  expect(mocks.add).toHaveBeenCalledWith("send", job, expect.any(Object));
});
it("allows a retry when Redis has no previous job", async () => {
  mocks.getJob.mockResolvedValue(undefined);
  await assertKsefRetryIdle(job);
  await enqueueKsef(job);
  expect(mocks.add).toHaveBeenCalledTimes(1);
});
