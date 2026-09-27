'use client';

import { POPIS_STAVU, type Budik as BudikData } from '@/lib/palubovka';

/**
 * BUDÍK JAKO V AUTĚ (zadání 27. 9. 2026: „jako jsou budíky - ukazatele v autě,
 * podle kterých poznám, jestli mám přidat, nebo všechno člape").
 *
 * Je to měřidlo jedné hodnoty proti hranici, takže stupnice jde od nuly
 * k cíli a ručička ukazuje, kde jsme. Vyplněný oblouk nese stav (zelená →
 * oranžová → červená), nevyplněná dráha je světlejší stupeň téže barvy, aby
 * se stav četl přes celý oblouk.
 *
 * BARVA NIKDY NEHLÁSÍ SAMA. Pod ručičkou stojí stav slovem („Šlape to",
 * „Hlídat", „Přidat") - kdo barvy nerozezná, čte totéž.
 */

const STRED_X = 100;
const STRED_Y = 92;
const POLOMER = 74;
const TLOUSTKA = 14;

/** Úhel ve stupních: -210° je levý dolní konec, 30° pravý - jako tachometr. */
const OD = -210;
const DO = 30;

function bod(uhel: number, polomer: number) {
  const rad = (uhel * Math.PI) / 180;
  return { x: STRED_X + polomer * Math.cos(rad), y: STRED_Y + polomer * Math.sin(rad) };
}

function oblouk(odUhlu: number, doUhlu: number, polomer: number): string {
  const a = bod(odUhlu, polomer);
  const b = bod(doUhlu, polomer);
  const velky = Math.abs(doUhlu - odUhlu) > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${polomer} ${polomer} 0 ${velky} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

const BARVY: Record<string, { rucicka: string; drah: string; text: string }> = {
  DOBRE: { rucicka: '#149E4B', drah: '#149E4B', text: 'text-status-done' },
  HLIDAT: { rucicka: '#E08A00', drah: '#E08A00', text: 'text-status-progress' },
  SPATNE: { rucicka: '#DC2626', drah: '#DC2626', text: 'text-danger' },
};

export function Budik({
  nadpis,
  hodnota,
  budik,
  spodniPopisek,
  znacka,
}: {
  nadpis: string;
  /** Velké číslo uprostřed budíku. */
  hodnota: string;
  budik: BudikData;
  spodniPopisek: string;
  /** Kde na stupnici je cíl (0-1) - tenká ryska, jako červené pole otáčkoměru. */
  znacka?: number;
}) {
  const pomer = Math.max(0, Math.min(1, budik.pomer));
  const uhel = OD + (DO - OD) * pomer;
  const barva = BARVY[budik.stav] ?? BARVY.HLIDAT;
  const rucickaKonec = bod(uhel, POLOMER - TLOUSTKA / 2 - 6);

  return (
    <section className="rounded-card border border-line bg-surface p-5 flex flex-col items-center gap-1">
      <h2 className="font-heading font-semibold text-sm text-ink m-0 self-start">{nadpis}</h2>

      <svg viewBox="0 0 200 120" className="w-full max-w-[260px] h-auto" role="img" aria-label={`${nadpis}: ${hodnota}, ${POPIS_STAVU[budik.stav]}`}>
        {/* Dráha - světlejší stupeň téže barvy, ať stav drží přes celý oblouk. */}
        <path
          d={oblouk(OD, DO, POLOMER - TLOUSTKA / 2)}
          fill="none"
          stroke={barva.drah}
          strokeOpacity="0.16"
          strokeWidth={TLOUSTKA}
          strokeLinecap="round"
        />
        {/* Naměřená část. */}
        {pomer > 0.005 && (
          <path
            d={oblouk(OD, uhel, POLOMER - TLOUSTKA / 2)}
            fill="none"
            stroke={barva.rucicka}
            strokeWidth={TLOUSTKA}
            strokeLinecap="round"
          />
        )}
        {/* Ryska cíle. */}
        {znacka !== undefined && znacka > 0 && znacka <= 1 && (
          <line
            x1={bod(OD + (DO - OD) * znacka, POLOMER - TLOUSTKA - 3).x}
            y1={bod(OD + (DO - OD) * znacka, POLOMER - TLOUSTKA - 3).y}
            x2={bod(OD + (DO - OD) * znacka, POLOMER + 2).x}
            y2={bod(OD + (DO - OD) * znacka, POLOMER + 2).y}
            stroke="currentColor"
            className="text-muted"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
        {/* Ručička. */}
        <line
          x1={STRED_X}
          y1={STRED_Y}
          x2={rucickaKonec.x}
          y2={rucickaKonec.y}
          stroke={barva.rucicka}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={STRED_X} cy={STRED_Y} r="5" fill={barva.rucicka} />
        <circle cx={STRED_X} cy={STRED_Y} r="2" className="fill-surface" />
      </svg>

      <span className="font-heading font-semibold text-2xl text-ink leading-none -mt-3">{hodnota}</span>
      <span className={`font-heading font-semibold text-xs ${barva.text}`}>
        {POPIS_STAVU[budik.stav]}
      </span>
      <span className="text-xs font-body text-muted text-center leading-snug mt-1">
        {budik.popis}
      </span>
      <span className="text-[11px] font-body text-muted text-center leading-snug">{spodniPopisek}</span>
    </section>
  );
}
