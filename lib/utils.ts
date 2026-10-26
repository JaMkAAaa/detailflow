import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Custom font sizes would otherwise be mistaken for text colors and dropped.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["df-label", "df-body", "df-strong", "df-section", "df-headline", "df-number", "df-wordmark"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
