'use client';

import { NahledIkony } from '@/components/NahledIkony';
import type { DokladKlienta } from '@/lib/dokladyKlientaServer';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * IKONY DOKLADŮ V KLIENTSKÉM PŘEHLEDU (zadání 1. 10. 2026: „tady budou ikony
 * dokladů Nabídka, faktura a objednávka… když kliknu na tu ikonu, tak to bude
 * vypadat a fungovat, jako to máme my u projektů + tlačítko kde se otevře
 * celý náhled PDF a půjde i stáhnout").
 *
 * Záměrně TYTÉŽ KRESBY jako u nás (viz lib/dokladyUProjektu.tsx): cenovka
 * u nabídky, list s řádky u faktury. Když si klient zavolá a řekne „svítí mi
 * tam ta cenovka", musíme vidět totéž. Objednávka přibyla jako třetí - košík
 * by vypadal jako e-shop, tak je to list s odfajfkovanými řádky.
 *
 * BARVA ŘÍKÁ STAV, ne druh: zelená hotovo (schváleno, uhrazeno), oranžová
 * čeká (na schválení, na úhradu), šedá informace (objednávka), červená
 * odmítnutá nabídka.
 */

const BARVY: Record<DokladKlienta['barva'], string> = {
  zelena: '#16a34a',
  oranzova: '#f59e0b',
  seda: '#94a3b8',
  cervena: '#ef4444',
};

const KRESBY: Record<DokladKlienta['druh'], React.ReactNode> = {
  NABIDKA: (
    <>
      <path d="M6.6 1.4H10v3.4L5 9.8 1.9 6.6z" />
      <circle cx="8.2" cy="3.2" r="0.7" />
    </>
  ),
  FAKTURA: (
    <>
      <path d="M2.6 1.3h6.8v9.4l-1.7-1.1-1.7 1.1-1.7-1.1-1.7 1.1z" />
      <path d="M4.3 4h3.4M4.3 6.1h3.4" />
    </>
  ),
  OBJEDNAVKA: (
    <>
      <path d="M3 1.4h6v9.2H3z" />
      <path d="M4.4 4.2l1 1 1.6-1.8M4.4 7.3l1 1 1.6-1.8" />
    </>
  ),
};

const DRUH_V_ADRESE: Record<DokladKlienta['druh'], string> = {
  NABIDKA: 'nabidka',
  FAKTURA: 'faktura',
  OBJEDNAVKA: 'objednavka',
};

function Znacka({
  barva,
  popis,
  velikost,
  kresba,
}: {
  barva: string;
  popis: string;
  velikost: number;
  kresba: React.ReactNode;
}) {
  return (
    <span
      title={popis}
      aria-label={popis}
      className="inline-grid place-items-center shrink-0 rounded-[4px]"
      style={{
        width: velikost,
        height: velikost,
        background: `${barva}22`,
        border: `1px solid ${barva}`,
        color: barva,
      }}
    >
      <svg
        width={Math.round(velikost * 0.64)}
        height={Math.round(velikost * 0.64)}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {kresba}
      </svg>
    </span>
  );
}

export function ZnackyDokladuKlienta({
  doklady,
  velikost = 16,
}: {
  doklady: DokladKlienta[] | undefined;
  velikost?: number;
}) {
  // Samotný popis dokladu („Nabídka 2026-0042 — schválená") přitéká už
  // přeložený z lib/dokladyKlientaServer.ts; tady se k němu jen přidává
  // dovětek o náhledu.
  const t = usePreklad();
  if (!doklady || doklady.length === 0) return <span className="text-sm text-muted">—</span>;

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {doklady.map((d) => (
        <NahledIkony
          key={`${d.druh}-${d.id}`}
          klient
          druh={d.druh}
          id={d.id}
          odkaz={`/api/klient/doklady/pdf?druh=${DRUH_V_ADRESE[d.druh]}&id=${encodeURIComponent(d.id)}`}
          popis={t('dokladyProjektu.klikNahled', { popis: d.popis })}
        >
          <Znacka barva={BARVY[d.barva]} popis={d.popis} velikost={velikost} kresba={KRESBY[d.druh]} />
        </NahledIkony>
      ))}
    </span>
  );
}
