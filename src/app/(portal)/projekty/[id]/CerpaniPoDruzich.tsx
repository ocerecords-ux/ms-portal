'use client';

import { useState } from 'react';

/**
 * ČERPÁNÍ ROZPOČTU ZVLÁŠŤ U NATÁČENÍ A ZVLÁŠŤ U STŘIHU (zadání 14. 9. 2026:
 * „potřebuju tady ještě udělat nějaký grafický přehled… kolik nám teče
 * rozpočet zvlášť u střihu a zvlášť u natáčení").
 *
 * Rozpočet audioknihy je dvě samostatné kapsy — 9 frekvencí natáčení a
 * 11 střihových jednotek. Celkové „čerpání 20 %" nad tím obojí slepí
 * dohromady, takže projekt, kde se přetáčí a nestříhá, vypadá stejně jako
 * projekt, kde se nestíhá střih. Tohle je rozpojí.
 *
 * SLOUPCE JSOU VÝCHOZÍ, koláč je na přepnutí (zadání: „koláče nebo sloupce,
 * může být na výběr"). Otázka zní „kolik z kapsy už je pryč", a to je poměr
 * ke stropu — ten koláč neukáže, protože nezná nic než součet. Koláč
 * odpovídá na jinou, taky užitečnou otázku: čím je vykázaná částka tvořená.
 *
 * BONUS TU NENÍ. Je to jednorázová odměna za dokončenou knihu, ne odpracované
 * hodiny — do srovnání „rozpočet proti výkazům" nepatří a zkreslil by ho.
 *
 * BARVY JSOU OVĚŘENÉ, ne odhadnuté: dvojice prošla kontrolou odstupu pro
 * barvosleposti i kontrastu proti podkladu, zvlášť pro světlý a zvlášť pro
 * tmavý režim (proto dva různé odstíny téže značkové barvy, ne jedna sada
 * ztmavená). Barva navíc nikdy nenese význam sama — u každé hodnoty stojí
 * číslo i popisek.
 */

/** Ověřené odstíny: světlý režim na bílé, tmavý na #1D1930. */
const BARVY = {
  nataceni: { svetla: '#7B55FF', tmava: '#9578FF' },
  strih: { svetla: '#149E4B', tmava: '#1AAE58' },
};

const czk = (v: number) => `${Math.round(v).toLocaleString('cs-CZ')} Kč`;

type Druh = {
  klic: 'nataceni' | 'strih';
  nazev: string;
  rozpocet: number;
  vykazano: number;
  /** „9 × 1 000 Kč" - at je vedle grafu videt, z ceho ten strop je. */
  popisJednotek: string;
};

export function CerpaniPoDruzich({
  rozpocetNataceni,
  rozpocetStrih,
  vykazanoNataceni,
  vykazanoStrih,
  popisNataceni,
  popisStrihu,
}: {
  rozpocetNataceni: number;
  rozpocetStrih: number;
  vykazanoNataceni: number;
  vykazanoStrih: number;
  popisNataceni: string;
  popisStrihu: string;
}) {
  const [podoba, setPodoba] = useState<'sloupce' | 'kolac'>('sloupce');

  const druhy: Druh[] = [
    {
      klic: 'nataceni',
      nazev: 'Natáčení',
      rozpocet: rozpocetNataceni,
      vykazano: vykazanoNataceni,
      popisJednotek: popisNataceni,
    },
    {
      klic: 'strih',
      nazev: 'Střih',
      rozpocet: rozpocetStrih,
      vykazano: vykazanoStrih,
      popisJednotek: popisStrihu,
    },
  ];

  const vykazanoCelkem = vykazanoNataceni + vykazanoStrih;

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Čerpání po druzích práce
        </h2>
        <div className="flex items-center gap-1">
          <Prepinac aktivni={podoba === 'sloupce'} onClick={() => setPodoba('sloupce')}>
            Sloupce
          </Prepinac>
          <Prepinac aktivni={podoba === 'kolac'} onClick={() => setPodoba('kolac')}>
            Koláč
          </Prepinac>
        </div>
      </div>

      {podoba === 'sloupce' ? (
        <Sloupce druhy={druhy} />
      ) : (
        <Kolac druhy={druhy} celkem={vykazanoCelkem} />
      )}

      {/* Legenda je u dvou rad povinna - barva nesmi byt jediny rozlisovac.
          U sloupcu ji nesou primo popisky radku, u kolace stoji zvlast. */}
      {podoba === 'kolac' && (
        <div className="flex items-center gap-4 flex-wrap">
          {druhy.map((d) => (
            <span key={d.klic} className="inline-flex items-center gap-2 text-xs font-heading text-muted">
              <Puntik klic={d.klic} />
              {d.nazev}
              <span className="text-ink tabular-nums">{czk(d.vykazano)}</span>
            </span>
          ))}
        </div>
      )}

      <p className="text-xs font-body text-muted m-0">
        Proti rozpočtu stojí výkazy zvukařů podle druhu práce. Bonus se nezapočítává — je to
        odměna za dokončenou knihu, ne odpracované hodiny.
      </p>
    </div>
  );
}

