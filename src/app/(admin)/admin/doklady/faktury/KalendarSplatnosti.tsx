'use client';

import { formatMoney } from '@/lib/doklady';
import { addDays, nazevDneKratce, startOfWeek } from '@/lib/calendar';
import { usePreklad, useJazyk } from '@/app/(portal)/components/JazykProvider';
import type { FakturaRadek } from './FakturyTabulka';

/**
 * KALENDÁŘ SPLATNOSTÍ PO TÝDNECH (zadání 7. 10. 2026: „chtěl bych mít možnost
 * zobrazit splatnosti faktur v jednoduchém kalendáři po týdnech… takový
 * vizuální přehled").
 *
 * VIDÍ HO JEN SUPERADMIN. Nerozhoduje o tom tahle komponenta - stránka ji
 * vůbec nevykreslí a přepínač se nikomu jinému ani nenabídne (viz page.tsx
 * a jsemSuperadmin v lib/pristupyServer.ts). Čísla samotná nejsou tajná:
 * tytéž částky i splatnosti stojí v tabulce, kterou v sekci Doklady vidí
 * celé Žůžo-labůžo. Tajný je tenhle pohled, ne data pod ním.
 *
 * JEN ČÁSTKY, NIC VÍC (zadání: „stačí jen částky jako záznamy"). Dva součty:
 * u dne, když na něj padnou aspoň dvě faktury, a u každého týdne.
 *
 * MĚNY SE NESČÍTAJÍ DOHROMADY. Kurz se mění a sečíst koruny s eury by dalo
 * číslo, které neplatí ani dnes, ani v den splatnosti - součty jsou proto
 * po měnách vedle sebe.
 *
 * Vypíšou se všechny týdny od nejbližší splatnosti po tu nejvzdálenější,
 * i ty prázdné mezi tím - mezera je taky informace.
 */

/** Pondělí daného týdne jako klíč „2026-10-06". */
function klicDne(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Součty po měnách, protože koruny s eury se sčítat nedají. */
function souctyPoMenach(radky: FakturaRadek[]): { mena: FakturaRadek['mena']; minor: number }[] {
  const mapa = new Map<FakturaRadek['mena'], number>();
  for (const r of radky) mapa.set(r.mena, (mapa.get(r.mena) ?? 0) + r.castkaMinor);
  return [...mapa.entries()].map(([mena, minor]) => ({ mena, minor }));
}

export function KalendarSplatnosti({ radky }: { radky: FakturaRadek[] }) {
  const t = usePreklad();
  const jazyk = useJazyk();

  const souhrn = (kus: FakturaRadek[]) =>
    souctyPoMenach(kus)
      .map((s) => formatMoney(s.minor, s.mena, jazyk))
      .join(' · ');

  const sDatem = radky.filter((r) => r.splatnostMs !== null);
  const bezData = radky.filter((r) => r.splatnostMs === null);

  // Faktury pod den, pod kterým mají splatnost.
  const poDnech = new Map<string, FakturaRadek[]>();
  for (const r of sDatem) {
    const klic = klicDne(new Date(r.splatnostMs as number));
    poDnech.set(klic, [...(poDnech.get(klic) ?? []), r]);
  }

  const dnesek = new Date();
  dnesek.setHours(0, 0, 0, 0);
  const klicDneska = klicDne(dnesek);

  const casy = sDatem.map((r) => r.splatnostMs as number);
  const prvni = casy.length > 0 ? startOfWeek(new Date(Math.min(...casy))) : null;
  const posledni = casy.length > 0 ? startOfWeek(new Date(Math.max(...casy))) : null;

  const tydny: Date[] = [];
  if (prvni && posledni) {
    // Pojistka proti nesmyslnému datu v datech - radši useknout než zamrznout.
    for (let d = prvni, i = 0; d <= posledni && i < 260; d = addDays(d, 7), i += 1) {
      tydny.push(d);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {tydny.length === 0 && (
        <p className="m-0 rounded-card border border-line bg-surface px-6 py-10 text-center font-body text-sm text-muted">
          {t('faktura.kalendarPrazdno')}
        </p>
      )}

      {tydny.map((pondeli) => {
        const dny = Array.from({ length: 7 }, (_, i) => addDays(pondeli, i));
        const vTydnu = dny.flatMap((d) => poDnech.get(klicDne(d)) ?? []);
        const nedele = addDays(pondeli, 6);
        const rozsah = `${pondeli.getDate()}. ${pondeli.getMonth() + 1}. – ${nedele.getDate()}. ${nedele.getMonth() + 1}. ${nedele.getFullYear()}`;

        return (
          <section
            key={klicDne(pondeli)}
            className={`rounded-card border bg-surface ${
              vTydnu.length > 0 ? 'border-line' : 'border-line/50'
            }`}
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
              <span className="font-heading text-sm font-semibold text-ink">{rozsah}</span>
              {vTydnu.length > 0 && (
                <span className="font-heading text-sm tabular-nums text-ink">
                  <span className="mr-2 text-xs font-normal uppercase tracking-wide text-muted">
                    {t('faktura.kalendarCelkem')}
                  </span>
                  {souhrn(vTydnu)}
                </span>
              )}
            </header>

            <div className="grid grid-cols-7">
              {dny.map((den) => {
                const klic = klicDne(den);
                const vDni = poDnech.get(klic) ?? [];
                const jeDnes = klic === klicDneska;
                return (
                  <div
                    key={klic}
                    className={`flex min-h-[86px] flex-col gap-1 border-r border-line/60 p-2 last:border-r-0 ${
                      jeDnes ? 'bg-brand-purple/10' : ''
                    }`}
                  >
                    <span
                      className={`font-heading text-[11px] ${
                        jeDnes ? 'font-semibold text-brand-purple' : 'text-muted'
                      }`}
                    >
                      {nazevDneKratce(den.getDay(), jazyk)} {den.getDate()}.
                    </span>

                    {vDni.map((r) => (
                      <span
                        key={r.id}
                        title={`${r.cislo} · ${r.odberatel}`}
                        className={`block rounded-lg px-1.5 py-1 text-right font-heading text-[11px] tabular-nums ${
                          r.poSplatnosti
                            ? 'bg-danger/15 text-danger'
                            : 'bg-field text-ink'
                        }`}
                      >
                        {formatMoney(r.castkaMinor, r.mena, jazyk)}
                      </span>
                    ))}

                    {/* Součet u dne až od dvou faktur - u jedné by jen opakoval
                        to, co je o řádek výš (zadání 7. 10. 2026). */}
                    {vDni.length > 1 && (
                      <span className="mt-auto border-t border-line pt-1 text-right font-heading text-[11px] font-semibold tabular-nums text-ink">
                        {souhrn(vDni)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Faktury bez vyplněné splatnosti nemají v kalendáři kam, ale ztratit
          se nesmí - stojí proto v pruhu pod ním (zadání 7. 10. 2026). */}
      {bezData.length > 0 && (
        <section className="rounded-card border border-dashed border-line bg-surface">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
            <span className="font-heading text-sm font-semibold text-muted">
              {t('faktura.kalendarBezSplatnosti')}
            </span>
            <span className="font-heading text-sm tabular-nums text-ink">{souhrn(bezData)}</span>
          </header>
          <div className="flex flex-wrap gap-1.5 p-2">
            {bezData.map((r) => (
              <span
                key={r.id}
                title={`${r.cislo} · ${r.odberatel}`}
                className="rounded-lg bg-field px-1.5 py-1 font-heading text-[11px] tabular-nums text-ink"
              >
                {formatMoney(r.castkaMinor, r.mena, jazyk)}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
