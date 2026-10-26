import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button, type ButtonProps } from "../ui/button";

type NetworkErrorProps = {
  title?: string;
  description?: ReactNode;
  onRetry: NonNullable<ButtonProps["onClick"]>;
  retrying?: boolean;
  className?: string;
};

/** No automatic retry or persistence promises: those belong to the data layer. */
function NetworkError({
  title = "Nie udało się wczytać danych",
  description = "Brak połączenia z serwerem. Sprawdź połączenie z internetem i spróbuj ponownie.",
  onRetry,
  retrying = false,
  className,
}: NetworkErrorProps) {
  return (
    <div role="alert" className={cn("flex min-w-0 items-start gap-3.5 rounded-xl border border-df-error/40 bg-df-error-surface px-4 py-3.5", className)}>
      {/* Local decorative Figma SVG, preserving its original geometry. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/states/error.svg" width={22} height={22} alt="" className="shrink-0" />
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <h2 className="text-df-strong text-df-text">{title}</h2>
        <div className="mt-1 text-df-body text-df-muted">{description}</div>
        <Button
          variant="secondary"
          className="mt-1.5 h-auto min-h-11 whitespace-normal bg-transparent px-0 text-df-error enabled:hover:bg-transparent enabled:hover:underline"
          onClick={onRetry}
          loading={retrying}
          loadingLabel="Ponawianie…"
        >Spróbuj ponownie</Button>
      </div>
    </div>
  );
}

export { NetworkError, type NetworkErrorProps };
