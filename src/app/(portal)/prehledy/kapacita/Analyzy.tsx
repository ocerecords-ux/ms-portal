import { hodiny } from '@/lib/kapacitaServer';
import type { AnalyzaRoku } from '@/lib/kapacitaAnalyzy';
import { prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/**
 * ANALÝZY POD MAPOU (zadání 20. 9. 2026: „ať si můžu kdyžtak udělat nějaké
 * analýzy a grafy z obsazenosti studia, třeba někde dole pod tím přehledem").
 *
 * Tři grafy, které mřížka nad tím neukáže: vývoj v roce, silné a slabé dny
 * v týdnu a poměr ranních a odpoledních frekvencí. Pod nimi odkaz na CSV -
 * kdo si chce udělat vlastní tabulku nebo graf v Excelu, má data po dnech.
 *
 * Barva tu nikdy nenese význam sama: u každé hodnoty je číslo i popisek,
 * sloupce mají společnou osu 0-100 % a studia se drží svých barev z
 * kalendáře, ať se přehledy nepletou.
 */

/** Týden začíná pondělím, ne nedělí. */
const PORADI_DNU = [1, 2, 3, 4, 5, 6, 0];

/** Výška sloupce v procentech plochy grafu; přes 100 % se ořízne. */
function vyska(p: number | null): string {
  return `${Math.min(100, Math.max(0, p ?? 0))}%`;
}

export function Analyzy({
  analyza,
  studia,
  rok,
  jazyk = 'cs',
}: {
  analyza: AnalyzaRoku;
  studia: { id: string; nazev: string; barva: string }[];
  rok: number;
  /** Jazyk PROPEM, ne hookem - komponenta se kreslí ze serveru (pravidlo 8). */
  jazyk?: Jazyk;
}) {
  const maData = analyza.mesice.some((m) => m.natoceno > 0);
  // Nazvy mesicu a dnu jsou ve slovniku (obecne.mesic.*), ne v poli natvrdo.
  const mesicNazev = (m: number) => prelozit(jazyk, `obecne.mesic.${m}`);
  const mesicKratce = (m: number) => prelozit(jazyk, `obecne.mesicKratce.${m}`);
  const denNazev = (d: number) => prelozit(jazyk, `obecne.den.${d}`);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-lg text-ink m-0">
          {prelozitS(jazyk, 'analyzy.nadpis', { rok })}
        </h2>
        <a
          href={`/api/prehledy/kapacita-csv?rok=${rok}`}
          className="rounded-pill border border-line px-3.5 py-1.5 text-sm font-heading text-ink no-underline hover:border-brand-purple"
        >
          {prelozit(jazyk, 'analyzy.stahnoutCsv')}
        </a>
      </div>

      {!maData ? (
        <p className="text-sm font-body text-muted m-0">{prelozitS(jazyk, 'analyzy.bezDat', { rok })}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 1. Vývoj v roce */}
          <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-3 lg:col-span-2">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                {prelozit(jazyk, 'analyzy.poMesicich')}
              </h3>
              <span className="text-xs font-body text-muted">
                {analyza.nejsilnejsiMesic &&
                  prelozitS(jazyk, 'analyzy.nejvic', {
                    mesic: mesicNazev(analyza.nejsilnejsiMesic.mesic),
                    procenta: analyza.nejsilnejsiMesic.procenta ?? 0,
                  })}
                {analyza.nejslabsiMesic &&
                  analyza.nejslabsiMesic.mesic !== analyza.nejsilnejsiMesic?.mesic &&
                  ` · ${prelozitS(jazyk, 'analyzy.nejmin', {
                    mesic: mesicNazev(analyza.nejslabsiMesic.mesic),
                    procenta: analyza.nejslabsiMesic.procenta ?? 0,
                  })}`}
              </span>
            </div>

            <div className="flex gap-2">
              {/* Osa 0-100 % */}
              <div className="w-8 shrink-0 h-40 relative text-[10px] font-heading text-muted tabular-nums">
                <span className="absolute right-0 -top-1.5">100 %</span>
                <span className="absolute right-0 top-1/2 -translate-y-1/2">50 %</span>
                <span className="absolute right-0 -bottom-1.5">0</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-40 flex items-end gap-1.5 border-b border-line relative">
                  {/* Vodorovné linky mřížky */}
                  <span className="absolute left-0 right-0 top-0 border-t border-line/60" aria-hidden />
                  <span className="absolute left-0 right-0 top-1/2 border-t border-line/60" aria-hidden />
                  {analyza.mesice.map((m) => (
                    <div key={m.mesic} className="flex-1 flex items-end justify-center gap-[2px] h-full">
                      {m.studia.map((s, i) => (
                        <span
                          key={s.id}
                          className="flex-1 rounded-t-[2px] min-w-[3px]"
                          style={{ height: vyska(s.procenta), background: studia[i]?.barva ?? '#7B55FF' }}
                          title={prelozitS(jazyk, 'analyzy.bublinaMesice', {
                            studio: studia[i]?.nazev ?? '',
                            mesic: mesicNazev(m.mesic),
                            stav: s.procenta === null ? prelozit(jazyk, 'analyzy.zavreno') : `${s.procenta} %`,
                            hodin: hodiny(s.natoceno),
                          })}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5 mt-1">
                  {analyza.mesice.map((m) => (
                    <span
                      key={m.mesic}
                      className="flex-1 text-center text-[10px] font-heading text-muted tabular-nums"
                    >
                      {mesicKratce(m.mesic)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {studia.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-2 text-xs font-heading text-muted">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.barva }} />
                  {s.nazev}
                </span>
              ))}
            </div>
          </div>

          {/* 2. Dny v týdnu */}
          <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-3">
            <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              {prelozit(jazyk, 'analyzy.podleDne')}
            </h3>
            <div className="flex flex-col gap-1.5">
              {PORADI_DNU.map((den) => {
                const b = analyza.dnyVTydnu[den];
                const vikend = den === 0 || den === 6;
                return (
                  <div key={den} className="flex items-center gap-2">
                    <span
                      className={`w-16 shrink-0 text-xs font-heading ${vikend ? 'text-muted' : 'text-ink'}`}
                    >
                      {denNazev(den)}
                    </span>
                    <span className="flex-1 h-4 rounded bg-field overflow-hidden">
                      <span
                        className="block h-full rounded"
                        style={{
                          width: vyska(b.procenta),
                          background: vikend ? 'rgba(123,85,255,0.45)' : '#7b55ff',
                        }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs font-body text-muted tabular-nums">
                      {b.procenta === null ? '—' : `${b.procenta} %`} · {hodiny(b.natoceno)} h
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs font-body text-muted m-0">{prelozit(jazyk, 'analyzy.poznamkaDny')}</p>
          </div>

          {/* 3. Ranní vs odpolední frekvence */}
          <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-3">
            <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              {prelozit(jazyk, 'analyzy.frekvence')}
            </h3>
            <div className="flex flex-col gap-3">
              {analyza.frekvence.map((f) => (
                <div key={f.studioId} className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-2 text-xs font-heading text-ink">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: f.barva }} />
                    {f.nazev}
                  </span>
                  {f.okna.map((o) => (
                    <div key={o.popis} className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-[11px] font-heading text-muted tabular-nums">
                        {o.popis}
                      </span>
                      <span className="flex-1 h-3.5 rounded bg-field overflow-hidden">
                        <span
                          className="block h-full rounded"
                          style={{ width: vyska(o.procenta), background: f.barva }}
                        />
                      </span>
                      <span className="w-20 shrink-0 text-right text-[11px] font-body text-muted tabular-nums">
                        {o.procenta === null ? '—' : `${o.procenta} %`} · {hodiny(o.natoceno)} h
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-xs font-body text-muted m-0">{prelozit(jazyk, 'analyzy.poznamkaFrekvence')}</p>
          </div>

          {/* 4. Jak dopadly otevřené dny */}
          <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-3 lg:col-span-2">
            <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              {prelozit(jazyk, 'analyzy.otevreneDny')}
            </h3>
            {(() => {
              const v = analyza.vyuziti;
              const celkem = v.plno + v.castecne + v.volno;
              const dil = (n: number) => (celkem > 0 ? Math.round((n / celkem) * 100) : 0);
              const casti = [
                { popis: prelozit(jazyk, 'analyzy.plno'), pocet: v.plno, barva: '#5c1fe0' },
                { popis: prelozit(jazyk, 'analyzy.castecne'), pocet: v.castecne, barva: 'rgba(123,85,255,0.45)' },
                { popis: prelozit(jazyk, 'analyzy.volno'), pocet: v.volno, barva: 'rgb(var(--c-field))' },
              ];
              return (
                <>
                  <div className="flex h-5 rounded-lg overflow-hidden border border-line">
                    {casti.map((c) => (
                      <span
                        key={c.popis}
                        style={{ width: `${dil(c.pocet)}%`, background: c.barva }}
                        title={prelozitS(jazyk, 'analyzy.bublinaVyuziti', {
                          popis: c.popis,
                          pocet: c.pocet,
                          procenta: dil(c.pocet),
                        })}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-5 flex-wrap">
                    {casti.map((c) => (
                      <span key={c.popis} className="inline-flex items-center gap-2 text-xs font-heading text-muted">
                        <span
                          className="w-3 h-3 rounded-sm border border-line"
                          style={{ background: c.barva }}
                          aria-hidden
                        />
                        {c.popis}
                        <span className="text-ink tabular-nums">
                          {prelozitS(jazyk, 'analyzy.dnuProcenta', { pocet: c.pocet, procenta: dil(c.pocet) })}
                        </span>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs font-body text-muted m-0">
                    {prelozitS(jazyk, 'analyzy.poznamkaVyuziti', { celkem, rok })}
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}
