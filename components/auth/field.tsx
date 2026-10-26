import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type FieldProps = ComponentProps<typeof Input> & { id: string; label: string };

export function Field({ id, label, ...props }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-df-label text-df-muted">{label}</label>
      <Input id={id} name={id} required {...props} />
    </div>
  );
}

export function FormMessage({ tone = "error", children }: { tone?: "error" | "info"; children: string }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={tone === "error" ? "text-df-body text-df-error" : "text-df-body text-df-muted"}>
      {children}
    </p>
  );
}
