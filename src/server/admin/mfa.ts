import { randomBytes } from "node:crypto";
import { platformDb } from "@/lib/db/client";
import { PlatformError } from "./errors";
import {
  base32Encode,
  createBackupCodes,
  decryptMfaSecret,
  encryptMfaSecret,
  hashBackupCode,
  matchTotpStep,
  otpauthUrl,
} from "./totp";

export const MFA_STEP_UP_MS = 12 * 60 * 60 * 1000;

const MFA_REQUIRED = "Włącz MFA i potwierdź kod, aby otworzyć administrację.";

async function operatorOf(userId: string) {
  const operator = await platformDb.platformOperator.findUnique({
    where: { userId },
    include: { mfa: true, user: { select: { email: true } } },
  });
  if (!operator) throw new PlatformError("Brak operatora platformy.");
  return operator;
}

export async function mfaAccess(sessionId: string, userId: string, now = new Date()) {
  const operator = await operatorOf(userId);
  if (!operator.mfa?.enabledAt) return { state: "enroll" as const };
  const step = await platformDb.platformMfaStepUp.findUnique({ where: { sessionId } });
  if (!step || step.operatorId !== operator.id || step.expiresAt <= now) return { state: "challenge" as const };
  return { state: "ready" as const };
}

export async function assertMfaReady(sessionId: string, userId: string, now = new Date()) {
  const access = await mfaAccess(sessionId, userId, now);
  if (access.state !== "ready") throw new PlatformError(MFA_REQUIRED);
}

async function rememberStep(sessionId: string, operatorId: string, now: Date) {
  await platformDb.platformMfaStepUp.upsert({
    where: { sessionId },
    create: { sessionId, operatorId, expiresAt: new Date(now.getTime() + MFA_STEP_UP_MS) },
    update: { operatorId, expiresAt: new Date(now.getTime() + MFA_STEP_UP_MS) },
  });
}

export async function beginEnrollment(userId: string) {
  const operator = await operatorOf(userId);
  if (operator.mfa?.enabledAt) throw new PlatformError("MFA jest już włączone.");
  const secret = operator.mfa ? decryptMfaSecret(operator.id, operator.mfa.secretEnc) : randomBytes(20);
  if (!operator.mfa) {
    await platformDb.operatorMfa.create({
      data: { operatorId: operator.id, secretEnc: encryptMfaSecret(operator.id, secret) },
    });
  }
  const encoded = base32Encode(secret);
  return { secret: encoded, otpauthUrl: otpauthUrl(operator.user.email, encoded) };
}

export async function confirmEnrollment(userId: string, sessionId: string, code: string, now = new Date()) {
  const operator = await operatorOf(userId);
  if (!operator.mfa || operator.mfa.enabledAt) throw new PlatformError("Najpierw wygeneruj klucz MFA.");
  const step = matchTotpStep(decryptMfaSecret(operator.id, operator.mfa.secretEnc), code, now.getTime(), operator.mfa.lastAcceptedStep);
  if (step === null) throw new PlatformError("Nieprawidłowy kod.");
  const backupCodes = createBackupCodes();
  await platformDb.$transaction([
    platformDb.operatorMfa.update({
      where: { operatorId: operator.id },
      data: { enabledAt: now, lastAcceptedStep: step },
    }),
    platformDb.operatorMfaBackup.createMany({
      data: backupCodes.map((backup) => ({ operatorId: operator.id, codeHash: hashBackupCode(backup) })),
    }),
    platformDb.auditLog.create({
      data: { actorId: userId, action: "platform.mfa.enabled", meta: {} },
    }),
  ]);
  await rememberStep(sessionId, operator.id, now);
  return { backupCodes };
}

export async function verifyStepUp(userId: string, sessionId: string, code: string, now = new Date()) {
  const operator = await operatorOf(userId);
  if (!operator.mfa?.enabledAt) throw new PlatformError("Najpierw włącz MFA.");
  const step = matchTotpStep(decryptMfaSecret(operator.id, operator.mfa.secretEnc), code, now.getTime(), operator.mfa.lastAcceptedStep);
  if (step !== null) {
    await platformDb.operatorMfa.update({ where: { operatorId: operator.id }, data: { lastAcceptedStep: step } });
    await rememberStep(sessionId, operator.id, now);
    return;
  }
  const backup = await platformDb.operatorMfaBackup.findFirst({
    where: { operatorId: operator.id, codeHash: hashBackupCode(code), usedAt: null },
    select: { id: true },
  });
  if (!backup) throw new PlatformError("Nieprawidłowy kod.");
  await platformDb.operatorMfaBackup.update({ where: { id: backup.id }, data: { usedAt: now } });
  await rememberStep(sessionId, operator.id, now);
}
