'use client';

type Mesic = { klic: string; popis: string; knih: number };

/**
 * KOLIK KNIH SE V KTERÉM MĚSÍCI ODEVZDALO (zadání 28. 9. 2026: „jaké knihy se
 * tento a minulý měsíc a další měsíce odevzdaly celkově").
 *
 * Vlastní graf, ne čára přes graf nákladů: kusy a koruny nemají společnou osu
 * a dvě osy v jednom obrázku se nedají poctivě přečíst.
 *
 * Jedna řada, takže legenda není potřeba - co graf ukazuje, říká jeho nadpis.
 * Čísla jsou psaná rovnou nad sloupci (jsou to jednotky kusů, bublina by tu
 * byla na obtíž); prázdný měsíc zůstává bez popisku, ať nesvítí samé nuly.
 */
export function GrafKnih({ mesice }: { mesice: Mesic[] }) {
  const nejvic = Math.max(...mesice.map((m) => m.knih), 1);
  const kazdyDruhy = mesice.length > 12;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end h-32 gap-[2px]">
        {mesice.map((m) => (
          <div key={m.klic} className="flex-1 h-full flex flex-col justify-end items-center gap-1 min-w-0">
            <span className="text-[11px] font-heading text-ink tabular-nums leading-none">
              {m.knih > 0 ? m.knih : ''}
            </span>
            <span
              className="w-full max-w-[26px] rounded-t bg-brand-purple"
              style={{ height: `${(m.knih / nejvic) * 100}%` }}
              title={`${m.popis}: ${m.knih}`}
            />
          </div>
        ))}
      </div>
      <div className="flex text-[11px] font-body text-muted">
        {mesice.map((m, i) => (
          <span key={m.klic} className="flex-1 text-center truncate">
            {kazdyDruhy && i % 2 === 1 ? '' : m.popis}
          </span>
        ))}
      </div>
    </div>
  );
}
