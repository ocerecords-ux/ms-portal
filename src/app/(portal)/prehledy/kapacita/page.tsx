import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canSee } from '@/lib/menu';
import { hodiny, nactiKapacitu, procenta } from '@/lib/kapacitaServer';

/**
 * KAPACITA STUDIÍ (zadání 20. 9. 2026: „mapa obsazenosti, abych viděl všechna
 * studia po měsících a jen natáčení").
 *
 * Mřížka: řádek = studio, sloupec = měsíc. Barva políčka říká, jak je měsíc
 * natáčením zaplněný, číslo v něm procenta a pod ním hodiny. Počítá se jen
 * NATÁČENÍ (potvrzené frekvence a ručně zapsané natáčení) proti otevírací
 * době studia - viz lib/kapacitaServer.ts.
 */
export const dynamic = 'force-dynamic';

const MESICE = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];

/** Barva políčka podle obsazenosti - od skoro prázdné po přeplněnou. */
function odstin(p: number | null): { trida: string; styl?: React.CSSProperties } {
  if (p === null) return { trida: 'bg-field text-muted' };
  if (p >= 95) return { trida: 'text-white', styl: { backgroundColor: '#6b2af0' } };
  if (p >= 70) return { trida: 'text-white', styl: { backgroundColor: '#7b55ff' } };
  if (p >= 45) return { trida: 'text-ink', styl: { backgroundColor: 'rgba(123,85,255,0.45)' } };
  if (p >= 20) return { trida: 'text-ink', styl: { backgroundColor: 'rgba(123,85,255,0.22)' } };
  if (p > 0) return { trida: 'text-ink', styl: { backgroundColor: 'rgba(123,85,255,0.1)' } };
  return { trida: 'bg-field text-muted' };
}

