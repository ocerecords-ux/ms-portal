/**
 * BACKLOG - ODEVZDALI JSME V TERMÍNU? (zadání 18. 9. 2026: „potřeboval bych
 * počítat tzv. Backlog. Je to záznam o tom, jestli se nám projekt podařilo
 * odevzdat v termínu nebo po termínu a kolik dní… Systém myslí a bere si data
 * z toho, kdy se reálně dostal projekt do stavu Dokončeno - ke schválení.")
 *
 * ZNAMÉNKO DRŽÍ STEJNOU ŘEČ JAKO PŘEHLED PROJEKTŮ: „+2" jsou dva dny
 * k dobru, „−3" tři dny skluzu. Kdyby se to tu obrátilo (skluz jako kladné
 * číslo), četlo by se to na každé druhé obrazovce naopak.
 *
 * Soubor je bez Prismy - počítá z něj i obrazovka v prohlížeči, když se
 * přepne druh projektu nebo období.
 */

export type DruhBacklogu = 'VSE' | 'AUDIOKNIHA' | 'REKLAMA';

export const POPISKY_DRUHU: Record<DruhBacklogu, string> = {
  VSE: 'Obojí',
  AUDIOKNIHA: 'Audioknihy',
  REKLAMA: 'Reklamy',
};

export type ZaznamBacklogu = {
  caflouProjectId: string;
  nazev: string;
  /** Typ projektu z ceníku - jen pro doplnění v tabulce. */
  typ: string | null;
  /** Reklama se pozná podle Rodného listu v ceníku, stejně jako všude jinde. */
  reklama: boolean;
  /** YYYY-MM-DD */
  termin: string;
  /** YYYY-MM-DD - kdy projekt vstoupil do „Dokončeno - ke schválení". */
  odevzdano: string;
  /** Kladné = odevzdáno před termínem, záporné = po termínu. */
  skluz: number;
};

export type SouhrnBacklogu = {
  pocet: number;
  vTerminu: number;
  poTerminu: number;
  /** Podíl odevzdaných v termínu, zaokrouhleno na celá procenta. */
  procentVTerminu: number;
  procentPoTerminu: number;
  /** Součet dní k dobru (kladná čísla). */
  dniPredem: number;
  /** Součet dní skluzu jako kladné číslo - „kolik dní jsme byli pozdě". */
  dniPoTerminu: number;
  /** Rozdíl obojího; kladný znamená, že jsme celkově napřed. */
  celkem: number;
  /** Průměr na projekt, na jedno desetinné místo. */
  prumer: number;
  /** Nejdelší skluz, kolik dní. 0 = žádný skluz nebyl. */
  nejdelsiSkluz: number;
};

export function filtrujDruh(zaznamy: ZaznamBacklogu[], druh: DruhBacklogu): ZaznamBacklogu[] {
  if (druh === 'VSE') return zaznamy;
  return zaznamy.filter((z) => (druh === 'REKLAMA' ? z.reklama : !z.reklama));
}

/**
 * Omezení na posledních `mesicu` měsíců podle data odevzdání. `null` = vše.
 * Počítá se od prvního dne měsíce, ve kterém jsme teď - jinak by „posledních
 * 6 měsíců" znamenalo půlku měsíce navíc nebo míň podle toho, kolikátého je.
 */
export function omezObdobi(
  zaznamy: ZaznamBacklogu[],
  mesicu: number | null,
  dnes = new Date(),
): ZaznamBacklogu[] {
  if (!mesicu) return zaznamy;
  const zacatek = new Date(dnes.getFullYear(), dnes.getMonth() - (mesicu - 1), 1);
  const hranice = `${zacatek.getFullYear()}-${String(zacatek.getMonth() + 1).padStart(2, '0')}-01`;
  return zaznamy.filter((z) => z.odevzdano >= hranice);
}

export function souhrnBacklogu(zaznamy: ZaznamBacklogu[]): SouhrnBacklogu {
  const vTerminu = zaznamy.filter((z) => z.skluz >= 0).length;
  const poTerminu = zaznamy.length - vTerminu;
  const dniPredem = zaznamy.reduce((s, z) => s + (z.skluz > 0 ? z.skluz : 0), 0);
  const dniPoTerminu = zaznamy.reduce((s, z) => s + (z.skluz < 0 ? -z.skluz : 0), 0);
  const celkem = dniPredem - dniPoTerminu;
  return {
    pocet: zaznamy.length,
    vTerminu,
    poTerminu,
    procentVTerminu: zaznamy.length ? Math.round((vTerminu / zaznamy.length) * 100) : 0,
    procentPoTerminu: zaznamy.length ? 100 - Math.round((vTerminu / zaznamy.length) * 100) : 0,
    dniPredem,
    dniPoTerminu,
    celkem,
    prumer: zaznamy.length ? Math.round((celkem / zaznamy.length) * 10) / 10 : 0,
    nejdelsiSkluz: zaznamy.reduce((n, z) => (z.skluz < 0 ? Math.max(n, -z.skluz) : n), 0),
  };
}

export type MesicBacklogu = {
  /** YYYY-MM */
  klic: string;
  /** „9/26" - do popisku pod sloupcem se víc nevejde. */
  popisek: string;
  vTerminu: number;
  poTerminu: number;
  /** Součet dní za měsíc; kladný = celkově napřed. */
  dni: number;
};

const MESICE = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

/**
 * Měsíce od nejstaršího po nejnovější, VČETNĚ PRÁZDNÝCH mezi nimi. Měsíc, ve
 * kterém se nic neodevzdalo, je taky informace - a sloupcový graf, který
 * prázdné měsíce vynechá, lže o rytmu práce.
 */
export function poMesicich(zaznamy: ZaznamBacklogu[]): MesicBacklogu[] {
  if (zaznamy.length === 0) return [];
  const klice = zaznamy.map((z) => z.odevzdano.slice(0, 7)).sort();
  const prvni = klice[0];
  const posledni = klice[klice.length - 1];

  const vysledek: MesicBacklogu[] = [];
  let rok = Number(prvni.slice(0, 4));
  let mesic = Number(prvni.slice(5, 7));
  for (let pojistka = 0; pojistka < 600; pojistka += 1) {
    const klic = `${rok}-${String(mesic).padStart(2, '0')}`;
    const vMesici = zaznamy.filter((z) => z.odevzdano.startsWith(klic));
    vysledek.push({
      klic,
      popisek: `${MESICE[mesic - 1]}/${String(rok).slice(2)}`,
      vTerminu: vMesici.filter((z) => z.skluz >= 0).length,
      poTerminu: vMesici.filter((z) => z.skluz < 0).length,
      dni: vMesici.reduce((s, z) => s + z.skluz, 0),
    });
    if (klic === posledni) break;
    mesic += 1;
    if (mesic > 12) {
      mesic = 1;
      rok += 1;
    }
  }
  return vysledek;
}

/** „+3" / „0" / „−2" - stejný zápis jako u data v přehledu projektů. */
export function znamenkoDni(dni: number): string {
  if (dni === 0) return '0';
  return dni > 0 ? `+${dni}` : `−${Math.abs(dni)}`;
}
