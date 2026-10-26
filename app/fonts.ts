import { Inter, Space_Grotesk } from "next/font/google";

// UI: Inter (Body 13, Label 12, Strong 14, Section 17, Headline 30).
export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--df-font-sans",
});

// Wordmark i nagłówki marki: Space Grotesk Bold.
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700"],
  display: "swap",
  variable: "--df-font-brand",
});
