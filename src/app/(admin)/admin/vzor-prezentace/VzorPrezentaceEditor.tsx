'use client';

import { useState } from 'react';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/** Editor vzoru. Dvě pole a jedno tlačítko - víc tu k rozhodování není. */
export function VzorPrezentaceEditor({
  navrhReseni,
  podminky,
}: {
  navrhReseni: string;
  podminky: string;
}) {
  const t = usePreklad();
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
    setStav(res.ok ? t('vzorPrezentace.ulozeno') : t('vzorPrezentace.neulozeno'));
  }

  const vstup =
    'w-full rounded-card border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple';

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-heading font-semibold text-ink">{t('vzorPrezentace.navrh')}</span>
        <span className="text-xs font-body text-muted">
          {t('vzorPrezentace.navrhNapoveda')}
        </span>
        <textarea value={navrh} rows={10} onChange={(e) => setNavrh(e.target.value)} className={vstup} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-heading font-semibold text-ink">{t('vzorPrezentace.podminky')}</span>
        <span className="text-xs font-body text-muted">
          {t('vzorPrezentace.podminkyNapoveda')}
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
          {t('vzorPrezentace.ulozit')}
        </button>
        {stav && <span className="font-body text-sm text-muted">{stav}</span>}
      </div>
    </div>
  );
}
