'use client';

import { useState } from 'react';
import { BARVY, kc, kcKratce } from './format';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import type { Jazyk } from '@/lib/jazyk';

type Mesic = {
  klic: string;
  popis: string;
  nataceni: number;
  strih: number;
  /** Opravy a přetáčky (30. 9. 2026) - vlastní rozpočet nemají, ale mzdy stojí. */
  opravy: number;
  ostatni: number;
  knih: number;
};

/** Hezké dělení osy: 0, 50 tis., 100 tis.… Stejné jako u grafu obratu. */
function osa(max: number): { nahore: number; znacky: number[] } {
  const hrubyKrok = Math.max(max, 1) / 4;
  const rad = 10 ** Math.floor(Math.log10(hrubyKrok));
  const krok = [1, 2, 2.5, 5, 10].map((k) => k * rad).find((k) => k >= hrubyKrok) ?? 10 * rad;
  const nahore = Math.ceil(max / krok) * krok || krok;
  const znacky: number[] = [];
  for (let v = 0; v <= nahore + krok / 2; v += krok) znacky.push(v);
  return { nahore, znacky };
}

/**
 * MZDOVÉ NÁKLADY PO MĚSÍCÍCH, ROZDĚLENÉ NA DRUHY PRÁCE (zadání 28. 9. 2026:
 * „na kolik se vyčerpaly rozpočty, za co (střih, natáčení)").
 *
 * Skládaný sloupec, ne tři vedle sebe: hlavní otázka je „kolik nás ten měsíc
 * stál celkem", rozpad je až druhá. Počet odevzdaných knih tu schválně NENÍ -
 * jsou to kusy, ne koruny, a dvě osy v jednom grafu se nedají číst. Knihy mají
 * vlastní graf pod tímhle.
 *
 * Mezi segmenty je dvoupixelová mezera v barvě karty, ať jdou rozeznat i tam,
 * kde na sebe sedí dva podobné odstíny.
 */
