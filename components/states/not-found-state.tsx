import Link from "next/link";
import { buttonVariants } from "../ui/button";
import { EmptyState, type EmptyStateProps } from "./empty-state";

type NotFoundStateProps = Pick<EmptyStateProps, "className" | "headingLevel"> & {
  href?: string;
  linkLabel?: string;
};

function NotFoundState({ href = "/", linkLabel = "Wróć na stronę główną", headingLevel = 1, ...props }: NotFoundStateProps) {
  return (
    <EmptyState
      {...props}
      headingLevel={headingLevel}
      title="Nie znaleziono strony"
      description="Ta strona nie istnieje lub została przeniesiona. Sprawdź adres albo wróć na stronę główną."
      icon={<span className="text-df-section">404</span>}
      actions={<Link href={href} className={buttonVariants({ className: "h-auto min-h-11 whitespace-normal py-2.5" })}>{linkLabel}</Link>}
    />
  );
}

export { NotFoundState, type NotFoundStateProps };
