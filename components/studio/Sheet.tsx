"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Dolny sheet mobilny na natywnym `<dialog>`: focus trap, Esc i warstwa top-layer
 * dostarcza przeglądarka. Klik w tło zamyka sheet.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      className="df-sheet fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none rounded-t-[24px] border-t border-df-line bg-df-panel p-0 text-df-text backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-df-line" />
        <h2 id={titleId} className="text-df-section">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
