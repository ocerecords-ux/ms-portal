'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';

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
        aria-label="Období"
        value={obdobi}
        onChange={(e) => jdi({ obdobi: e.target.value })}
        className={`${pole} min-w-[180px]`}
      >
        <option value="tento">Tento měsíc</option>
        <option value="minuly">Minulý měsíc</option>
        <option value="3m">Poslední 3 měsíce</option>
        <option value="12m">Posledních 12 měsíců</option>
        {roky.map((r) => (
          <option key={r} value={String(r)}>
            Rok {r}
          </option>
        ))}
        <option value="vlastni">Vlastní rozsah…</option>
      </VyberPole>

      {obdobi === 'vlastni' && (
        <span className="flex items-center gap-2">
          <DatumPole
            aria-label="Od"
            value={od}
            onChange={(e) => jdi({ od: e.target.value })}
            className={`${pole} w-[150px]`}
          />
          <span className="text-muted text-sm">–</span>
          <DatumPole
            aria-label="Do"
            value={doData}
            onChange={(e) => jdi({ do: e.target.value })}
            className={`${pole} w-[150px]`}
          />
        </span>
      )}

      <VyberPole
        aria-label="Kdo na tom dělal"
        value={kdo}
        onChange={(e) => jdi({ kdo: e.target.value })}
        className={`${pole} min-w-[170px]`}
      >
        <option value="">Všichni lidé</option>
        {zvukari.map((z) => (
          <option key={z.id} value={z.id}>
            {z.jmeno}
          </option>
        ))}
      </VyberPole>

      <VyberPole
        aria-label="Druh práce"
        value={druh}
        onChange={(e) => jdi({ druh: e.target.value })}
        className={`${pole} min-w-[150px]`}
      >
        <option value="">Všechny druhy</option>
        <option value="RECORDING">Natáčení</option>
        <option value="EDITING">Střih</option>
        <option value="REPAIRS">Opravy</option>
        <option value="OTHER">Ostatní</option>
      </VyberPole>

      {(kdo || druh) && (
        <button
          type="button"
          onClick={() => jdi({ kdo: '', druh: '' })}
          className="text-sm font-heading font-semibold text-brand-purple bg-transparent border-0 px-1"
        >
          Zrušit filtr
        </button>
      )}
    </div>
  );
}
