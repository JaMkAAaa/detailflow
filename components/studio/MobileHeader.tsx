import Link from "next/link";
import type { ReactNode } from "react";
import { MaskIcon } from "./MaskIcon";

export function MobileHeader({
  title,
  subtitle,
  back,
  action,
  centered = false,
  backIcon = "back",
}: {
  title: string;
  subtitle?: string;
  back: string;
  action?: ReactNode;
  centered?: boolean;
  backIcon?: string;
}) {
  return (
    <header className="flex min-h-12 items-center gap-3">
      <Link
        href={back}
        aria-label="Wstecz"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-df-panel"
      >
        <MaskIcon name={backIcon} size={20} />
      </Link>
      <div className={`min-w-0 flex-1 ${centered ? "text-center" : ""}`}>
        {!centered && subtitle && (
          <p className="text-[13px] text-df-muted">{subtitle}</p>
        )}
        <h1
          className={
            centered
              ? "break-words text-[17px] font-semibold"
              : "text-[26px] font-bold"
          }
        >
          {title}
        </h1>
        {centered && subtitle && (
          <p className="text-[12px] text-df-muted">{subtitle}</p>
        )}
      </div>
      {action ?? (centered && <span className="size-11 shrink-0" />)}
    </header>
  );
}
