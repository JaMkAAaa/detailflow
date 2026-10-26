import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type EmptyStateProps = {
  title: string;
  description: ReactNode;
  /** Usually a secondary action followed by the primary action. */
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
  headingLevel?: 1 | 2 | 3;
};

/** S-01: content for an empty list; the owning screen supplies its panel/header. */
function EmptyState({
  title,
  description,
  actions,
  // Local decorative Figma SVG, preserving its original geometry.
  // eslint-disable-next-line @next/next/no-img-element
  icon = <img src="/states/calendar.svg" width={28} height={28} alt="" />,
  className,
  headingLevel = 2,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3";
  return (
    <section
      aria-label={title}
      data-slot="empty-state"
      className={cn("flex w-full min-w-0 flex-col items-center gap-3 px-4 py-7 text-center", className)}
    >
      <div aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-df-lime-dark text-df-lime">
        {icon}
      </div>
      <Heading className="text-df-section text-df-text [overflow-wrap:anywhere]">{title}</Heading>
      <div className="w-full max-w-[380px] text-df-body text-df-muted [overflow-wrap:anywhere]">{description}</div>
      {actions && <div className="flex max-w-full flex-wrap justify-center gap-2.5 pt-1.5">{actions}</div>}
    </section>
  );
}

export { EmptyState, type EmptyStateProps };
