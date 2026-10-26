import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";

type SkeletonProps = Pick<ComponentProps<"div">, "className" | "style">;

/** Decorative block. Compose inside a single labelled loading region. */
function Skeleton({ className, ...props }: SkeletonProps) {
  return <div {...props} aria-hidden="true" data-slot="skeleton" className={cn("h-4 rounded bg-df-raised motion-safe:animate-pulse motion-reduce:animate-none", className)} />;
}

type LoadingSkeletonProps = {
  className?: string;
  label?: string;
};

function SkeletonCard({ className, label, children }: LoadingSkeletonProps & { children: ReactNode }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className={cn("flex max-w-full min-w-0 flex-col gap-3 rounded-xl bg-df-panel p-4", className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function KpiSkeleton({ className, label = "Ładowanie wskaźników…" }: LoadingSkeletonProps) {
  return (
    <SkeletonCard label={label} className={cn("w-60", className)}>
      <Skeleton className="h-5 w-[120px] max-w-full" />
      <Skeleton /><Skeleton /><Skeleton />
    </SkeletonCard>
  );
}

function TableSkeleton({ className, label = "Ładowanie tabeli…" }: LoadingSkeletonProps) {
  return (
    <SkeletonCard label={label} className={cn("w-[380px]", className)}>
      <Skeleton className="h-5 w-[190px] max-w-full" />
      <Skeleton /><Skeleton /><Skeleton />
    </SkeletonCard>
  );
}

function CalendarSkeleton({ className, label = "Ładowanie kalendarza…" }: LoadingSkeletonProps) {
  return (
    <SkeletonCard label={label} className={cn("w-[360px]", className)}>
      <Skeleton className="h-5 w-[180px] max-w-full" />
      <Skeleton /><Skeleton /><Skeleton />
    </SkeletonCard>
  );
}

export { Skeleton, KpiSkeleton, TableSkeleton, CalendarSkeleton, type SkeletonProps, type LoadingSkeletonProps };
