'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * NAČTENÍ TECHNICKÝCH PARAMETRŮ DO PROCESŮ (zadání 28. 9. 2026).
 *
 * Sady se dál mění v Administraci; tohle z nich udělá články ke čtení. Běží
 * to na stisk, ne samo - článek se přepisuje celý a nemá se to dít někomu
 * pod rukama uprostřed porady.
 */
export function NacistParametry() {
  const router = useRouter();
  const [bezi, setBezi] = useState(false);
  const [zprava, setZprava] = useState<string | null>(null);

  async function nacti() {
    if (bezi) return;
    setBezi(true);
    setZprava(null);
    try {
      const res = await fetch('/api/admin/procesy/z-parametru', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setZprava(data?.error || 'Parametry se nepodařilo načíst.');
        return;
      }
      setZprava(
        `Hotovo — dokument ${data.zalozeno ? 'založen' : 'přepsán'}, ${data.celkem} sad` +
          (data.uklizeno ? `, uklizeno ${data.uklizeno} starých článků` : '') +
          '.',
      );
      router.refresh();
    } catch {
      setZprava('Parametry se nepodařilo načíst.');
    } finally {
      setBezi(false);
    }
  }

  return (
    <span className="flex items-center gap-3 flex-wrap">
      {zprava && <span className="text-xs font-body text-muted">{zprava}</span>}
      <button
        type="button"
        onClick={() => void nacti()}
        disabled={bezi}
        title="Ze sad v Administraci složí jeden dokument Technické parametry výroby, uvnitř rozdělený po nakladatelstvích. Existující dokument přepíše."
        className="text-sm font-heading font-semibold rounded-pill border border-line bg-surface px-4 py-2 text-brand-purple disabled:opacity-60 hover:border-brand-purple"
      >
        {bezi ? 'Načítám…' : 'Načíst technické parametry'}
      </button>
    </span>
  );
}
