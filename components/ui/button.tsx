import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-df-body font-medium disabled:cursor-not-allowed disabled:not-data-loading:opacity-40 data-loading:font-normal",
  {
    variants: {
      variant: {
        primary: "bg-df-lime text-df-bg enabled:hover:bg-df-green",
        secondary: "bg-df-raised text-df-text enabled:hover:bg-df-hover",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Set for the entire pending operation; disables native click and submit. */
    loading?: boolean;
    loadingLabel?: string;
  };

function Button({
  className,
  variant,
  type = "button",
  disabled,
  loading = false,
  loadingLabel = "Ładowanie…",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      data-slot="button"
      data-loading={loading ? "" : undefined}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, className }))}
    >
      {loading ? (
        <span>
          <span aria-hidden="true">◌</span>{" "}{loadingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export { Button, buttonVariants, type ButtonProps };
