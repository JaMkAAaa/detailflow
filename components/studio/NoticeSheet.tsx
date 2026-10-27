"use client";

import { Sheet } from "./Sheet";

export type Notice = { title: string; description: string };

/** Sheet „dostępne wkrótce” dla akcji, których zapis należy do osobnego issue `type:implement`. */
export function NoticeSheet({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  return (
    <Sheet open={notice !== null} onClose={onClose} title={notice?.title ?? ""}>
      <p className="text-df-body text-df-muted">{notice?.description}</p>
      <button type="button" onClick={onClose} className="h-11 rounded-lg bg-df-raised text-df-body font-medium">
        Zamknij
      </button>
    </Sheet>
  );
}
