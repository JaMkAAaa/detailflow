"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pl">
      <body>
        <main>
          <h1>Coś poszło nie tak</h1>
          <p>Odśwież stronę. Jeśli błąd wraca, daj znać obsłudze studia.</p>
        </main>
      </body>
    </html>
  );
}
