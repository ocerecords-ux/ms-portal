/**
 * Kostra detailu projektu. Vlastní proto, že detail vypadá úplně jinak než
 * seznam - nadpis, štítek stavu, záložky a karty - a kostra ve tvaru tabulky
 * by při přeblikání do skutečného obsahu poskočila.
 *
 * Detail je ze všech stránek nejpomalejší: čeká na projekt z Caflou a k tomu
 * na desítku dotazů do databáze (doklady, výkazy, frekvence, rodné listy).
 * Viz komentář v ../loading.tsx.
 */
export default function ProjectDetailLoading() {
  return (
    <section className="flex flex-col gap-6 animate-pulse" aria-busy="true" aria-label="Načítám projekt">
      <div>
        <div className="h-4 w-32 bg-field rounded" />
        <div className="flex items-center gap-4 mt-3">
          <div className="h-9 w-80 max-w-full bg-line/70 rounded-lg" />
          <div className="h-6 w-28 bg-field rounded-pill" />
        </div>
        <div className="h-3.5 w-48 bg-field rounded mt-3" />
      </div>

      <div className="flex gap-2 border-b border-line pb-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-36 bg-field rounded-lg" />
        ))}
      </div>

      <div className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-4">
        <div className="h-3 w-24 bg-field rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="h-2.5 w-20 bg-field rounded" />
              <div className="h-3.5 w-32 bg-line/60 rounded" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-4">
        <div className="h-3 w-28 bg-field rounded" />
        <div className="h-24 bg-field rounded-lg" />
      </div>
    </section>
  );
}
