"use client";

import { Button } from "@/components/ui/button";

export function OrderErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <section role="alert" className="flex flex-col items-start gap-3 rounded-xl bg-df-panel p-5"><p className="text-df-body text-df-error">{message}</p><Button variant="secondary" onClick={onRetry}>Spróbuj ponownie</Button></section>;
}