export default async function KapacitaPage({ searchParams }: { searchParams?: { rok?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (!canSee('/prehledy', session.user.role)) redirect('/projekty');

  const ted = new Date();
  const rok = Number(searchParams?.rok) || ted.getUTCFullYear();
  const prehled = await nactiKapacitu(rok);

  const celkemKapacita = prehled.celkem.reduce((a, m) => a + m.kapacitaMinut, 0);
  const celkemNatoceno = prehled.celkem.reduce((a, m) => a + m.natoceno, 0);
  const celkemProcent = procenta({ kapacitaMinut: celkemKapacita, natoceno: celkemNatoceno });
  const dnesniMesic = ted.getUTCFullYear() === rok ? ted.getUTCMonth() + 1 : null;

  const odkazRoku = (r: number) => `/prehledy/kapacita?rok=${r}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Link href="/prehledy" className="text-sm font-heading text-muted no-underline">
            ← Přehledy
          </Link>
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0 mt-2">Kapacita studií</h1>
          <p className="text-muted font-body m-0 mt-2">
            Kolik hodin se ve studiích <b>natáčí</b> proti jejich otevírací době. Střih, casting ani blokace se
            nepočítají.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={odkazRoku(rok - 1)}
            className="rounded-pill border border-line px-3 py-1.5 text-sm font-heading text-ink no-underline hover:border-brand-purple"
          >
            ‹ {rok - 1}
          </Link>
          <span className="rounded-pill bg-brand-purple text-white px-4 py-1.5 text-sm font-heading font-semibold tabular-nums">
            {rok}
          </span>
          <Link
            href={odkazRoku(rok + 1)}
            className="rounded-pill border border-line px-3 py-1.5 text-sm font-heading text-ink no-underline hover:border-brand-purple"
          >
            {rok + 1} ›
          </Link>
        </div>
      </div>

      {/* Souhrn za celý rok */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface rounded-card border border-line shadow-sm p-4">
          <p className="text-xs font-heading uppercase tracking-wide text-muted m-0">Natočeno</p>
          <p className="font-display text-3xl text-ink m-0 mt-1 tabular-nums">{hodiny(celkemNatoceno)} h</p>
        </div>
        <div className="bg-surface rounded-card border border-line shadow-sm p-4">
          <p className="text-xs font-heading uppercase tracking-wide text-muted m-0">Kapacita</p>
          <p className="font-display text-3xl text-ink m-0 mt-1 tabular-nums">{hodiny(celkemKapacita)} h</p>
        </div>
        <div className="bg-surface rounded-card border border-line shadow-sm p-4">
          <p className="text-xs font-heading uppercase tracking-wide text-muted m-0">Obsazenost</p>
          <p className="font-display text-3xl text-brand-greenDeep dark:text-brand-green m-0 mt-1 tabular-nums">
            {celkemProcent === null ? '—' : `${celkemProcent} %`}
          </p>
        </div>
      </div>

      {/* Mapa obsazenosti */}
      <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[760px]">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-heading uppercase tracking-wide text-muted px-4 py-3">
                  Studio
                </th>
                {MESICE.map((m, i) => (
                  <th
                    key={m}
                    className={`text-center text-[11px] font-heading uppercase tracking-wide px-1 py-3 ${
                      dnesniMesic === i + 1 ? 'text-brand-purple' : 'text-muted'
                    }`}
                  >
                    {m}
                  </th>
                ))}
                <th className="text-right text-[11px] font-heading uppercase tracking-wide text-muted px-4 py-3">
                  Rok
                </th>
              </tr>
            </thead>
            <tbody>
              {prehled.studia.map((s) => {
                const rocni = procenta(s);
                return (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2 font-heading font-semibold text-ink text-sm">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.barva }} />
                        {s.nazev}
                      </span>
                    </td>
                    {s.mesice.map((m) => {
                      const p = procenta(m);
                      const { trida, styl } = odstin(p);
                      return (
                        <td key={m.mesic} className="px-1 py-1.5">
                          <div
                            className={`rounded-lg h-12 grid place-items-center leading-tight ${trida}`}
                            style={styl}
                            title={`${s.nazev} · ${MESICE[m.mesic - 1]} ${prehled.rok}: ${hodiny(m.natoceno)} h natáčení z ${hodiny(
                              m.kapacitaMinut,
                            )} h kapacity (${m.pocet}×)`}
                          >
                            <span className="text-xs font-heading font-semibold tabular-nums">
                              {p === null ? '—' : `${p} %`}
                            </span>
                            <span className="text-[10px] font-body opacity-80 tabular-nums">
                              {m.natoceno > 0 ? `${hodiny(m.natoceno)} h` : ''}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <span className="font-heading font-semibold text-ink tabular-nums">
                        {rocni === null ? '—' : `${rocni} %`}
                      </span>
                      <span className="block text-[11px] font-body text-muted tabular-nums">
                        {hodiny(s.natoceno)} / {hodiny(s.kapacitaMinut)} h
                      </span>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-line bg-surfaceSoft">
                <td className="px-4 py-2 font-heading font-semibold text-ink text-sm">Všechna studia</td>
                {prehled.celkem.map((m) => {
                  const p = procenta(m);
                  return (
                    <td key={m.mesic} className="px-1 py-2 text-center">
                      <span className="text-xs font-heading font-semibold text-ink tabular-nums">
                        {p === null ? '—' : `${p} %`}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-right font-heading font-semibold text-ink tabular-nums">
                  {celkemProcent === null ? '—' : `${celkemProcent} %`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-xs font-body text-muted">
        <span>Obsazenost:</span>
        {[
          { popis: '0 %', styl: undefined as React.CSSProperties | undefined },
          { popis: 'do 20 %', styl: { backgroundColor: 'rgba(123,85,255,0.1)' } },
          { popis: 'do 45 %', styl: { backgroundColor: 'rgba(123,85,255,0.22)' } },
          { popis: 'do 70 %', styl: { backgroundColor: 'rgba(123,85,255,0.45)' } },
          { popis: 'do 95 %', styl: { backgroundColor: '#7b55ff' } },
          { popis: 'plno', styl: { backgroundColor: '#6b2af0' } },
        ].map((l) => (
          <span key={l.popis} className="inline-flex items-center gap-1.5">
            <span
              className={`w-5 h-4 rounded ${l.styl ? '' : 'bg-field border border-line'}`}
              style={l.styl}
              aria-hidden
            />
            {l.popis}
          </span>
        ))}
        <span className="ml-auto">
          Kapacita je otevírací doba studia (Administrace → Studia). Dny „jen po domluvě" (víkendy) se do kapacity
          nepočítají, natáčení v nich ano — proto může měsíc přesáhnout 100 %.
        </span>
      </div>
    </div>
  );
}
