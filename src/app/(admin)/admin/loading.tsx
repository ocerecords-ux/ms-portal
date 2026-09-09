/**
 * Kostra administrace - stejný důvod jako u portálu (viz
 * src/app/(portal)/loading.tsx): stránky jsou dynamické a bez tohohle souboru
 * po kliknutí v menu nic nezareaguje, dokud server nedopočítá obsah.
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true" aria-label="Načítám">
      <div className="h-8 w-56 bg-line/70 rounded-lg" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
            <div className="h-2.5 w-24 bg-field rounded" />
            <div className="h-6 w-20 bg-line/60 rounded" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-card border border-line shadow-sm overflow-hidden">
        <div className="h-11 bg-line/60" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 border-t border-line">
            <div className="h-3.5 bg-field rounded flex-[3]" />
            <div className="h-3.5 bg-field rounded flex-[2]" />
            <div className="h-3.5 bg-field rounded flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
