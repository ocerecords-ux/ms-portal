'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '../../components/JazykProvider';

/**
 * UKONČIT PROJEKT RUČNĚ (zadání 16. 9. 2026: „dejme někde možnost ukončit
 * projekt ručně. Děje se to ve chvíli, kdy už máme poslanou fakturu na klienta
 * ještě předtím, než se překlopí stav na Schváleno - k fakturaci").
 *
 * Projekt se normálně zavře sám, jakmile z portálu odejde faktura. Když ale
 * faktura odejde jinudy nebo dřív, zakázka zůstane viset mezi aktivními —
 * a přehazovat kvůli tomu stav přes celou cestu je zbytečné.
 *
 * Je to schválně TLAČÍTKO, ne další položka v nabídce stavů: „ukončit" je
 * rozhodnutí, ne krok výroby, a v rozbalovátku se to hledá špatně.
 */
export function UkonceniProjektu({
  caflouProjectId,
  ukonceny,
}: {
  caflouProjectId: string;
  ukonceny: boolean;
}) {
  const router = useRouter();
  const t = usePreklad();
  const [hotovo, setHotovo] = useState(ukonceny);
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function prepni(naUkonceno: boolean) {
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch(
        `/api/projekty/${encodeURIComponent(caflouProjectId)}/ukonceni`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ukoncit: naUkonceno }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba((data as { error?: string })?.error || t('ukonceni.chyba'));
        return;
      }
      setHotovo(naUkonceno);
      // Stav se mění i v hlavičce a v seznamu projektů - načíst znovu.
      router.refresh();
    } catch {
      setChyba(t('ukonceni.chyba'));
    } finally {
      setBezi(false);
    }
  }

  return (
    <div className="border-t border-line pt-4 flex items-start gap-4 flex-wrap">
      <div className="flex-1 min-w-[260px]">
        <p className="font-heading font-semibold text-sm text-ink m-0">
          {hotovo ? t('ukonceni.jeUkonceny') : t('ukonceni.ukoncit')}
        </p>
        <p className="text-xs font-body text-muted m-0 mt-1">
          {hotovo ? t('ukonceni.popisUkonceny') : t('ukonceni.popisAktivni')}
        </p>
        {chyba && <p className="text-sm font-body text-danger m-0 mt-1">{chyba}</p>}
      </div>
      <button
        type="button"
        disabled={bezi}
        onClick={() => void prepni(!hotovo)}
        className={`text-sm font-heading font-semibold rounded-pill border px-4 py-2 transition-colors disabled:opacity-60 ${
          hotovo
            ? 'border-line text-muted hover:border-brand-purple hover:text-brand-purple'
            : 'border-brand-green text-brand-greenDeep hover:bg-okTint'
        }`}
      >
        {bezi ? t('obecne.ukladam') : hotovo ? t('ukonceni.vratit') : t('ukonceni.ukoncit')}
      </button>
    </div>
  );
}