export function GrafPrace({ mesice }: { mesice: Mesic[] }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const [aktivni, setAktivni] = useState<number | null>(null);
  const [tabulka, setTabulka] = useState(false);

  const soucet = (m: Mesic) => m.nataceni + m.strih + m.opravy + m.ostatni;
  const { nahore, znacky } = osa(Math.max(...mesice.map(soucet), 0));
  const n = Math.max(mesice.length, 1);
  const kazdyDruhy = n > 12;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 flex-wrap text-xs font-heading text-muted">
        <Legenda barva={BARVY.nataceni}>{t('knihy.nataceni')}</Legenda>
        <Legenda barva={BARVY.strih}>{t('knihy.strih')}</Legenda>
        <Legenda barva={BARVY.opravy}>{t('knihy.opravy')}</Legenda>
        <Legenda barva={BARVY.ostatni}>{t('knihy.ostatni')}</Legenda>
        <button
          type="button"
          onClick={() => setTabulka((t) => !t)}
          className="ml-auto text-xs font-heading font-semibold text-brand-purple bg-transparent border-0"
        >
          {t(tabulka ? 'finance.zobrazitGraf' : 'finance.zobrazitTabulku')}
        </button>
      </div>

      {tabulka ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body border-collapse">
            <thead>
              <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                <th className="text-left py-2 pr-3">{t('knihy.mesic')}</th>
                <th className="text-right py-2 px-3">{t('knihy.nataceni')}</th>
                <th className="text-right py-2 px-3">{t('knihy.strih')}</th>
                <th className="text-right py-2 px-3">{t('knihy.opravy')}</th>
                <th className="text-right py-2 px-3">{t('knihy.ostatni')}</th>
                <th className="text-right py-2 pl-3">{t('knihy.celkem')}</th>
              </tr>
            </thead>
            <tbody>
              {mesice.map((m) => (
                <tr key={m.klic} className="border-t border-line">
                  <td className="py-1.5 pr-3 text-ink">{m.popis}</td>
                  <td className="text-right py-1.5 px-3 tabular-nums">{kc(m.nataceni, jazyk)}</td>
                  <td className="text-right py-1.5 px-3 tabular-nums">{kc(m.strih, jazyk)}</td>
                  <td className="text-right py-1.5 px-3 tabular-nums">{kc(m.opravy, jazyk)}</td>
                  <td className="text-right py-1.5 px-3 tabular-nums">{kc(m.ostatni, jazyk)}</td>
                  <td className="text-right py-1.5 pl-3 tabular-nums font-heading">{kc(soucet(m), jazyk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative w-14 shrink-0 h-64 text-[11px] font-body text-muted tabular-nums">
            {znacky.map((v) => (
              <span
                key={v}
                className="absolute right-0 -translate-y-1/2"
                style={{ top: `${100 - (v / nahore) * 100}%` }}
              >
                {kcKratce(v, jazyk)}
              </span>
            ))}
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="relative h-64" onMouseLeave={() => setAktivni(null)}>
              {znacky.map((v) => (
                <span
                  key={v}
                  className={`absolute left-0 right-0 h-px ${v === 0 ? 'bg-muted opacity-50' : 'bg-line'}`}
                  style={{ top: `${100 - (v / nahore) * 100}%` }}
                />
              ))}

              <div className="absolute inset-0 flex">
                {mesice.map((m, i) => (
                  <div
                    key={m.klic}
                    className={`relative flex-1 cursor-default ${aktivni === i ? 'bg-tint' : ''}`}
                    onMouseEnter={() => setAktivni(i)}
                    onClick={() => setAktivni(aktivni === i ? null : i)}
                  >
                    <div className="absolute inset-x-0 bottom-0 top-0 flex justify-center items-end px-[14%]">
                      {/* Zdola nahoru: natáčení, střih, opravy, ostatní. Mezera
                          mezi segmenty je v barvě karty, ne průhledná - přes
                          mřížku by průhledná mezera nebyla vidět. */}
                      <span className="w-full max-w-[26px] h-full flex flex-col-reverse justify-start gap-[2px]">
                        <Segment hodnota={m.nataceni} nahore={nahore} barva={BARVY.nataceni} />
                        <Segment hodnota={m.strih} nahore={nahore} barva={BARVY.strih} />
                        <Segment hodnota={m.opravy} nahore={nahore} barva={BARVY.opravy} />
                        <Segment hodnota={m.ostatni} nahore={nahore} barva={BARVY.ostatni} posledni />
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {aktivni !== null && (
                <div
                  className="absolute top-1 z-10 pointer-events-none bg-surface border border-line rounded-lg shadow-lg px-3 py-2 text-xs font-body min-w-[180px]"
                  style={
                    (aktivni + 0.5) / n > 0.6
                      ? { right: `${100 - ((aktivni + 0.5) / n) * 100 + 100 / n / 2}%` }
                      : { left: `${((aktivni + 0.5) / n) * 100 + 100 / n / 2}%` }
                  }
                >
                  <p className="font-heading font-semibold text-ink m-0 mb-1">{mesice[aktivni].popis}</p>
                  <Radek jazyk={jazyk} barva={BARVY.nataceni} popis={t('knihy.nataceni')} hodnota={mesice[aktivni].nataceni} />
                  <Radek jazyk={jazyk} barva={BARVY.strih} popis={t('knihy.strih')} hodnota={mesice[aktivni].strih} />
                  <Radek jazyk={jazyk} barva={BARVY.opravy} popis={t('knihy.opravy')} hodnota={mesice[aktivni].opravy} />
                  <Radek jazyk={jazyk} barva={BARVY.ostatni} popis={t('knihy.ostatni')} hodnota={mesice[aktivni].ostatni} />
                  <Radek jazyk={jazyk} popis={t('knihy.celkem')} hodnota={soucet(mesice[aktivni])} tucne />
                </div>
              )}
            </div>

            <div className="flex text-[11px] font-body text-muted">
              {mesice.map((m, i) => (
                <span key={m.klic} className="flex-1 text-center truncate">
                  {kazdyDruhy && i % 2 === 1 ? '' : m.popis}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Segment({
  hodnota,
  nahore,
  barva,
  posledni,
}: {
  hodnota: number;
  nahore: number;
  barva: string;
  /** Nejvyšší segment má zaoblenou horní hranu - konec sloupce, ne předěl. */
  posledni?: boolean;
}) {
  if (hodnota <= 0 || nahore <= 0) return null;
  return (
    <span
      className={posledni ? 'block rounded-t' : 'block'}
      style={{ height: `${Math.max(0.6, (hodnota / nahore) * 100)}%`, backgroundColor: barva }}
    />
  );
}

function Legenda({ barva, children }: { barva: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: barva }} />
      {children}
    </span>
  );
}

function Radek({
  jazyk,
  barva,
  popis,
  hodnota,
  tucne,
}: {
  jazyk: Jazyk;
  barva?: string;
  popis: string;
  hodnota: number;
  tucne?: boolean;
}) {
  return (
    <p className="flex items-center gap-2 m-0 py-0.5">
      <span
        className="inline-block w-2 h-2 rounded-sm shrink-0"
        style={{ backgroundColor: barva ?? 'transparent' }}
      />
      <span className="text-muted">{popis}</span>
      <span className={`ml-auto tabular-nums text-ink ${tucne ? 'font-heading font-semibold' : ''}`}>
        {kc(hodnota, jazyk)}
      </span>
    </p>
  );
}
