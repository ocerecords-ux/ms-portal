import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canSee } from '@/lib/menu';
import { hodiny, nactiKapacituRoku, procenta } from '@/lib/kapacitaServer';

/**
 * KAPACITA STUDIÍ (zadání 20. 9. 2026: „chci to mít všechno na jedné stránce,
 * ať jasně vidím, kde jsou díry. A nemusí tam být ten počet hodin, jen
 * obdélníčky").
 *
 * Celý rok najednou: dvanáct tabulek měsíců, v každé řádek = den a sloupec =
 * studio. Každý den je jen obdélníček - čím tmavší, tím plnější; prázdný
 * obdélníček je díra. Víkendy mají svůj podklad, dnešek rámeček. Hodiny a
 * počet natáčení se ukážou v bublině po najetí myší.
 *
 * Počítá se jen NATÁČENÍ proti otevírací době studia - viz lib/kapacitaServer.
 */
export const dynamic = 'force-dynamic';

const MESICE = [
  'leden',
  'únor',
  'březen',
  'duben',
  'květen',
  'červen',
  'červenec',
  'srpen',
  'září',
  'říjen',
  'listopad',
  'prosinec',
];
const DNY_KRATCE = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];

/** Barva obdélníčku podle toho, jak je den zaplněný. */
function odstin(p: number | null): React.CSSProperties {
  if (p === null || p <= 0) return { backgroundColor: 'rgb(var(--c-field))' };
  if (p >= 95) return { backgroundColor: '#5c1fe0' };
  if (p >= 70) return { backgroundColor: '#7b55ff' };
  if (p >= 45) return { backgroundColor: 'rgba(123,85,255,0.55)' };
  if (p >= 20) return { backgroundColor: 'rgba(123,85,255,0.32)' };
  return { backgroundColor: 'rgba(123,85,255,0.16)' };
}

