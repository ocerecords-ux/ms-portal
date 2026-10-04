'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import { AdminField } from '../NewCompanyForm';

/**
 * Zakládání a úprava složek na Disku (zadání 30. 9. 2026).
 *
 * Mazání tu není schválně - viz komentář v /api/admin/slozky/[id]. Vypnutá
 * složka se nikomu nenabízí, ale zaškrtnutí u účtů zůstanou.
 */
export type SlozkaRadek = {
  id: string;
  nazev: string;
  popis: string | null;
  driveUrl: string;
  poradi: number;
  aktivni: boolean;
  /** Kolik lidí ji má přidělenou - ať je vidět, koho se vypnutí dotkne. */
  pocetLidi: number;
  /** Jde z odkazu vyčíst složka? */
  odkazSedi: boolean;
};

export function SlozkyManager({ slozky }: { slozky: SlozkaRadek[] }) {
  const router = useRouter();
  const t = usePreklad();
  const [nazev, setNazev] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [popis, setPopis] = useState('');
  const [chyba, setChyba] = useState<string | null>(null);
  const [uklada, setUklada] = useState(false);
  /** Která složka se zrovna přepíná - ať se dvojklik nepočítá dvakrát. */
  const [prepina, setPrepina] = useState<string | null>(null);

  async function zaloz(e: React.FormEvent) {
    e.preventDefault();
    setChyba(null);
    setUklada(true);
    try {
      const res = await fetch('/api/admin/slozky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev, driveUrl, popis: popis || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || t('slozky.nejdeUlozit'));
        return;
      }
      setNazev('');
      setDriveUrl('');
      setPopis('');
      router.refresh();
    } catch {
      setChyba(t('slozky.nejdeUlozit'));
    } finally {
      setUklada(false);
    }
  }

  async function prepni(slozka: SlozkaRadek) {
    setChyba(null);
    setPrepina(slozka.id);
    try {
      const res = await fetch(`/api/admin/slozky/${slozka.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktivni: !slozka.aktivni }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChyba(data?.error || t('slozky.nejdeUlozit'));
        return;
      }
      router.refresh();
    } catch {
      setChyba(t('slozky.nejdeUlozit'));
    } finally {
      setPrepina(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {chyba && (
        <p className="text-sm font-body text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">
          {chyba}
        </p>
      )}

      <div className="bg-surface rounded-card border border-line shadow-sm divide-y divide-line">
        {slozky.length === 0 && (
          <p className="text-sm font-body text-muted m-0 p-5">{t('slozky.prazdno')}</p>
        )}
        {slozky.map((s) => (
          <div key={s.id} className="p-5 flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="font-heading font-semibold text-sm text-ink m-0">
                {s.nazev}
                {!s.aktivni && (
                  <span className="text-muted font-body font-normal">{t('slozky.vypnuta')}</span>
                )}
              </p>
              {s.popis && <p className="text-xs font-body text-muted m-0 mt-1">{s.popis}</p>}
              <p className="text-xs font-body text-muted m-0 mt-1 break-all">{s.driveUrl}</p>
              {!s.odkazSedi && (
                <p className="text-xs font-body text-danger m-0 mt-1">
                  {t('slozky.odkazNesedi')}
                </p>
              )}
              <p className="text-xs font-body text-muted m-0 mt-1">
                {s.pocetLidi === 0
                  ? t('slozky.nikdo')
                  : s.pocetLidi === 1
                    ? t('slozky.jeden')
                    : t('slozky.vice', { pocet: s.pocetLidi })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => prepni(s)}
              disabled={prepina === s.id}
              className="font-heading text-sm rounded-lg px-4 py-2 border border-line text-muted hover:text-ink hover:border-ink transition-colors disabled:opacity-50"
            >
              {s.aktivni ? t('slozky.vypnout') : t('slozky.zapnout')}
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={zaloz} className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
        <p className="font-heading font-semibold text-sm text-ink m-0">{t('slozky.nova')}</p>
        <AdminField label={t('slozky.nazev')}>
          <input
            value={nazev}
            onChange={(e) => setNazev(e.target.value)}
            placeholder="Klientská zóna"
            className="w-full bg-field border border-line rounded-lg px-3 py-2 text-sm font-body text-ink"
          />
        </AdminField>
        {/* Ukázka v políčku zůstává česky schválně: složky na Disku se tak
            opravdu jmenují, anglická ukázka by radila založit něco jiného
            (stejné rozhodnutí jako u ukázek v dávkách 7b a 7c). */}
        <AdminField label={t('slozky.odkaz')} hint={t('slozky.odkazNapoveda')}>
          <input
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            className="w-full bg-field border border-line rounded-lg px-3 py-2 text-sm font-body text-ink"
          />
        </AdminField>
        <AdminField label={t('slozky.popis')} hint={t('slozky.popisNapoveda')}>
          <input
            value={popis}
            onChange={(e) => setPopis(e.target.value)}
            className="w-full bg-field border border-line rounded-lg px-3 py-2 text-sm font-body text-ink"
          />
        </AdminField>
        <div>
          <button
            type="submit"
            disabled={uklada || !nazev.trim() || !driveUrl.trim()}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-6 py-3 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
          >
            {uklada ? t('slozky.ukladam') : t('slozky.zalozit')}
          </button>
        </div>
      </form>
    </div>
  );
}
