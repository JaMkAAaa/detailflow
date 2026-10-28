import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap px-2.5 text-df-label",
  {
    variants: {
      variant: {
        "in-progress": "h-7 gap-1 rounded-md bg-df-lime-dark text-df-lime",
        accepted: "h-7 gap-1 rounded-md bg-df-raised text-df-muted",
        scheduled: "h-7 gap-1 rounded-md bg-df-blue-dark text-df-blue",
        "ready-for-pickup": "h-7 gap-1 rounded-md bg-df-blue-dark text-df-blue",
        "accepted-test": "gap-1.5 rounded-[20px] bg-df-success-surface py-[5px] font-semibold leading-[normal] text-df-green",
        rejected: "gap-1.5 rounded-[20px] bg-df-error-surface py-[5px] font-semibold leading-[normal] text-df-error",
        draft: "h-7 gap-1 rounded-md bg-df-amber-dark text-df-amber",
        processing: "gap-1.5 rounded-[20px] bg-df-processing-surface py-[5px] font-semibold leading-[normal] text-df-blue",
        retrying: "gap-1.5 rounded-[20px] bg-df-retry-surface py-[5px] font-semibold leading-[normal] text-df-retry",
        retry: "gap-1.5 rounded-[20px] bg-df-retry-surface py-[5px] font-semibold leading-[normal] text-df-retry",
        completed: "h-7 gap-1 rounded-md bg-df-success-surface text-df-green",
        test: "h-7 gap-1 rounded-md bg-df-success-surface text-df-green",
        prod: "h-7 gap-1 rounded-md bg-df-amber-dark font-semibold text-df-amber",
        overdue: "h-7 gap-1 rounded-md bg-df-amber-dark text-df-amber",
        error: "h-7 gap-1 rounded-md bg-df-error-surface text-df-error",
      },
    },
    defaultVariants: { variant: "in-progress" },
  },
);

const badgeLabels = {
  "in-progress": "W trakcie",
  accepted: "Przyjęte",
  scheduled: "Zaplanowane",
  "ready-for-pickup": "Do odbioru",
  "accepted-test": "Przyjęta (test)",
  rejected: "Odrzucona",
  draft: "Szkic",
  processing: "Przetwarzanie",
  retrying: "↻ Ponawiamy",
  retry: "Ponawiamy",
  completed: "Zakończone",
  test: "TEST",
  prod: "PROD",
  overdue: "Zaległość",
  error: "Błąd",
} as const;

const badgeDots: Partial<Record<keyof typeof badgeLabels, string>> = {
  "accepted-test": "/ui/status-success.svg",
  rejected: "/ui/status-error.svg",
  processing: "/ui/status-processing.svg",
  retrying: "/ui/status-retry.svg",
  retry: "/ui/status-retry.svg",
};

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant = "in-progress", children, ...props }: BadgeProps) {
  const status = variant ?? "in-progress";
  const dot = badgeDots[status];

  return (
    <span {...props} data-slot="badge" className={cn(badgeVariants({ variant: status, className }))}>
      {dot && (
        // Figma assets are decorative and retain their original 6 × 6 geometry.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dot} width={6} height={6} alt="" aria-hidden="true" className="shrink-0" />
      )}
      {children ?? badgeLabels[status]}
    </span>
  );
}

export { Badge, badgeVariants, type BadgeProps };
