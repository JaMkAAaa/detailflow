import type { Metadata } from "next";
import type { ReactNode } from "react";

import { inter, spaceGrotesk } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Detailflow",
  description: "Zlecenia, wyceny i faktury KSeF dla studiów detailingowych.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
