import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
});

import { platformDb } from "@/lib/db/client";
import { beginEnrollment, confirmEnrollment, mfaAccess, verifyStepUp } from "./mfa";
import { demotionBlocked } from "./operator-policy";
import { changeOperatorRole, setFeatureFlag } from "./operators";
import { base32Decode, totpCode } from "./totp";

const tag = randomUUID();
const at = new Date("2026-10-28T12:00:30.000Z");
let ownerId = "";
let supportId = "";
let ownerOperator = "";
let supportOperator = "";
let ownerCode = "";
let backup = "";

beforeAll(async () => {
  const owner = await platformDb.user.create({ data: { name: `${tag} owner`, email: `${tag}-owner@example.com` } });
  const support = await platformDb.user.create({ data: { name: `${tag} support`, email: `${tag}-support@example.com` } });
  ownerId = owner.id;
  supportId = support.id;
  ownerOperator = (await platformDb.platformOperator.create({ data: { userId: ownerId, role: "owner" } })).id;
  supportOperator = (await platformDb.platformOperator.create({ data: { userId: supportId, role: "support" } })).id;
});

afterAll(async () => {
  await platformDb.platformMfaStepUp.deleteMany({ where: { operatorId: { in: [ownerOperator, supportOperator] } } });
  await platformDb.auditLog.deleteMany({ where: { actorId: { in: [ownerId, supportId] } } });
  await platformDb.user.deleteMany({ where: { id: { in: [ownerId, supportId] } } });
});

describe("MFA administracji", () => {
  it("nie odbiera roli ostatniemu właścicielowi", () => {
    expect(demotionBlocked("owner", "support", 1)).toBe(true);
    expect(demotionBlocked("owner", "admin", 2)).toBe(false);
    expect(demotionBlocked("admin", "support", 1)).toBe(false);
  });

  it("bez kodu nie zmienia roli ani flagi, a po TOTP wpuszcza tylko tę sesję", async () => {
    await expect(changeOperatorRole(
      { userId: ownerId, role: "owner", sessionId: `${tag}-none` },
      supportId,
      "admin",
    )).rejects.toThrow(/MFA/);

    const pending = await beginEnrollment(ownerId);
    ownerCode = totpCode(base32Decode(pending.secret), at);
    const enrolled = await confirmEnrollment(ownerId, `${tag}-session`, ownerCode, at);
    backup = enrolled.backupCodes[0]!;
    expect(enrolled.backupCodes).toHaveLength(8);
    expect((await mfaAccess(`${tag}-session`, ownerId, at)).state).toBe("ready");
    expect((await mfaAccess(`${tag}-other`, ownerId, at)).state).toBe("challenge");
    await expect(verifyStepUp(ownerId, `${tag}-replay`, ownerCode, at)).rejects.toThrow(/Nieprawidłowy kod/);
    await verifyStepUp(ownerId, `${tag}-backup`, backup, at);
    await expect(verifyStepUp(ownerId, `${tag}-backup-2`, backup, at)).rejects.toThrow(/Nieprawidłowy kod/);
  });

  it("wsparcie z MFA nie zmienia ról, a flaga PROD nie przełącza środowiska faktur", async () => {
    const supportPending = await beginEnrollment(supportId);
    await confirmEnrollment(supportId, `${tag}-support`, totpCode(base32Decode(supportPending.secret), at), at);
    await expect(changeOperatorRole(
      { userId: supportId, role: "support", sessionId: `${tag}-support` },
      ownerId,
      "admin",
    )).rejects.toThrow(/właściciel/);

    const studio = await platformDb.studio.create({
      data: { name: tag, slug: `${tag}-flag`, publicCode: `${tag}-flag`, ksefEnv: "test" },
    });
    await setFeatureFlag({ userId: ownerId, role: "owner", sessionId: `${tag}-session` }, "ksef_prod", true);
    expect(await platformDb.studio.findUnique({ where: { id: studio.id }, select: { ksefEnv: true } })).toMatchObject({ ksefEnv: "test" });
    await setFeatureFlag({ userId: ownerId, role: "owner", sessionId: `${tag}-session` }, "ksef_prod", false);
    await platformDb.studio.delete({ where: { id: studio.id } });

    await changeOperatorRole({ userId: ownerId, role: "owner", sessionId: `${tag}-session` }, supportId, "admin");
    expect(await platformDb.platformOperator.findUnique({ where: { userId: supportId }, select: { role: true } })).toMatchObject({ role: "admin" });
    const owners = await platformDb.platformOperator.count({ where: { role: "owner" } });
    if (owners === 1) {
      await expect(changeOperatorRole(
        { userId: ownerId, role: "owner", sessionId: `${tag}-session` },
        ownerId,
        "support",
      )).rejects.toThrow(/właściciel/);
    }
  });
});
