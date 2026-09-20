import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canSee } from '@/lib/menu';
import { hodiny, nactiKapacituMesice, procenta } from '@/lib/kapacitaServer';

/**
 * KAPACITA STUDIÍ (zadání 20. 9. 2026: „potřebuji vidět jasně, kolik a které
 * dny z toho měsíce jsou obsazeny. Takže spíš jednotlivá studia jako sloupce
 * a pod nimi dny. Vyznačit víkendy").
 *
 * Měsíc den po dni: řádek = den, sloupec = studio, v buňce natočené hodiny a
 * barva podle toho, jak je den zaplněný. Víkendy mají svůj podklad a jsou
 * popsané, dnešek rámeček. Nad tabulkou je proužek dvanácti měsíců, ať jde
 * skočit na ten vytížený.
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

/** Barva buňky podle toho, jak je den zaplněný. */
function odstin(p: number | null): { trida: string; styl?: React.CSSProperties } {
  if (p === null || p <= 0) return { trida: 'text-muted' };
  if (p >= 95) return { trida: 'text-white', styl: { backgroundColor: '#6b2af0' } };
  if (p >= 70) return { trida: 'text-white', styl: { backgroundColor: '#7b55ff' } };
  if (p >= 45) return { trida: 'text-ink', styl: { backgroundColor: 'rgba(123,85,255,0.45)' } };
  if (p >= 20) return { trida: 'text-ink', styl: { backgroundColor: 'rgba(123,85,255,0.24)' } };
  return { trida: 'text-ink', styl: { backgroundColor: 'rgba(123,85,255,0.12)' } };
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
  const dnesniRok = ted.getUTCFullYear();
  const rok = Number(searchParams?.rok) || dnesniRok;
  const zadanyMesic = Number(searchParams?.mesic);
  const mesic = zadanyMesic >= 1 && zadanyMesic <= 12 ? zadanyMesic : ted.getUTCMonth() + 1;
  const prehled = await nactiKapacituMesice(rok, mesic);

  const odkaz = (r: number, m: number) => `/prehledy/kapacita?rok=${r}&mesic=${m}`;
  const predchozi = mesic === 1 ? odkaz(rok - 1, 12) : odkaz(rok, mesic - 1);
  const dalsi = mesic === 12 ? odkaz(rok + 1, 1) : odkaz(rok, mesic + 1);
  const dnesniDatum = `${dnesniRok}-${String(ted.getUTCMonth() + 1).padStart(2, '0')}-${String(
    ted.getUTCDate(),
  ).padStart(2, '0')}`;

  const soucet = prehled.studia.reduce(
    (a, s) => ({
      kapacitaMinut: a.kapacitaMinut + s.kapacitaMinut,
      natoceno: a.natoceno + s.natoceno,
    }),
    { kapacitaMinut: 0, natoceno: 0 },
  );
  const celkemProcent = procenta(soucet);
  const dnuSNatacenim = prehled.dny.filter((d) => d.bunky.some((b) => b.natoceno > 0)).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-muted font-body m-0 max-w-xl">
          Které dny jsou ve studiích zabrané <b>natáčením</b> a kolik hodin z otevírací doby zbývá. Střih, casting ani
          blokace se nepočítají.
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
        <Link
          href={odkaz(rok - 1, mesic)}
          className="text-sm font-heading text-muted no-underline hover:text-ink px-1"
        >
          ‹ {rok - 1}
        </Link>
        {prehled.rokPoMesicich.map((m) => {
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
        <Link
          href={odkaz(rok + 1, mesic)}
          className="text-sm font-heading text-muted no-underline hover:text-ink px-1"
        >
          {rok + 1} ›
        </Link>
      </div>

      {/* Souhrn za zobrazený měsíc */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { popis: 'Natočeno', hodnota: `${hodiny(soucet.natoceno)} h` },
          { popis: 'Kapacita', hodnota: `${hodiny(soucet.kapacitaMinut)} h` },
          { popis: 'Obsazenost', hodnota: celkemProcent === null ? '—' : `${celkemProcent} %` },
          { popis: 'Dnů s natáčením', hodnota: `${dnuSNatacenim} z ${prehled.dny.length}` },
        ].map((k) => (
          <div key={k.popis} className="bg-surface rounded-card border border-line shadow-sm p-4">
            <p className="text-xs font-heading uppercase tracking-wide text-muted m-0">{k.popis}</p>
            <p className="font-display text-2xl sm:text-3xl text-ink m-0 mt-1 tabular-nums">{k.hodnota}</p>
          </div>
        ))}
      </div>

      {/* Mapa měsíce: řádek den, sloupec studio */}
      <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left text-[11px] font-heading uppercase tracking-wide text-muted px-4 py-3 w-28">
                  Den
                </th>
                {prehled.studia.map((s) => (
                  <th key={s.id} className="px-2 py-3 text-center">
                    <span className="inline-flex items-center gap-2 font-heading font-semibold text-ink text-sm">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.barva }} />
                      {s.nazev}
                    </span>
                    <span className="block text-[11px] font-body text-muted tabular-nums mt-0.5">
                      {hodiny(s.natoceno)} / {hodiny(s.kapacitaMinut)} h
                    </span>
                  </th>
                ))}
                <th className="text-right text-[11px] font-heading uppercase tracking-wide text-muted px-4 py-3">
                  Den celkem
                </th>
              </tr>
            </thead>
            <tbody>
              {prehled.dny.map((d) => {
                const denCelkem = d.bunky.reduce((a, b) => a + b.natoceno, 0);
                const dnes = d.datum === dnesniDatum;
                return (
                  <tr
                    key={d.datum}
                    className={`border-t border-line ${d.vikend ? 'bg-surfaceSoft' : ''} ${
                      dnes ? 'outline outline-1 outline-brand-purple' : ''
                    }`}
                  >
                    <td className="px-4 py-1.5 whitespace-nowrap">
                      <span
                        className={`font-heading text-sm tabular-nums ${
                          d.vikend ? 'text-muted' : 'text-ink'
                        } ${dnes ? 'font-bold text-brand-purple' : ''}`}
                      >
                        {DNY_KRATCE[d.denVTydnu]} {d.den}.
                      </span>
                      {d.vikend && <span className="ml-1.5 text-[10px] font-body text-muted">víkend</span>}
                    </td>
                    {d.bunky.map((b) => {
                      const p = procenta(b);
                      const { trida, styl } = odstin(p);
                      const popisDne = `${DNY_KRATCE[d.denVTydnu]} ${d.den}. ${MESICE[mesic - 1]}`;
                      return (
                        <td key={b.studioId} className="px-1.5 py-1">
                          <div
                            className={`rounded-lg h-8 grid place-items-center leading-none ${trida} ${
                              b.natoceno === 0 && b.kapacitaMinut === 0 ? 'opacity-40' : ''
                            }`}
                            style={styl}
                            title={
                              b.natoceno > 0
                                ? `${popisDne}: ${hodiny(b.natoceno)} h natáčení (${b.pocet}×)${
                                    b.kapacitaMinut > 0
                                      ? ` z ${hodiny(b.kapacitaMinut)} h otevírací doby`
                                      : ', mimo otevírací dobu'
                                  }`
                                : b.kapacitaMinut > 0
                                  ? `${popisDne}: volno (${hodiny(b.kapacitaMinut)} h k dispozici)`
                                  : `${popisDne}: zavřeno / jen po domluvě`
                            }
                          >
                            <span className="text-xs font-heading font-semibold tabular-nums">
                              {b.natoceno > 0 ? `${hodiny(b.natoceno)} h` : b.kapacitaMinut > 0 ? '' : '·'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-1.5 text-right whitespace-nowrap">
                      <span
                        className={`font-heading text-sm tabular-nums ${denCelkem > 0 ? 'text-ink' : 'text-muted'}`}
                      >
                        {denCelkem > 0 ? `${hodiny(denCelkem)} h` : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-line bg-surfaceSoft">
                <td className="px-4 py-2.5 font-heading font-semibold text-ink text-sm">Měsíc</td>
                {prehled.studia.map((s) => {
                  const p = procenta(s);
                  return (
                    <td key={s.id} className="px-1.5 py-2.5 text-center">
                      <span className="font-heading font-semibold text-ink text-sm tabular-nums">
                        {p === null ? '—' : `${p} %`}
                      </span>
                      <span className="block text-[11px] font-body text-muted tabular-nums">
                        {s.dnuSNatacenim} dnů
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-right font-heading font-semibold text-ink tabular-nums">
                  {hodiny(soucet.natoceno)} h
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-xs font-body text-muted">
        <span>Zaplněnost dne:</span>
        {[
          { popis: 'volno', styl: undefined as React.CSSProperties | undefined },
          { popis: 'do 20 %', styl: { backgroundColor: 'rgba(123,85,255,0.12)' } },
          { popis: 'do 45 %', styl: { backgroundColor: 'rgba(123,85,255,0.24)' } },
          { popis: 'do 70 %', styl: { backgroundColor: 'rgba(123,85,255,0.45)' } },
          { popis: 'do 95 %', styl: { backgroundColor: '#7b55ff' } },
          { popis: 'plno', styl: { backgroundColor: '#6b2af0' } },
        ].map((l) => (
          <span key={l.popis} className="inline-flex items-center gap-1.5">
            <span
              className={`w-5 h-4 rounded ${l.styl ? '' : 'border border-line'}`}
              style={l.styl}
              aria-hidden
            />
            {l.popis}
          </span>
        ))}
        <span className="ml-auto max-w-xl text-right">
          Kapacita je otevírací doba studia (Administrace → Studia). Dny „jen po domluvě" (obvykle víkendy) kapacitu
          nemají — natáčení v nich je vidět, ale do procent se nepočítá. Tečka znamená zavřeno.
        </span>
      </div>
    </div>
  );
}
