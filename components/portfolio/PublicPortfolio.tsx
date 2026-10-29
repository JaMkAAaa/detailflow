export type PublicRealization = {
  id: string;
  make: string;
  model: string;
  service: string;
  src: string;
};

export function PublicPortfolio({
  studio,
  items,
}: {
  studio: { name: string; city: string | null };
  items: PublicRealization[];
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-4 py-10">
      <header>
        <p className="text-df-label text-df-muted">Realizacje</p>
        <h1 className="text-[28px] font-semibold">{studio.name}</h1>
        {studio.city && <p className="mt-1 text-df-muted">{studio.city}</p>}
      </header>
      {items.length === 0 ? (
        <p role="status" className="rounded-xl bg-df-panel p-5 text-df-muted">To studio nie opublikowało jeszcze realizacji.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-xl bg-df-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.src}
                alt={`${item.make} ${item.model}, ${item.service}`}
                referrerPolicy="no-referrer"
                className="aspect-[4/3] w-full bg-df-raised object-cover"
              />
              <div className="p-4">
                <h2 className="text-df-strong">{item.make} {item.model}</h2>
                <p className="mt-1 text-df-muted">{item.service}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-df-label text-df-muted">Wybrane realizacje studia. Bez danych klientów.</p>
    </div>
  );
}
