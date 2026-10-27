import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Wszystkie CTA landingu prowadzą do rejestracji trialu (14 dni, bez karty). */
export const START_HREF = "/start";

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-5 md:px-8 xl:px-0", className)} {...props} />;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-df-lime-dark px-3 py-1.5 text-df-label font-semibold text-df-lime">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-df-lime" />
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  id,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  id: string;
}) {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col items-center gap-4 text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="text-balance text-[32px] leading-[1.1] font-bold tracking-[-0.03em] text-df-text md:text-[48px]">
        {title}
      </h2>
      {lead && <p className="max-w-[640px] text-pretty text-[16px] leading-[1.6] text-df-muted md:text-[18px]">{lead}</p>}
    </div>
  );
}

const ctaBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] px-[26px] py-4 text-[16px] font-semibold transition-colors";

const ctaVariants = {
  primary: "bg-df-lime text-df-bg hover:bg-df-green",
  outline: "border border-df-line text-df-text hover:bg-df-raised",
  dark: "bg-df-bg text-df-lime hover:bg-df-side",
} as const;

export function CtaLink({
  variant = "primary",
  className,
  children = "Zacznij 14 dni za darmo →",
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { variant?: keyof typeof ctaVariants }) {
  return (
    <Link href={START_HREF} className={cn(ctaBase, ctaVariants[variant], className)} {...props}>
      {children}
    </Link>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={cn("size-4 shrink-0", className)} fill="none">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SoonBadge() {
  return (
    <span className="inline-flex h-6 w-fit items-center rounded-md bg-df-amber-dark px-2 text-df-label font-semibold text-df-amber">
      Wkrótce
    </span>
  );
}
