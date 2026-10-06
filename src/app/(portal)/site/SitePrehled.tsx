'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FORMATY, SABLONY, najdiFormat } from '@/lib/socialni';
import type { PrispevekRadek } from '@/lib/socialniServer';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { formatDatum, prelozitNaKusy } from '@/lib/jazyk';

/**
 * PŘEHLED PŘÍSPĚVKŮ NA SÍTĚ (zadání 27. 9. 2026).
 *
 * Nový příspěvek se zakládá výběrem formátu a šablony - prázdné plátno je
 * taky jedna z voleb. Stejné pořadí jako v Canvě: napřed kam, pak z čeho.
 */

/** Barvy odznaku podle KÓDU stavu; text se bere ze slovníku (site.stav.*). */
const TRIDY_STAVU: Record<string, string> = {
  KONCEPT: 'bg-field text-muted border-line',
  HOTOVO: 'bg-okTint text-status-done border-transparent',
  PUBLIKOVANO: 'bg-brand-purple/15 text-brand-purpleDeep border-brand-purple/40',
};

export function SitePrehled({ prispevky }: { prispevky: PrispevekRadek[] }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();
  const [zakladam, setZakladam] = useState(false);
  const [format, setFormat] = useState(FORMATY[0].klic);
  const [otevreno, setOtevreno] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function zaloz(sablonaKlic: string) {
    const sablona = SABLONY.find((s) => s.klic === sablonaKlic) ?? SABLONY[0];
    setZakladam(true);
    setChyba(null);
    try {
      const res = await fetch('/api/site/prispevky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Nazev se UKLADA do databaze, takze zustava cesky (pravidlo 4).
          nazev: sablona.klic === 'cista' ? 'Nový příspěvek' : sablona.nazev,
          format,
          platno: sablona.platno(),
        }),
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(telo.error || t('site.nezalozeno'));
      router.push(`/site/${telo.prispevek.id}`);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : t('site.nezalozeno'));
      setZakladam(false);
    }
  }

  const proFormat = SABLONY.filter((s) => !s.formaty || s.formaty.includes(format));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display text-3xl text-ink m-0">{t('site.nadpis')}</h1>
        {prispevky.length > 0 && (
          <span className="shrink-0 grid place-items-center min-w-[28px] h-7 px-2 rounded-pill bg-brand-purple/15 border border-brand-purple/40 text-brand-purpleDeep dark:text-brand-purpleLight font-heading font-semibold text-sm tabular-nums">
            {prispevky.length}
          </span>
        )}
        <Link
          href="/site/pribehy"
          className="ml-auto rounded-pill border border-line text-ink font-heading font-semibold text-sm px-4 py-2 no-underline hover:border-brand-purple transition-colors"
        >
          {t('pribehy.nadpis')}
        </Link>
        <button
          type="button"
          onClick={() => setOtevreno((o) => !o)}
          className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-5 py-2 hover:bg-brand-purpleDeep transition-colors cursor-pointer"
        >
          {t(otevreno ? 'site.zavrit' : 'site.novyPrispevek')}
        </button>
      </div>

      {otevreno && (
        <div className="rounded-card border border-line bg-surface p-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-heading font-semibold text-ink">{t('site.kamToPujde')}</span>
            <div className="flex flex-wrap gap-2">
              {FORMATY.map((f) => (
                <button
                  key={f.klic}
                  type="button"
                  onClick={() => setFormat(f.klic)}
                  aria-pressed={format === f.klic}
                  title={`${t(`site.format.${f.klic}.popis`)} (${f.sirka}×${f.vyska})`}
                  className={`rounded-pill border px-3 py-1.5 text-sm font-heading transition-colors ${
                    format === f.klic
                      ? 'border-brand-purple bg-brand-purple/10 text-ink'
                      : 'border-line text-muted hover:text-ink'
                  }`}
                >
                  {f.sit === 'INSTAGRAM' ? 'IG' : 'LI'} · {t(`site.format.${f.klic}.nazev`)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-heading font-semibold text-ink">{t('site.zCehoZacit')}</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {proFormat.map((s) => (
                <button
                  key={s.klic}
                  type="button"
                  disabled={zakladam}
                  onClick={() => void zaloz(s.klic)}
                  className="text-left rounded-card border border-line bg-field/40 px-4 py-3 hover:border-brand-purple transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span className="block font-heading font-semibold text-sm text-ink">
                    {t(`site.sablona.${s.klic}.nazev`)}
                  </span>
                  <span className="block text-xs font-body text-muted mt-0.5">
                    {t(`site.sablona.${s.klic}.popis`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {chyba && (
            <p className="text-sm font-body text-status-error m-0" role="alert">
              {chyba}
            </p>
          )}
        </div>
      )}

      {prispevky.length === 0 ? (
        <div className="rounded-card border border-line bg-surface px-6 py-12 text-center">
          <p className="text-sm font-body text-muted m-0">
            {prelozitNaKusy(jazyk, 'site.zatimNic', ['tlacitko']).map((kus, i) =>
              kus.znacka ? (
                <strong key={i} className="font-heading text-ink">
                  {t('site.novyPrispevek')}
                </strong>
              ) : (
                <span key={i}>{kus.text}</span>
              ),
            )}
          </p>
        </div>
      ) : (
        <ul className="list-none p-0 m-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {prispevky.map((p) => {
            const f = najdiFormat(p.format);
            const tridaStavu = TRIDY_STAVU[p.stav] ?? TRIDY_STAVU.KONCEPT;
            return (
              <li key={p.id}>
                <Link
                  href={`/site/${p.id}`}
                  className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 no-underline hover:border-brand-purple transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="rounded-pill border border-line text-muted px-2 py-0.5 text-[11px] font-heading">
                      {t(p.sit === 'INSTAGRAM' ? 'siteEditor.instagram' : 'siteEditor.linkedin')}
                    </span>
                    <span className={`rounded-pill border px-2 py-0.5 text-[11px] font-heading ${tridaStavu}`}>
                      {t(`site.stav.${p.stav}`)}
                    </span>
                  </span>
                  <span className="font-heading font-semibold text-sm text-ink truncate">{p.nazev}</span>
                  <span className="text-xs font-body text-muted">
                    {t(`site.format.${f.klic}.nazev`)} · {p.sirka}×{p.vyska}
                  </span>
                  {p.popisek.trim() && (
                    <span className="text-xs font-body text-muted line-clamp-2">{p.popisek}</span>
                  )}
                  <span className="text-[11px] font-body text-muted mt-auto">
                    {t('site.naposledy', { datum: formatDatum(jazyk, new Date(p.updatedAt)) })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
