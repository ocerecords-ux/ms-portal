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
 * Sloupce: vykázané peníze uvnitř stropu, obojí na JEDNÉ ose. Osa je společná
 * pro oba druhy, takže delší sloupec doopravdy znamená víc peněz — kdyby si
 * každý řádek škáloval podle sebe, šlo by o dva grafy nad sebou tvářící se
 * jako jeden.
 */
function Sloupce({ druhy }: { druhy: Druh[] }) {
  const max = Math.max(...druhy.map((d) => Math.max(d.rozpocet, d.vykazano)), 1);

  return (
    <div className="flex flex-col gap-4">
      {druhy.map((d) => {
        const pres = d.vykazano > d.rozpocet;
        const procent = d.rozpocet > 0 ? Math.round((d.vykazano / d.rozpocet) * 100) : 0;
        return (
          <div key={d.klic} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="inline-flex items-center gap-2 text-sm font-heading text-ink">
                <Puntik klic={d.klic} />
                {d.nazev}
                <span className="text-xs font-body text-muted">{d.popisJednotek}</span>
              </span>
              <span className={`text-sm font-heading tabular-nums ${pres ? 'text-danger font-semibold' : 'text-ink'}`}>
                {czk(d.vykazano)} z {czk(d.rozpocet)} · {procent} %
              </span>
            </div>

            {/* Strop je svetly pruh na sirku rozpoctu, vykazane penize plny
                pruh v barve druhu prace. Zaoblene konce a 2px mezera drzi
                pruhy od sebe i kdyz je vykazano presne na strop. */}
            <div className="relative h-3 w-full">
              <div
                className="absolute inset-y-0 left-0 rounded-pill bg-line"
                style={{ width: `${(d.rozpocet / max) * 100}%` }}
                aria-hidden="true"
              />
              <div
                className={`absolute inset-y-0 left-0 rounded-pill ${pres ? 'bg-danger' : ''}`}
                style={{
                  width: `${Math.max(d.vykazano > 0 ? 2 : 0, (d.vykazano / max) * 100)}%`,
                  backgroundColor: pres ? undefined : `var(--barva-${d.klic})`,
                }}
                title={`${d.nazev}: vykázáno ${czk(d.vykazano)} z rozpočtu ${czk(d.rozpocet)}`}
              />
            </div>
          </div>
        );
      })}
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
