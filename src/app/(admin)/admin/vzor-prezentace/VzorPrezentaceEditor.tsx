'use client';

import { useState } from 'react';

/** Editor vzoru. Dvě pole a jedno tlačítko - víc tu k rozhodování není. */
export function VzorPrezentaceEditor({
  navrhReseni,
  podminky,
}: {
  navrhReseni: string;
  podminky: string;
}) {
  const [navrh, setNavrh] = useState(navrhReseni);
  const [pod, setPod] = useState(podminky);
  const [stav, setStav] = useState<string | null>(null);
  const [pracuje, setPracuje] = useState(false);

  async function uloz() {
    setPracuje(true);
    setStav(null);
    const res = await fetch('/api/admin/vzor-prezentace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ navrhReseni: navrh, podminky: pod }),
    });
    setPracuje(false);
    setStav(res.ok ? 'Uloženo.' : 'Uložení se nepovedlo.');
  }

  const vstup =
    'w-full rounded-card border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple';

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-heading font-semibold text-ink">Návrh řešení</span>
        <span className="text-xs font-body text-muted">
          Kostra, kterou u projektu dopíšete. Odstavce oddělte prázdným řádkem; řádek začínající
          pomlčkou se klientovi vykreslí jako odrážka.
        </span>
        <textarea value={navrh} rows={10} onChange={(e) => setNavrh(e.target.value)} className={vstup} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-heading font-semibold text-ink">Podmínky spolupráce</span>
        <span className="text-xs font-body text-muted">
          Licence, termíny dodání, platba, storno. Tohle je ta část, která má být u všech nabídek
          stejná.
        </span>
        <textarea value={pod} rows={14} onChange={(e) => setPod(e.target.value)} className={vstup} />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void uloz()}
          disabled={pracuje}
          className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-5 py-2.5 border-0 cursor-pointer disabled:opacity-50"
        >
          Uložit vzor
        </button>
        {stav && <span className="font-body text-sm text-muted">{stav}</span>}
      </div>
    </div>
  );
}
