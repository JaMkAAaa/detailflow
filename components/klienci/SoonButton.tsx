"use client";

import { useId, useRef, type ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

/** Akcja bez backendu: otwiera dialog „wkrótce” (jak na tablicy zleceń i w szczegółach zlecenia). */
export function SoonButton({
  title,
  description,
  className,
  variant,
  children,
}: {
  title: string;
  description: string;
  className?: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  return (
    <>
      <Button variant={variant} className={className} onClick={() => dialog.current?.showModal()}>
        {children}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        className="fixed inset-0 m-auto w-[440px] max-w-[calc(100%-32px)] rounded-xl border border-df-line bg-df-panel p-6 text-df-text backdrop:bg-black/60"
      >
        <h2 id={`${id}-title`} className="text-df-section">{title}</h2>
        <p id={`${id}-description`} className="mt-3 text-df-body text-df-muted">{description}</p>
        <form method="dialog" className="mt-5 flex justify-end">
          <button className={buttonVariants({ variant: "secondary" })}>Zamknij</button>
        </form>
      </dialog>
    </>
  );
}
