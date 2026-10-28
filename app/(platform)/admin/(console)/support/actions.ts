"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatform } from "@/src/server/admin/context";
import { formFailure, type FormState } from "@/src/server/admin/errors";
import { openTicket, replyToTicket, resolveTicket } from "@/src/server/admin/support";

export async function replyToTicketAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePlatform();
  const ticket = String(form.get("ticket") ?? "");
  try {
    await replyToTicket(user.id, ticket, String(form.get("body") ?? ""));
  } catch (error) {
    return formFailure(error);
  }
  revalidatePath("/admin/support");
  return { message: "Odpowiedź zapisana.", tone: "ok" };
}

export async function openTicketAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePlatform();
  const priority = form.get("priority") === "urgent" ? "urgent" : "normal";
  let publicCode: string;
  try {
    const ticket = await openTicket(user.id, {
      publicCode: String(form.get("publicCode") ?? ""),
      subject: String(form.get("subject") ?? ""),
      body: String(form.get("body") ?? ""),
      priority,
    });
    publicCode = ticket.publicCode;
  } catch (error) {
    return formFailure(error);
  }
  revalidatePath("/admin/support");
  redirect(`/admin/support?ticket=${publicCode}`);
}

export async function resolveTicketAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePlatform();
  const ticket = String(form.get("ticket") ?? "");
  try {
    await resolveTicket(user.id, ticket);
  } catch (error) {
    return formFailure(error);
  }
  revalidatePath("/admin/support");
  return { message: "Zgłoszenie zamknięte.", tone: "ok" };
}
