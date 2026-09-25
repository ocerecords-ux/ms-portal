'use client';

import { useState } from 'react';
import {
  STAVY_NABIDKY,
  ZnackaNabidky,
  popisNabidky,
  stavNabidky,
  type StavNabidky,
} from '@/lib/nabidkaReklamy';

/**
 * ZNAČKA NABÍDKY V DETAILU PROJEKTU (zadání 23. 9. 2026). Klik na značku
 * rozbalí tři možnosti - čeká / schválena / neschválena - a hned uloží.
 *
 * Bez potvrzovacího tlačítka schválně: je to jedna informace, kterou si sám
 * pro sebe překlápí jeden člověk. Když uložení selže, značka se vrátí zpátky.
 */
export function NabidkaStav({
  caflouProjectId,
  stav,
  muzeMenit,
  zDokladu = null,
}: {
  caflouProjectId: string;
  stav: string | null;
  muzeMenit: boolean;
  /**
   * Stav podle nabídky v Dokladech (25. 9. 2026: „když dám schválit nabídku
   * ručně, tak je taky prostě schválená"). Když nabídka v portálu je, ví
   * o jejím osudu víc než ruční značka - tak se značka jen ukazuje a
   * nepřeklápí.
   */
  zDokladu?: StavNabidky | null;
}) {
  const [ulozeny, setUlozeny] = useState<StavNabidky>(stavNabidky(stav));
  const [otevreno, setOtevreno] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function uloz(novy: StavNabidky) {
    const predtim = ulozeny;
    setUlozeny(novy);
    setOtevreno(false);
    setChyba(null);
    try {
      const res = await fetch(`/api/projekty/${encodeURIComponent(caflouProjectId)}/nabidka`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stav: novy }),
      });
      if (!res.ok) throw new Error('nope');
    } catch {
      setUlozeny(predtim);
      setChyba('Neuložilo se');
    }
  }

  if (zDokladu) {
    return (
      <span
        title="Podle nabídky v Dokladech — ručně se to nepřeklápí."
        className="inline-flex items-center gap-1.5 text-xs font-heading text-muted"
      >
        <ZnackaNabidky stav={zDokladu} />
        {popisNabidky(zDokladu)}
      </span>
    );
  }

  if (!muzeMenit) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-heading text-muted">
        <ZnackaNabidky stav={ulozeny} />
        {popisNabidky(ulozeny)}
      </span>
    );
  }

  return (
    <span className="relative inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOtevreno((o) => !o)}
        title={popisNabidky(ulozeny)}
        className="inline-flex items-center gap-1.5 text-xs font-heading text-muted bg-transparent border border-line rounded-lg px-2 py-1 cursor-pointer hover:text-ink"
      >
        <ZnackaNabidky stav={ulozeny} />
        {popisNabidky(ulozeny)}
      </button>
      {chyba && <span className="text-xs font-heading text-danger">{chyba}</span>}
      {otevreno && (
        <span className="absolute left-0 top-full mt-1 z-20 flex flex-col bg-white border border-line rounded-lg shadow-lg overflow-hidden min-w-[210px]">
          {STAVY_NABIDKY.map((s) => (
            <button
              key={s.klic}
              type="button"
              onClick={() => uloz(s.klic)}
              className={`flex items-center gap-2 text-left text-xs font-heading px-3 py-2 bg-transparent border-0 cursor-pointer hover:bg-paper ${
                s.klic === ulozeny ? 'text-ink' : 'text-muted'
              }`}
            >
              <ZnackaNabidky stav={s.klic} velikost={14} />
              {s.popis}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
