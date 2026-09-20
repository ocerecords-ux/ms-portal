import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canSee } from '@/lib/menu';
import { hodiny, nactiKapacituRoku, procenta } from '@/lib/kapacitaServer';

/**
 * KAPACITA STUDIÍ (zadání 20. 9. 2026: „potřebuji to vidět po měsících, ale
 * všechna studia na jedné stránce" + „nemusí tam být ten počet hodin, jen
 * obdélníčky").
 *
 * Jeden měsíc na obrazovku: řádek = den, sloupec = studio, buňka = obdélníček.
 * Čím tmavší, tím plnější natáčením; prázdný obdélníček je díra. Celý měsíc se
 * vejde bez rolování, takže jsou volné dny vidět na první pohled.
 *
 * Nad tabulkou je proužek dvanácti měsíců s procenty - přeskočí se jím na
 * vytížený měsíc a je z něj vidět celý rok.
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
const MESICE_KRATCE = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
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

export default async function KapacitaPage({
  searchParams,
}: {
  searchParams?: { rok?: string; mesic?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (!canSee('/prehledy', session.user.role)) redirect('/projekty');

  const ted = new Date();
  const rok = Number(searchParams?.rok) || ted.getUTCFullYear();
  const zadanyMesic = Number(searchParams?.mesic);
  const mesic = zadanyMesic >= 1 && zadanyMesic <= 12 ? zadanyMesic : ted.getUTCMonth() + 1;

  const prehled = await nactiKapacituRoku(rok);
  const otevreny = prehled.mesice[mesic - 1];

  const dnesniMesic = ted.getUTCFullYear() === rok ? ted.getUTCMonth() + 1 : 0;
  const dnesniDen = ted.getUTCDate();

  const odkaz = (r: number, m: number) => `/prehledy/kapacita?rok=${r}&mesic=${m}`;
  const predchozi = mesic === 1 ? odkaz(rok - 1, 12) : odkaz(rok, mesic - 1);
  const dalsi = mesic === 12 ? odkaz(rok + 1, 1) : odkaz(rok, mesic + 1);

  /** Součty studia za zobrazený měsíc - do záhlaví sloupců. */
  const zaMesic = prehled.studia.map((s, i) => {
    let kapacitaMinut = 0;
    let natoceno = 0;
    let dnu = 0;
    for (const d of otevreny.dny) {
      const b = d.bunky[i];
      kapacitaMinut += b.kapacitaMinut;
      natoceno += b.natoceno;
      if (b.natoceno > 0) dnu += 1;
    }
    return { ...s, kapacitaMinut, natoceno, dnuSNatacenim: dnu };
  });
  const pMesic = procenta(otevreny);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-muted font-body m-0 max-w-2xl">
          Celý měsíc na jedné obrazovce: řádek je den, sloupec studio. Čím tmavší obdélníček, tím víc{' '}
          <b>natáčení</b> proti otevírací době studia — prázdné místo je díra. Střih, casting ani blokace se
          nepočítají; hodiny ukáže najetí myší.
        </p>
        <div className="flex items-center gap-1">
          <Link
            href={predchozi}
            className="rounded-pill border border-line px-3 py-1.5 text-sm font-heading text-ink no-underline hover:border-brand-purple"
          >
            ‹
          </Link>
          <span className="rounded-pill bg-brand-purple text-white px-4 py-1.5 text-sm font-heading font-semibold">
            {MESICE[mesic - 1]} {rok}
          </span>
          <Link
            href={dalsi}
            className="rounded-pill border border-line px-3 py-1.5 text-sm font-heading text-ink no-underline hover:border-brand-purple"
          >
            ›
          </Link>
        </div>
      </div>

      {/* Proužek roku - kam v roce skočit */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Link href={odkaz(rok - 1, mesic)} className="text-sm font-heading text-muted no-underline hover:text-ink px-1">
          ‹ {rok - 1}
        </Link>
        {prehled.mesice.map((m) => {
          const p = procenta(m);
          const vybrany = m.mesic === mesic;
          return (
            <Link
              key={m.mesic}
              href={odkaz(rok, m.mesic)}
              title={`${MESICE[m.mesic - 1]} ${rok}: ${hodiny(m.natoceno)} h natáčení`}
              className={`rounded-lg px-2.5 py-1 text-xs font-heading no-underline border tabular-nums ${
                vybrany ? 'border-brand-purple text-ink' : 'border-line text-muted hover:text-ink'
              }`}
            >
              {MESICE_KRATCE[m.mesic - 1]} <span className="opacity-70">{p === null ? '—' : `${p} %`}</span>
            </Link>
          );
        })}
        <Link href={odkaz(rok + 1, mesic)} className="text-sm font-heading text-muted no-underline hover:text-ink px-1">
          {rok + 1} ›
        </Link>
      </div>

      {/* Měsíc: řádek den, sloupec studio */}
      <div className="bg-surface rounded-card border border-line shadow-sm p-4">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="font-heading font-semibold text-ink">
            {MESICE[mesic - 1]} {rok}
          </span>
          <span className="text-sm font-body text-muted tabular-nums">
            obsazenost {pMesic === null ? '—' : `${pMesic} %`} · {hodiny(otevreny.natoceno)} z{' '}
            {hodiny(otevreny.kapacitaMinut)} h
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[420px]">
            {/* Záhlaví se studii */}
            <div className="flex items-end gap-2 pb-2 border-b border-line">
              <span className="w-16 shrink-0" />
              {zaMesic.map((s) => {
                const p = procenta(s);
                return (
                  <span key={s.id} className="flex-1 min-w-0 text-center">
                    <span className="inline-flex items-center gap-1.5 font-heading font-semibold text-ink text-sm">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.barva }} />
                      {s.nazev}
                    </span>
                    <span className="block text-[11px] font-body text-muted tabular-nums">
                      {p === null ? '—' : `${p} %`} · {s.dnuSNatacenim} dnů
                    </span>
                  </span>
                );
              })}
            </div>

            {/* Dny pod sebou - celý měsíc bez rolování */}
            <div className="flex flex-col gap-[3px] pt-2">
              {otevreny.dny.map((d) => {
                const dnes = mesic === dnesniMesic && d.den === dnesniDen;
                return (
                  <div
                    key={d.den}
                    className={`flex items-center gap-2 rounded ${d.vikend ? 'bg-surfaceSoft' : ''} ${
                      dnes ? 'outline outline-1 outline-brand-purple' : ''
                    }`}
                  >
                    <span
                      className={`w-16 shrink-0 pl-1 text-[11px] font-heading tabular-nums leading-none ${
                        dnes ? 'text-brand-purple font-bold' : d.vikend ? 'text-muted' : 'text-ink'
                      }`}
                    >
                      {DNY_KRATCE[d.denVTydnu]} {d.den}.
                    </span>
                    {d.bunky.map((b, i) => {
                      const p = procenta(b);
                      const studio = prehled.studia[i];
                      return (
                        <span
                          key={studio.id}
                          className={`flex-1 min-w-0 h-3.5 rounded-[3px] ${
                            b.kapacitaMinut === 0 && b.natoceno === 0 ? 'opacity-30' : ''
                          }`}
                          style={odstin(p)}
                          title={`${DNY_KRATCE[d.denVTydnu]} ${d.den}. ${MESICE[mesic - 1]} · ${studio.nazev}: ${
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
            <span className="w-6 h-3 rounded-[3px] border border-line" style={odstin(l.p)} aria-hidden />
            {l.popis}
          </span>
        ))}
        <span className="ml-auto max-w-2xl text-right">
          Kapacita je otevírací doba studia (Administrace → Studia). Dny „jen po domluvě" (obvykle víkendy) kapacitu
          nemají — natáčení v nich je vidět, ale do procent se nepočítá, proto může měsíc přesáhnout 100 %.
        </span>
      </div>
    </div>
  );
}
