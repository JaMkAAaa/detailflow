import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      data-slot="input"
      type={type}
      className={cn(
        "flex h-[41px] w-full min-w-0 rounded-[10px] border border-df-line bg-df-bg px-3.5 py-[11px] text-sm text-df-text placeholder:text-df-muted disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-df-error file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-df-text",
        className,
      )}
    />
  );
}

export { Input };
