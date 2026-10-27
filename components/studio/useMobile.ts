"use client";

import { useSyncExternalStore } from "react";

const query = "(max-width: 1023px)";
function subscribe(callback: () => void) {
  const media = window.matchMedia?.(query);
  media?.addEventListener("change", callback);
  return () => media?.removeEventListener("change", callback);
}
/** Same breakpoint as lg; server markup hydrates before selecting the compact view. */
export function useMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}
