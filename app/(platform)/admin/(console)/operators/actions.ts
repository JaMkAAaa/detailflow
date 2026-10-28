"use server";

import { revalidatePath } from "next/cache";
import type { PlatformRole } from "@/lib/db/generated/client";
import { requirePlatform } from "@/src/server/admin/context";
import { assertActionOrigin } from "@/src/server/action-origin";
import { formFailure, type FormState } from "@/src/server/admin/errors";
import { beginEnrollment, confirmEnrollment, verifyStepUp } from "@/src/server/admin/mfa";
import { changeOperatorRole, setFeatureFlag } from "@/src/server/admin/operators";
import { PLATFORM_ROLES } from "@/src/server/admin/operator-policy";

function refresh() {
  revalidatePath("/admin/operators");
}

export async function beginMfaAction(_prev: FormState, _form: FormData): Promise<FormState & { secret?: string; otpauthUrl?: string }> {
  await assertActionOrigin();
  const { user } = await requirePlatform();
  try {
    const enrollment = await beginEnrollment(user.id);
    return { message: "Dodaj klucz do aplikacji TOTP i wpisz kod.", tone: "ok", ...enrollment };
  } catch (error) {
    return formFailure(error);
  }
}

export async function confirmMfaAction(_prev: FormState, form: FormData): Promise<FormState & { backupCodes?: string[] }> {
  await assertActionOrigin();
  const { user, sessionId } = await requirePlatform();
  try {
    const result = await confirmEnrollment(user.id, sessionId, String(form.get("code") ?? ""));
    return { message: "MFA włączone. Zapisz kody zapasowe, a potem otwórz administrację.", tone: "ok", backupCodes: result.backupCodes };
  } catch (error) {
    return formFailure(error);
  }
}

export async function challengeMfaAction(_prev: FormState, form: FormData): Promise<FormState> {
  await assertActionOrigin();
  const { user, sessionId } = await requirePlatform();
  try {
    await verifyStepUp(user.id, sessionId, String(form.get("code") ?? ""));
  } catch (error) {
    return formFailure(error);
  }
  refresh();
  return { message: "MFA potwierdzone.", tone: "ok" };
}

export async function changeRoleAction(_prev: FormState, form: FormData): Promise<FormState> {
  await assertActionOrigin();
  const actor = await requirePlatform();
  const role = PLATFORM_ROLES.find((item) => item === form.get("role"));
  if (!role) return { message: "Nieznana rola.", tone: "error" };
  try {
    await changeOperatorRole(
      { userId: actor.user.id, role: actor.role, sessionId: actor.sessionId },
      String(form.get("userId") ?? ""),
      role as PlatformRole,
    );
  } catch (error) {
    return formFailure(error);
  }
  refresh();
  return { message: "Rola zapisana.", tone: "ok" };
}

export async function setFlagAction(_prev: FormState, form: FormData): Promise<FormState> {
  await assertActionOrigin();
  const actor = await requirePlatform();
  try {
    await setFeatureFlag(
      { userId: actor.user.id, role: actor.role, sessionId: actor.sessionId },
      String(form.get("key") ?? ""),
      form.get("enabled") === "1",
    );
  } catch (error) {
    return formFailure(error);
  }
  refresh();
  return { message: "Flaga zapisana. PROD wymaga tej flagi, środowiska studia i osobnego tokenu. Token TEST nie przejdzie.", tone: "ok" };
}
