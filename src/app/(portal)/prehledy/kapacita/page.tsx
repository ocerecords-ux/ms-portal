import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { smiNaStranku } from '@/lib/pristupyServer';
import { hodiny, nactiKapacituRoku, procenta } from '@/lib/kapacitaServer';
import { analyzaRoku } from '@/lib/kapacitaAnalyzy';
import { Analyzy } from './Analyzy';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit, prelozitKolem, prelozitS } from '@/lib/jazyk';

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
  // Rozhodují zaškrtávátka z karty, ne jen role (6. 10. 2026) - viz
  // lib/pristupyServer.ts.
  if (!(await smiNaStranku({ id: session.user.id, role: session.user.role }, '/prehledy/kapacita'))) {
    redirect('/projekty');
  }

  const jazyk = nactiJazyk();
  // Nazvy mesicu a dnu jsou ve slovniku (obecne.mesic.*), ne v poli natvrdo.
  const mesicNazev = (m: number) => prelozit(jazyk, `obecne.mesic.${m}`);
  const mesicKratce = (m: number) => prelozit(jazyk, `obecne.mesicKratce.${m}`);
  const denKratce = (d: number) => prelozit(jazyk, `obecne.denKratce.${d}`);

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
  // Grafy pod mřížkou (20. 9. 2026) - počítají se z téhož ročního přehledu,
  // takže to nestojí ani jeden dotaz do databáze navíc.
  const analyza = analyzaRoku(prehled);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-muted font-body m-0 max-w-2xl">
          {(() => {
            const [pred, za] = prelozitKolem(jazyk, 'kapacita.uvodPredTucnym', 'tucne');
            return (
              <>
                {pred}
                <b>{prelozit(jazyk, 'kapacita.natacenia')}</b>
                {za}
              </>
            );
          })()}
        </p>
        <div className="flex items-center gap-1">
          <Link
            href={predchozi}
            className="rounded-pill border border-line px-3 py-1.5 text-sm font-heading text-ink no-underline hover:border-brand-purple"
          >
            ‹
          </Link>
          <span className="rounded-pill bg-brand-purple text-white px-4 py-1.5 text-sm font-heading font-semibold">
            {prelozitS(jazyk, 'kapacita.mesicRok', { mesic: mesicNazev(mesic), rok })}
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
              title={prelozitS(jazyk, 'kapacita.bublinaMesice', {
                mesic: mesicNazev(m.mesic),
                rok,
                hodin: hodiny(m.natoceno),
              })}
              className={`rounded-lg px-2.5 py-1 text-xs font-heading no-underline border tabular-nums ${
                vybrany ? 'border-brand-purple text-ink' : 'border-line text-muted hover:text-ink'
              }`}
            >
              {mesicKratce(m.mesic)} <span className="opacity-70">{p === null ? '—' : `${p} %`}</span>
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
            {prelozitS(jazyk, 'kapacita.mesicRok', { mesic: mesicNazev(mesic), rok })}
          </span>
          <span className="text-sm font-body text-muted tabular-nums">
            {prelozitS(jazyk, 'kapacita.obsazenost', {
              procenta: pMesic === null ? '—' : `${pMesic} %`,
              natoceno: hodiny(otevreny.natoceno),
              kapacita: hodiny(otevreny.kapacitaMinut),
            })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[420px]">
            {/* Záhlaví: studio a pod ním jeho frekvence (9-13, 13-17) */}
            <div className="flex items-end gap-3 pb-2 border-b border-line">
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
                      {p === null ? '—' : `${p} %`} ·{' '}
                      {prelozitS(jazyk, 'kapacita.dnu', { pocet: s.dnuSNatacenim })}
                    </span>
                    <span className="flex gap-1 mt-1">
                      {s.frekvence.map((f) => (
                        <span
                          key={f.popis}
                          className="flex-1 text-[10px] font-heading text-muted text-center tabular-nums"
                        >
                          {f.popis}
                        </span>
                      ))}
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
                    className={`flex items-center gap-3 rounded ${d.vikend ? 'bg-surfaceSoft' : ''} ${
                      dnes ? 'outline outline-1 outline-brand-purple' : ''
                    }`}
                  >
                    <span
                      className={`w-16 shrink-0 pl-1 text-[11px] font-heading tabular-nums leading-none ${
                        dnes ? 'text-brand-purple font-bold' : d.vikend ? 'text-muted' : 'text-ink'
                      }`}
                    >
                      {denKratce(d.denVTydnu)} {d.den}.
                    </span>
                    {d.bunky.map((b, i) => {
                      const studio = prehled.studia[i];
                      return (
                        <span key={studio.id} className="flex-1 min-w-0 flex gap-1">
                          {b.casti.map((c, k) => {
                            const okno = studio.frekvence[k];
                            // Zaplněnost se měří k oknu frekvence: čtyři hodiny
                            // natáčení v okně 9-13 je plno.
                            const p = procenta({
                              kapacitaMinut: c.kapacitaMinut > 0 ? c.kapacitaMinut : c.oknoMinut,
                              natoceno: c.natoceno,
                            });
                            return (
                              <span
                                key={okno.popis}
                                className={`flex-1 min-w-0 h-3.5 rounded-[3px] ${
                                  c.kapacitaMinut === 0 && c.natoceno === 0 ? 'opacity-30' : ''
                                }`}
                                style={odstin(p)}
                                title={prelozitS(jazyk, 'kapacita.bublinaBunky', {
                                  den: denKratce(d.denVTydnu),
                                  cislo: d.den,
                                  mesic: mesicNazev(mesic),
                                  studio: studio.nazev,
                                  okno: okno.popis,
                                  stav:
                                    c.natoceno > 0
                                      ? prelozitS(
                                          jazyk,
                                          c.kapacitaMinut > 0
                                            ? 'kapacita.stavNatoceno'
                                            : 'kapacita.stavNatocenoMimo',
                                          { hodin: hodiny(c.natoceno), pocet: c.pocet },
                                        )
                                      : prelozit(
                                          jazyk,
                                          c.kapacitaMinut > 0 ? 'kapacita.stavVolno' : 'kapacita.stavZavreno',
                                        ),
                                })}
                              />
                            );
                          })}
                        </span>
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
        <span>{prelozit(jazyk, 'kapacita.zaplnenostDne')}</span>
        {[
          { klic: 'kapacita.legendaVolno', p: 0 },
          { klic: 'kapacita.legendaDo20', p: 10 },
          { klic: 'kapacita.legendaDo45', p: 30 },
          { klic: 'kapacita.legendaDo70', p: 50 },
          { klic: 'kapacita.legendaDo95', p: 80 },
          { klic: 'kapacita.legendaPlno', p: 100 },
        ].map((l) => (
          <span key={l.klic} className="inline-flex items-center gap-1.5">
            <span className="w-6 h-3 rounded-[3px] border border-line" style={odstin(l.p)} aria-hidden />
            {prelozit(jazyk, l.klic)}
          </span>
        ))}
        <span className="ml-auto max-w-2xl text-right">{prelozit(jazyk, 'kapacita.poznamkaKapacity')}</span>
      </div>

      {/* Grafy a data ke stažení - pod mřížkou (zadání 20. 9. 2026). */}
      <Analyzy
        jazyk={jazyk}
        analyza={analyza}
        studia={prehled.studia.map((s) => ({ id: s.id, nazev: s.nazev, barva: s.barva }))}
        rok={rok}
      />
    </div>
  );
}
