import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Rozpocznij trial — Detailflow" };

export default async function StartPage() {
  if (await getSession()) redirect("/");
  return <SignupForm />;
}
