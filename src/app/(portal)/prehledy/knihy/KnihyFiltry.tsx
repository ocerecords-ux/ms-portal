'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * Výběr nad přehledem knih. Všechno jde do adresy, takže se dá přehled poslat
 * odkazem („tady se koukni") a tlačítko Zpět vrací předchozí výběr.
 *
 * Období má rychlé volby i vlastní rozsah - Peter se ptá jednou na „tenhle
 * měsíc" a podruhé na konkrétní kus roku a proklikávat se ke druhému přes
 * kalendář by ho zdržovalo pokaždé.
 */
export function KnihyFiltry({
  obdobi,
  od,
  do: doData,
  roky,
  kdo,
  zvukari,
  druh,
}: {
  obdobi: string;
  od: string;
  do: string;
  roky: number[];
  kdo: string;
  zvukari: { id: string; jmeno: string }[];
  druh: string;
}) {
  const t = usePreklad();
  const router = useRouter();
  const cesta = usePathname();
  const parametry = useSearchParams();

  const adresa = (zmena: Record<string, string>) => {
    const p = new URLSearchParams(parametry?.toString() ?? '');
    for (const [k, v] of Object.entries(zmena)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const q = p.toString();
    return q ? `${cesta}?${q}` : cesta;
  };

  const jdi = (zmena: Record<string, string>) => router.push(adresa(zmena));

  const pole =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <VyberPole
        aria-label={t('knihy.obdobi')}
        value={obdobi}
        onChange={(e) => jdi({ obdobi: e.target.value })}
        className={`${pole} min-w-[180px]`}
      >
        <option value="tento">{t('knihy.tentoMesic')}</option>
        <option value="minuly">{t('knihy.minulyMesic')}</option>
        <option value="3m">{t('knihy.posledni3')}</option>
        <option value="12m">{t('knihy.poslednich12')}</option>
        {roky.map((r) => (
          <option key={r} value={String(r)}>
            {t('knihy.rok', { rok: r })}
          </option>
        ))}
        <option value="vlastni">{t('knihy.vlastniRozsah')}</option>
      </VyberPole>

      {obdobi === 'vlastni' && (
        <span className="flex items-center gap-2">
          <DatumPole
            aria-label={t('knihy.od')}
            value={od}
            onChange={(e) => jdi({ od: e.target.value })}
            className={`${pole} w-[150px]`}
          />
          <span className="text-muted text-sm">–</span>
          <DatumPole
            aria-label={t('knihy.do')}
            value={doData}
            onChange={(e) => jdi({ do: e.target.value })}
            className={`${pole} w-[150px]`}
          />
        </span>
      )}

      <VyberPole
        aria-label={t('knihy.kdoNaTomDelalFiltr')}
        value={kdo}
        onChange={(e) => jdi({ kdo: e.target.value })}
        className={`${pole} min-w-[170px]`}
      >
        <option value="">{t('knihy.vsichniLide')}</option>
        {zvukari.map((z) => (
          <option key={z.id} value={z.id}>
            {z.jmeno}
          </option>
        ))}
      </VyberPole>

      <VyberPole
        aria-label={t('knihy.druhPraceFiltr')}
        value={druh}
        onChange={(e) => jdi({ druh: e.target.value })}
        className={`${pole} min-w-[150px]`}
      >
        <option value="">{t('knihy.vsechnyDruhy')}</option>
        <option value="RECORDING">{t('knihy.nataceni')}</option>
        <option value="EDITING">{t('knihy.strih')}</option>
        <option value="REPAIRS">{t('knihy.opravy')}</option>
        <option value="OTHER">{t('knihy.ostatni')}</option>
      </VyberPole>

      {(kdo || druh) && (
        <button
          type="button"
          onClick={() => jdi({ kdo: '', druh: '' })}
          className="text-sm font-heading font-semibold text-brand-purple bg-transparent border-0 px-1"
        >
          {t('knihy.zrusitFiltr')}
        </button>
      )}
    </div>
  );
}
