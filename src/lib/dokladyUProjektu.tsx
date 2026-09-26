import { NahledIkony, type DruhNahledu } from '@/components/NahledIkony';

/**
 * IKONY DOKLADŮ U NÁZVU PROJEKTU (zadání 25. 9. 2026: „potřebuji ještě vedle
 * názvu projektu dostat ikony s tím, jaký doklad je u projektu vystaven.
 * Nabídka, faktura nebo oboje. Ať mi to tam svítí a vím rovnou, co je
 * vyfakturováno a co ne. Uvidím to jen já a Barbora Šíblová").
 *
 * Dvě značky vedle sebe: NABÍDKA a FAKTURA. Nic víc - jde o jediné: jestli
 * u zakázky něco visí a jestli je to zaplacené.
 *
 *  - nabídka: šedá = rozepsaná, oranžová = odeslaná a čeká, zelená = schválená,
 *    červená = odmítnutá,
 *  - faktura: oranžová = vystavená a nezaplacená, zelená = uhrazená.
 *
 * Co u projektu není, nesvítí vůbec - prázdné místo je taky informace a
 * dvě vybledlé ikony u každého řádku by přehled zaplevelily.
 *
 * KDO TO VIDÍ: kdo má na kartě zaškrtnuté „Vidí Banku" - tedy ti dva, co
 * k penězům patří. Schválně se nezakládá další příznak: je to tatáž dvojice
 * a tatáž věc (peníze zakázky), a jeden zapomenutý zaškrtávátko navíc dělá
 * víc škody než užitku. Kdyby se to mělo rozejít, oddělí se to snadno.
 *
 * SOUBOR JE BEZ PRISMY, ať si ho vezme přehled i detail a značky vypadaly
 * na obou místech stejně; čtení z databáze je v lib/dokladyUProjektuServer.ts.
 */

function SNahledem({
  zapnuto,
  odkaz,
  popis,
  druh,
  id,
  children,
}: {
  zapnuto: boolean;
  odkaz: string;
  popis: string;
  /** Co se ukáže v náhledu (26. 9. 2026). */
  druh: DruhNahledu;
  id: string | null | undefined;
  children: React.ReactNode;
}) {
  if (!zapnuto) return <>{children}</>;
  return (
    <NahledIkony odkaz={odkaz} popis={popis} druh={druh} id={id}>
      {children}
    </NahledIkony>
  );
}

export type StavNabidkyDokladu = 'ZADNA' | 'ROZEPSANA' | 'CEKA' | 'SCHVALENA' | 'ODMITNUTA';
export type StavFakturyDokladu = 'ZADNA' | 'ROZEPSANA' | 'VYSTAVENA' | 'UHRAZENA';

export type DokladyProjektu = {
  nabidka: StavNabidkyDokladu;
  faktura: StavFakturyDokladu;
  /** Čísla dokladů do bublinky - ať se nemusí otevírat záložka Doklady. */
  nabidkaCisla: string[];
  fakturaCisla: string[];
  /**
   * Doklad, který značku rozsvítil - klik na ikonu ukáže jeho náhled
   * (25. 9. 2026, upraveno 26. 9. 2026). Prázdné u projektu, kde doklad není.
   */
  nabidkaId?: string | null;
  fakturaId?: string | null;
};

export const PRAZDNE_DOKLADY: DokladyProjektu = {
  nabidka: 'ZADNA',
  faktura: 'ZADNA',
  nabidkaCisla: [],
  fakturaCisla: [],
  nabidkaId: null,
  fakturaId: null,
};

const POPIS_NABIDKY: Record<StavNabidkyDokladu, string> = {
  ZADNA: '',
  ROZEPSANA: 'Nabídka rozepsaná',
  CEKA: 'Nabídka odeslaná, čeká na schválení',
  SCHVALENA: 'Nabídka schválená',
  ODMITNUTA: 'Nabídka odmítnutá',
};

const POPIS_FAKTURY: Record<StavFakturyDokladu, string> = {
  ZADNA: '',
  ROZEPSANA: 'Faktura rozepsaná',
  VYSTAVENA: 'Vyfakturováno — čeká na úhradu',
  UHRAZENA: 'Faktura uhrazená',
};

const BARVA_NABIDKY: Record<StavNabidkyDokladu, string> = {
  ZADNA: '#94a3b8',
  ROZEPSANA: '#94a3b8',
  CEKA: '#f59e0b',
  SCHVALENA: '#16a34a',
  ODMITNUTA: '#ef4444',
};

const BARVA_FAKTURY: Record<StavFakturyDokladu, string> = {
  ZADNA: '#94a3b8',
  ROZEPSANA: '#94a3b8',
  VYSTAVENA: '#f59e0b',
  UHRAZENA: '#16a34a',
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

/**
 * Značky do řádku i do hlavičky detailu. Nabídka je cenovka, faktura list
 * s řádky - na patnácti pixelech se to od sebe pozná líp než dvě písmena.
 */
export function ZnackyDokladu({
  doklady,
  velikost = 15,
  /** Klik ukáže náhled dokladu (25. 9. 2026). Bez toho je značka jen obrázek. */
  dvojklik = false,
}: {
  doklady: DokladyProjektu | null | undefined;
  velikost?: number;
  dvojklik?: boolean;
}) {
  if (!doklady) return null;
  const { nabidka, faktura } = doklady;
  if (nabidka === 'ZADNA' && faktura === 'ZADNA') return null;

  const dodatek = (cisla: string[]) => (cisla.length > 0 ? ` (${cisla.join(', ')})` : '');

  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {nabidka !== 'ZADNA' && (
        <SNahledem
          zapnuto={dvojklik && Boolean(doklady.nabidkaId)}
          odkaz={`/admin/doklady/nabidky/${doklady.nabidkaId ?? ''}`}
          druh="NABIDKA"
          id={doklady.nabidkaId}
          popis={`${POPIS_NABIDKY[nabidka]}${dodatek(doklady.nabidkaCisla)} — klik ukáže náhled`}
        >
          <Znacka
            barva={BARVA_NABIDKY[nabidka]}
            popis={POPIS_NABIDKY[nabidka] + dodatek(doklady.nabidkaCisla)}
            velikost={velikost}
            kresba={
              <>
                <path d="M6.6 1.4H10v3.4L5 9.8 1.9 6.6z" />
                <circle cx="8.2" cy="3.2" r="0.7" />
              </>
            }
          />
        </SNahledem>
      )}
      {faktura !== 'ZADNA' && (
        <SNahledem
          zapnuto={dvojklik && Boolean(doklady.fakturaId)}
          odkaz={`/admin/doklady/faktury/${doklady.fakturaId ?? ''}`}
          druh="FAKTURA"
          id={doklady.fakturaId}
          popis={`${POPIS_FAKTURY[faktura]}${dodatek(doklady.fakturaCisla)} — klik ukáže náhled`}
        >
          <Znacka
            barva={BARVA_FAKTURY[faktura]}
            popis={POPIS_FAKTURY[faktura] + dodatek(doklady.fakturaCisla)}
            velikost={velikost}
            kresba={
              <>
                <path d="M2.6 1.3h6.8v9.4l-1.7-1.1-1.7 1.1-1.7-1.1-1.7 1.1z" />
                <path d="M4.3 4h3.4M4.3 6.1h3.4" />
              </>
            }
          />
        </SNahledem>
      )}
    </span>
  );
}