/**
 * Měřítko svislé osy: nejdřív hezký KROK, teprve z něj strop.
 *
 * Obráceně (strop nahoru a krok = strop/4) to vypadá logicky, ale vyrábí to
 * mřížku po 12 500 Kč — čísla, která nikdo nepřečte zpaměti. Krok se proto
 * zaokrouhlí na řadu 1/2/5 × mocnina deseti a strop je první jeho násobek
 * nad nejvyšší hodnotou.
 */
function meritkoOsy(nejvic: number): { strop: number; krok: number } {
  if (nejvic <= 0) return { strop: 1000, krok: 250 };
  const hruby = nejvic / 4;
  const rad = Math.pow(10, Math.floor(Math.log10(hruby)));
  const nasobek = hruby / rad;
  // Minimalne koruna - pod ni uz by mrizka vypisovala haleře.
  const krok = Math.max(1, (nasobek <= 1 ? 1 : nasobek <= 2 ? 2 : nasobek <= 5 ? 5 : 10) * rad);
  return { strop: Math.ceil(nejvic / krok) * krok, krok };
}

/**
 * SLOUPCOVÝ GRAF (upřesnění 14. 9. 2026: „chtěl bych tam grafické sloupce —
 * diagramy"). Předtím to byly tenké pruhy jako u čerpání nad tím; tohle je
 * graf se svislou osou v korunách a mřížkou.
 *
 * KAŽDÝ DRUH PRÁCE JE JEDEN SLOUPEC, ne dva vedle sebe. Světlý obrys je
 * rozpočet, barevná výplň zdola vykázané peníze — je to „jak plná je ta
 * kapsa" na první pohled. Dva sousední sloupce (rozpočet, vykázáno) by nutily
 * oko porovnávat výšky místo aby poměr rovnou viděl.
 *
 * OBA DRUHY MAJÍ SPOLEČNOU OSU, takže vyšší sloupec doopravdy znamená víc
 * peněz. Kdyby si každý škáloval podle sebe, byly by to dva grafy vedle sebe
 * tvářící se jako jeden — a přesně tak vzniká většina lživých grafů.
 */
