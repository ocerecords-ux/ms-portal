'use client';

import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import { useState } from 'react';
import { kodJazyka } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * Odkaz do AudioTaggeru pro klienta (zadání 11. 9. 2026).
 *
 * Do mailu o prvních tracích se dává sám, tohle je na ostatní případy —
 * poslat ho ručně, ukázat ho někomu do Slacku, nebo ho zavřít, když už má
 * klient přeposlechnuto. Vidí to jen tým Mediaspace.
 *
 * Kdo odkaz dostane dál, dostane se dovnitř taky — proto je tu vidět, kolikrát
 * se otevřel, a proto jde vygenerovat nový, kterým ten starý zhasne.
 */

export type StavOdkazu = { url: string | null; otevrenoAt: string | null; pocetOtevreni: number };

function datum(iso: string, jazyk: 'cs' | 'en'): string {
  return new Date(iso).toLocaleString(kodJazyka(jazyk), {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function OdkazProKlienta({
  caflouProjectId,
  pocatecni,
}: {
  caflouProjectId: string;
  pocatecni: StavOdkazu;
}) {
  const jazyk = useJazyk();
  const t = usePreklad();
  const [stav, setStav] = useState<StavOdkazu>(pocatecni);
  const [pracuje, setPracuje] = useState(false);
  const [zkopirovano, setZkopirovano] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const zaklad = `/api/projekty/${encodeURIComponent(caflouProjectId)}/preposlech/odkaz`;

  async function posli(url: string, init: RequestInit) {
    setPracuje(true);
    setChyba(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setChyba((data as { error?: string })?.error || t('odkazKl.nepovedlo'));
        return;
      }
      setStav(data as StavOdkazu);
    } catch {
      setChyba(t('odkazKl.bezSpojeni'));
    } finally {
      setPracuje(false);
    }
  }

  async function zkopiruj() {
    if (!stav.url) return;
    try {
      await navigator.clipboard.writeText(stav.url);
      setZkopirovano(true);
      window.setTimeout(() => setZkopirovano(false), 2000);
    } catch {
      setChyba(t('odkazKl.kopirovaniNejde'));
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-heading font-semibold text-muted uppercase tracking-wide m-0">
          {t('odkazKl.nadpis')}
        </p>
        {stav.url ? (
          <p className="text-xs font-body text-ink m-0 mt-1 break-all">
            {stav.url}
            <span className="text-muted">
              {stav.pocetOtevreni > 0 && stav.otevrenoAt
                ? t('odkazKl.otevreno', {
                    pocet: stav.pocetOtevreni,
                    datum: datum(stav.otevrenoAt, jazyk),
                  })
                : t('odkazKl.neotevreny')}
            </span>
          </p>
        ) : (
          <p className="text-xs font-body text-muted m-0 mt-1">
            {t('odkazKl.zadny')}
          </p>
        )}
        {chyba && <p className="text-xs font-body text-danger m-0 mt-1">{chyba}</p>}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {stav.url && (
          <button
            type="button"
            onClick={() => void zkopiruj()}
            className="font-heading font-semibold text-xs rounded-lg px-3 py-1.5 bg-brand-purple text-white hover:bg-brand-purpleDeep transition-colors"
          >
            {zkopirovano ? t('odkazKl.zkopirovano') : t('odkazKl.kopirovat')}
          </button>
        )}
        <button
          type="button"
          disabled={pracuje}
          onClick={() => void posli(`${zaklad}${stav.url ? '?novy=1' : ''}`, { method: 'POST' })}
          className="font-heading font-semibold text-xs rounded-lg px-3 py-1.5 border border-line text-ink hover:border-brand-purple hover:text-brand-purple transition-colors disabled:opacity-50"
        >
          {stav.url ? t('odkazKl.novy') : t('odkazKl.vyrobit')}
        </button>
        {/* Zavřením odkaz přestane fungovat i tomu, komu ho klient přeposlal -
            proto se portál ptá podruhé (18. 9. 2026). */}
        {stav.url && (
          <TlacitkoSmazat
            onSmazat={() => posli(zaklad, { method: 'DELETE' })}
            disabled={pracuje}
            popisek={t('odkazKl.zavrit')}
            otazka={t('odkazKl.opravduZavrit')}
            trida="text-xs"
          />
        )}
      </div>
    </div>
  );
}
