import type { ReactNode } from "react";

type LegalSection = { title: string; content: ReactNode };

export function LegalDraftPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <main className="mx-auto max-w-4xl px-5 py-16 md:px-8 md:py-24">
      <p className="mb-8 rounded-xl border border-df-line bg-df-panel p-4 text-sm font-semibold text-df-text">
        Projekt do zatwierdzenia prawnego. To nie jest obowiązujący dokument.
      </p>
      <h1 className="mb-10 text-3xl font-bold text-df-text md:text-5xl">{title}</h1>
      <div className="flex flex-col gap-10 text-[15px] leading-7 text-df-muted">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-3 text-xl font-semibold text-df-text">{section.title}</h2>
            {section.content}
          </section>
        ))}
      </div>
    </main>
  );
}