function Sloupce({ druhy }: { druhy: Druh[] }) {
  const nejvic = Math.max(...druhy.map((d) => Math.max(d.rozpocet, d.vykazano)), 1);
  const { strop, krok } = meritkoOsy(nejvic);
  const VYSKA = 190;

  // Vodorovne linky mrizky odspodu nahoru, vcetne nuly a stropu.
  const linky: number[] = [];
  for (let v = 0; v <= strop + 0.5; v += krok) linky.push(v);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        {/* Popisky osy - vlastni sloupec vlevo, at cisla nelezou do grafu. */}
        <div className="relative shrink-0 w-14" style={{ height: VYSKA }} aria-hidden="true">
          {linky.map((v) => (
            <span
              key={v}
              className="absolute right-0 -translate-y-1/2 text-[10px] font-heading text-muted tabular-nums whitespace-nowrap"
              style={{ bottom: `${(v / strop) * 100}%` }}
            >
              {/* „tis." jen kdyz je z ceho - u malych castek by z 500 Kc
                  bylo „1 tis." a z 250 Kc dokonce „0 tis.". */}
              {v === 0 ? '0' : strop >= 4000 ? `${Math.round(v / 1000)} tis.` : v.toLocaleString('cs-CZ')}
            </span>
          ))}
        </div>

        <div className="relative flex-1 min-w-0" style={{ height: VYSKA }}>
          {/* Mrizka je recesivni - ma se dat precist, ne videt. */}
          {linky.map((v) => (
            <span
              key={v}
              aria-hidden="true"
              className={`absolute left-0 right-0 border-t ${v === 0 ? 'border-line' : 'border-line/50'}`}
              style={{ bottom: `${(v / strop) * 100}%` }}
            />
          ))}

          <div className="absolute inset-0 flex items-end justify-around gap-6 px-2">
            {druhy.map((d) => {
              const pres = d.vykazano > d.rozpocet;
              const procent = d.rozpocet > 0 ? Math.round((d.vykazano / d.rozpocet) * 100) : 0;
              return (
                <div key={d.klic} className="relative flex-1 max-w-[96px] h-full flex items-end justify-center">
                  {/* Rozpocet: svetly obrys na svou vysku. */}
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full rounded-t-md border border-b-0 border-line bg-field/60"
                    style={{ height: `${(d.rozpocet / strop) * 100}%` }}
                  />
                  {/* Vykazano: plny sloupec zdola. */}
                  <span
                    title={`${d.nazev}: vykázáno ${czk(d.vykazano)} z rozpočtu ${czk(d.rozpocet)} (${procent} %)`}
                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-full rounded-t-md ${pres ? 'bg-danger' : ''}`}
                    style={{
                      height: `${Math.min(100, (d.vykazano / strop) * 100)}%`,
                      backgroundColor: pres ? undefined : `var(--barva-${d.klic})`,
                    }}
                  />
                  {/* Hodnota nad sloupcem - primy popisek, aby se nic necetlo
                      jen z barvy ani z vysky. */}
                  <span
                    className={`absolute left-1/2 -translate-x-1/2 text-[11px] font-heading font-semibold tabular-nums whitespace-nowrap ${
                      pres ? 'text-danger' : 'text-ink'
                    }`}
                    style={{ bottom: `calc(${Math.max((d.rozpocet / strop) * 100, (d.vykazano / strop) * 100)}% + 6px)` }}
                  >
                    {procent} %
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Popisky pod osou + cisla. Odsazeni vlevo sedi se sloupcem osy vys. */}
      <div className="flex gap-3">
        <span className="shrink-0 w-14" aria-hidden="true" />
        <div className="flex-1 min-w-0 flex justify-around gap-6 px-2">
          {druhy.map((d) => (
            <div key={d.klic} className="flex-1 max-w-[96px] flex flex-col items-center gap-0.5 text-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-heading text-ink">
                <Puntik klic={d.klic} />
                {d.nazev}
              </span>
              <span className="text-[11px] font-heading tabular-nums text-ink">{czk(d.vykazano)}</span>
              <span className="text-[10px] font-body text-muted tabular-nums">
                z {czk(d.rozpocet)} · {d.popisJednotek}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] font-body text-muted m-0 text-center">
        Světlý obrys je rozpočet, barevná výplň vykázané peníze.
      </p>
    </div>
  );
}

/**
 * Koláč: z čeho se skládají vykázané peníze. Je to prstenec, ne plný kruh —
 * doprostřed se vejde součet a oko pak neporovnává úhly, ale čte číslo.
 *
 * Dva výseče nepotřebují víc než dvě barvy a u obou stojí procento i částka
 * přímo v legendě, takže se nic nečte jen z barvy.
 */
function Kolac({ druhy, celkem }: { druhy: Druh[]; celkem: number }) {
  if (celkem <= 0) {
    return (
      <p className="text-sm font-body text-muted m-0">
        Zatím nejsou žádné výkazy, takže není co rozdělit.
      </p>
    );
  }

  const R = 54;
  const OBVOD = 2 * Math.PI * R;
  let posun = 0;

  return (
    <div className="flex items-center justify-center gap-6 flex-wrap">
      <svg viewBox="0 0 140 140" className="w-[140px] h-[140px] shrink-0" role="img" aria-label="Podíl natáčení a střihu na vykázaných penězích">
        <g transform="translate(70,70) rotate(-90)">
          {druhy.map((d) => {
            const podil = d.vykazano / celkem;
            const delka = podil * OBVOD;
            const prvek = (
              <circle
                key={d.klic}
                r={R}
                fill="none"
                stroke={`var(--barva-${d.klic})`}
                strokeWidth="18"
                // 2px mezera mezi vysecemi - bez ni splynou v jeden prstenec.
                strokeDasharray={`${Math.max(0, delka - 2)} ${OBVOD - Math.max(0, delka - 2)}`}
                strokeDashoffset={-posun}
              >
                <title>{`${d.nazev}: ${czk(d.vykazano)} (${Math.round(podil * 100)} %)`}</title>
              </circle>
            );
            posun += delka;
            return prvek;
          })}
        </g>
        <text x="70" y="66" textAnchor="middle" className="fill-ink font-heading" style={{ fontSize: 15, fontWeight: 600 }}>
          {czk(celkem)}
        </text>
        <text x="70" y="82" textAnchor="middle" className="fill-muted font-body" style={{ fontSize: 10 }}>
          vykázáno
        </text>
      </svg>

      <div className="flex flex-col gap-2">
        {druhy.map((d) => (
          <span key={d.klic} className="flex items-baseline gap-2 text-sm font-heading text-ink">
            <Puntik klic={d.klic} />
            <span className="tabular-nums">{Math.round((d.vykazano / celkem) * 100)} %</span>
            <span className="text-muted font-body text-xs">{d.nazev}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barevný puntík u popisku - identita druhu práce, ne dekorace. */
function Puntik({ klic }: { klic: 'nataceni' | 'strih' }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ backgroundColor: `var(--barva-${klic})` }}
    />
  );
}

function Prepinac({
  aktivni,
  onClick,
  children,
}: {
  aktivni: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktivni}
      className={`rounded-pill px-3 py-1 text-xs font-heading font-semibold border transition-colors ${
        aktivni
          ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
          : 'border-line text-muted hover:text-ink hover:border-brand-purple/40'
      }`}
    >
      {children}
    </button>
  );
}

export { BARVY };