export default async function KapacitaPage({ searchParams }: { searchParams?: { rok?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (!canSee('/prehledy', session.user.role)) redirect('/projekty');

  const ted = new Date();
  const rok = Number(searchParams?.rok) || ted.getUTCFullYear();
  const prehled = await nactiKapacituRoku(rok);
  const dnesniMesic = ted.getUTCFullYear() === rok ? ted.getUTCMonth() + 1 : 0;
  const dnesniDen = ted.getUTCDate();

  const soucet = prehled.studia.reduce(
    (a, s) => ({ kapacitaMinut: a.kapacitaMinut + s.kapacitaMinut, natoceno: a.natoceno + s.natoceno }),
    { kapacitaMinut: 0, natoceno: 0 },
  );
  const celkemProcent = procenta(soucet);
  const odkazRoku = (r: number) => `/prehledy/kapacita?rok=${r}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-muted font-body m-0 max-w-2xl">
          Celý rok po dnech. Každý obdélníček je jeden den v jednom studiu — čím tmavší, tím plnější{' '}
          <b>natáčením</b>; prázdné místo je díra. Střih, casting ani blokace se nepočítají. Podrobnosti ukáže najetí
          myší.
        </p>
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

      {/* Která studia jsou ve sloupcích a jak jsou na tom za celý rok */}
      <div className="flex items-center gap-x-5 gap-y-2 flex-wrap bg-surface rounded-card border border-line shadow-sm px-4 py-3">
        {prehled.studia.map((s, i) => {
          const p = procenta(s);
          return (
            <span key={s.id} className="inline-flex items-center gap-2 text-sm font-heading text-ink">
              <span
                className="w-5 h-5 rounded grid place-items-center text-[10px] font-bold text-white shrink-0"
                style={{ background: s.barva }}
              >
                {i + 1}
              </span>
              {s.nazev}
              <span className="font-body text-muted tabular-nums">
                {p === null ? '—' : `${p} %`} · {hodiny(s.natoceno)} h · {s.dnuSNatacenim} dnů
              </span>
            </span>
          );
        })}
        <span className="ml-auto text-sm font-heading text-ink tabular-nums">
          Rok {rok}: {celkemProcent === null ? '—' : `${celkemProcent} %`}
          <span className="font-body text-muted"> ({hodiny(soucet.natoceno)} z {hodiny(soucet.kapacitaMinut)} h)</span>
        </span>
      </div>

      {/* Dvanáct měsíců vedle sebe - celý rok na jedné obrazovce */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {prehled.mesice.map((m) => {
          const pMesic = procenta(m);
          return (
            <div key={m.mesic} className="bg-surface rounded-card border border-line shadow-sm p-2.5">
              <p
                className={`text-xs font-heading font-semibold m-0 mb-1.5 flex items-baseline justify-between gap-2 ${
                  m.mesic === dnesniMesic ? 'text-brand-purple' : 'text-ink'
                }`}
              >
                {MESICE[m.mesic - 1]}
                <span className="font-body text-[11px] text-muted tabular-nums">
                  {pMesic === null ? '—' : `${pMesic} %`}
                </span>
              </p>

              {/* Mřížka dnů se drží uprostřed karty, ať pruh víkendu končí
                  u posledního obdélníčku a nejede přes celou kartu. */}
              <div className="w-fit mx-auto">
              {/* Záhlaví: pořadová čísla studií podle legendy nahoře */}
              <div className="flex items-center gap-[3px] pl-5 mb-[3px]">
                {prehled.studia.map((s, i) => (
                  <span
                    key={s.id}
                    title={s.nazev}
                    className="w-4 text-[9px] font-heading text-center text-muted leading-none"
                  >
                    {i + 1}
                  </span>
                ))}
              </div>

              <div className="flex flex-col gap-[2px]">
                {m.dny.map((d) => {
                  const dnes = m.mesic === dnesniMesic && d.den === dnesniDen;
                  return (
                    <div
                      key={d.den}
                      className={`flex items-center gap-[3px] rounded-sm ${d.vikend ? 'bg-surfaceSoft' : ''} ${
                        dnes ? 'outline outline-1 outline-brand-purple' : ''
                      }`}
                    >
                      <span
                        className={`w-5 pr-1 text-[9px] font-heading text-right tabular-nums leading-none ${
                          dnes ? 'text-brand-purple font-bold' : d.vikend ? 'text-muted' : 'text-muted/70'
                        }`}
                      >
                        {d.den}
                      </span>
                      {d.bunky.map((b, i) => {
                        const p = procenta(b);
                        const studio = prehled.studia[i];
                        return (
                          <span
                            key={studio.id}
                            className={`w-4 h-[9px] rounded-[2px] ${
                              b.kapacitaMinut === 0 && b.natoceno === 0 ? 'opacity-30' : ''
                            }`}
                            style={odstin(p)}
                            title={`${DNY_KRATCE[d.denVTydnu]} ${d.den}. ${MESICE[m.mesic - 1]} · ${studio.nazev}: ${
                              b.natoceno > 0
                                ? `${hodiny(b.natoceno)} h natáčení (${b.pocet}×)${
                                    b.kapacitaMinut > 0 ? ` z ${hodiny(b.kapacitaMinut)} h` : ', mimo otevírací dobu'
                                  }`
                                : b.kapacitaMinut > 0
                                  ? `volno, ${hodiny(b.kapacitaMinut)} h k dispozici`
                                  : 'zavřeno / jen po domluvě'
                            }`}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap text-xs font-body text-muted">
        <span>Zaplněnost dne:</span>
        {[
          { popis: 'volno', p: 0 },
          { popis: 'do 20 %', p: 10 },
          { popis: 'do 45 %', p: 30 },
          { popis: 'do 70 %', p: 50 },
          { popis: 'do 95 %', p: 80 },
          { popis: 'plno', p: 100 },
        ].map((l) => (
          <span key={l.popis} className="inline-flex items-center gap-1.5">
            <span className="w-5 h-3 rounded-[2px] border border-line" style={odstin(l.p)} aria-hidden />
            {l.popis}
          </span>
        ))}
        <span className="ml-auto max-w-2xl text-right">
          Čísla ve sloupcích odpovídají studiím v legendě nahoře. Kapacita je otevírací doba studia (Administrace →
          Studia); dny „jen po domluvě" (obvykle víkendy) kapacitu nemají — natáčení v nich je vidět, ale do procent se
          nepočítá.
        </span>
      </div>
    </div>
  );
}
