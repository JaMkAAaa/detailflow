import type { Metadata } from "next";
import { ResetRequestForm } from "@/components/auth/reset-request-form";

export const metadata: Metadata = { title: "Reset hasła — Detailflow" };

export default function ResetPasswordPage() {
  return <ResetRequestForm />;
}
