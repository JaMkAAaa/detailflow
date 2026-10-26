import localFont from "next/font/local";

// Pliki z google/fonts (OFL w ./fonts), bez pobierania fontów podczas buildu.

// UI: Inter (Body 13, Label 12, Strong 14, Section 17, Headline 30).
export const inter = localFont({
  src: "./fonts/Inter.ttf",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--df-font-sans",
});

// Wordmark i nagłówki marki: Space Grotesk Bold.
export const spaceGrotesk = localFont({
  src: "./fonts/SpaceGrotesk.ttf",
  weight: "300 700",
  style: "normal",
  display: "swap",
  variable: "--df-font-brand",
});
