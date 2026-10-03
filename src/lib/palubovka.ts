/**
 * PALUBOVKA (zadání 27. 9. 2026: „potřeboval bych udělat takový přehled jen pro
 * sebe, jako jsou budíky - ukazatele v autě, podle kterých poznám, jestli mám
 * přidat, nebo všechno člape… vidím jen já a tím řídím celou firmu a vím, kam
 * to směřuje").
 *
 * DVA BUDÍKY, NE DVACET. Ondřej si vybral tachometr a palivoměr:
 *
 *   TACHOMETR - kolik jsme tenhle měsíc vyfakturovali proti cíli. Říká, jak
 *   rychle právě jedeme.
 *
 *   PALIVOMĚR - kolik korun máme rozjednaných a ještě nevyfakturovaných,
 *   přepočteno na MĚSÍCE provozu. Tohle je ten budík, kvůli kterému to celé
 *   vzniklo: tachometr může ukazovat plnou rychlost a palivo přitom docházet.
 *   Když palivo klesne pod hranici, je čas přidat na obchodu - a je to vidět
 *   dva měsíce předem, ne až když není co fakturovat.
 *
 * BARVA SAMA NIC NEŘÍKÁ. Každý budík má vedle sebe i slovní stav („Nad plánem",
 * „Dochází") - kdo barvy nerozezná, čte stejnou informaci.
 *
 * SOUBOR JE BEZ PRISMY, ať si ho vezme stránka v prohlížeči i server.
 */

import { kodJazyka, prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

export type Stav = 'DOBRE' | 'HLIDAT' | 'SPATNE';

export const POPIS_STAVU: Record<Stav, string> = {
  DOBRE: 'Šlape to',
  HLIDAT: 'Hlídat',
  SPATNE: 'Přidat',
};

/**
 * Slovní stav pod ručičkou podle KÓDU, ne podle českého popisku (vzor
 * nazevMeny z dávky 4). Jazyk je NEPOVINNÝ - bez něj čeština, aby se
 * POPIS_STAVU dalo brát i mimo rozhraní.
 */
export function nazevStavuBudiku(stav: Stav, jazyk?: Jazyk): string {
  if (!jazyk) return POPIS_STAVU[stav];
  return prelozit(jazyk, `palubovka.stav.${stav}`);
}

export type Budik = {
  /** 0-1 a víc; 1 = přesně na cíli. Nad 1 se ručička zastaví na konci stupnice. */
  pomer: number;
  stav: Stav;
  /** Co přesně ručička ukazuje - píše se pod budík. */
  popis: string;
};

/**
 * TACHOMETR: kolik z měsíčního cíle je hotovo.
 *
 * Nejde o to, jestli je konec měsíce - měsíc se počítá POMĚRNĚ. Desátého je
 * třetina měsíce za námi, takže třetina cíle je „na plánu", ne zaostávání.
 * Bez toho by budík svítil červeně každého prvního.
 */
export function tachometr(
  vyfakturovano: number,
  cil: number | null,
  denVMesici: number,
  dnuVMesici: number,
  /** NEPOVINNÝ jazyk - bez něj věty pod budíkem stojí česky. */
  jazyk: Jazyk = 'cs',
): Budik {
  if (!cil || cil <= 0) {
    return { pomer: 0, stav: 'HLIDAT', popis: prelozit(jazyk, 'palubovka.bezCile') };
  }
  const pomer = vyfakturovano / cil;
  const ocekavano = Math.min(1, denVMesici / dnuVMesici);
  const naPlanu = ocekavano > 0 ? pomer / ocekavano : 0;
  const stav: Stav = naPlanu >= 0.95 ? 'DOBRE' : naPlanu >= 0.75 ? 'HLIDAT' : 'SPATNE';
  return {
    pomer,
    stav,
    popis:
      naPlanu >= 0.95
        ? prelozit(jazyk, 'palubovka.naPlanu')
        : prelozitS(jazyk, 'palubovka.kDnesku', { procenta: Math.round(ocekavano * 100) }),
  };
}

/**
 * PALIVOMĚR: na kolik měsíců máme rozjednáno.
 *
 * Stupnice jde do dvojnásobku cílového krytí - plná nádrž není „nekonečno
 * práce", ale dvakrát tolik, než chceme mít.
 */
export function palivomer(mesicuKryti: number, cilKryti: number, jazyk: Jazyk = 'cs'): Budik {
  const cil = cilKryti > 0 ? cilKryti : 2;
  const pomer = mesicuKryti / (cil * 2);
  const stav: Stav = mesicuKryti >= cil ? 'DOBRE' : mesicuKryti >= cil * 0.6 ? 'HLIDAT' : 'SPATNE';
  return {
    pomer,
    stav,
    popis:
      mesicuKryti >= cil
        ? prelozitS(jazyk, 'palubovka.mameNa', { kolik: popisMesicu(mesicuKryti, jazyk) })
        : prelozitS(jazyk, 'palubovka.chcemeMit', {
            cil: popisMesicu(cil, jazyk),
            kolik: popisMesicu(mesicuKryti, jazyk),
          }),
  };
}

export function popisMesicu(mesicu: number, jazyk: Jazyk = 'cs'): string {
  const zaokrouhlene = Math.round(mesicu * 10) / 10;
  if (zaokrouhlene < 1)
    return prelozitS(jazyk, 'palubovka.dni', { pocet: Math.round(zaokrouhlene * 30) });
  if (zaokrouhlene < 1.5) return prelozit(jazyk, 'palubovka.mesic');
  // Desetinná značka podle jazyka: česky „2,5", anglicky „2.5".
  const cislo = zaokrouhlene
    .toFixed(1)
    .replace('.0', '')
    .replace('.', jazyk === 'en' ? '.' : ',');
  const klic = zaokrouhlene < 5 ? 'palubovka.mesiceNekolik' : 'palubovka.mesicuMnoho';
  return prelozitS(jazyk, klic, { cislo });
}

/** Koruny bez haléřů, po tisících - budík nemá ukazovat 1 234 567,89. */
export function koruny(castka: number, jazyk: Jazyk = 'cs'): string {
  return `${Math.round(castka).toLocaleString(kodJazyka(jazyk))} Kč`;
}

/** Zkrácené koruny do malých čísel u sloupců: 1,2 mil. / 450 tis. */
export function korunyKratce(castka: number, jazyk: Jazyk = 'cs'): string {
  const a = Math.abs(castka);
  if (a >= 1_000_000)
    return `${(castka / 1_000_000).toFixed(1).replace('.', jazyk === 'en' ? '.' : ',')} ${prelozit(
      jazyk,
      'format.milionu',
    )}`;
  if (a >= 1_000) return `${Math.round(castka / 1_000)} ${prelozit(jazyk, 'format.tisic')}`;
  return `${Math.round(castka)}`;
}

/** Názvy měsíců jsou ve slovníku (obecne.mesic.*) - index 0 = leden. */
export function nazevMesicePalubovky(index: number, jazyk: Jazyk = 'cs'): string {
  return prelozit(jazyk, `obecne.mesic.${index + 1}`);
}

export const MESICE = [
  'leden',
  'únor',
  'březen',
  'duben',
  'květen',
  'červen',
  'červenec',
  'srpen',
  'září',
  'říjen',
  'listopad',
  'prosinec',
];

export const MESICE_ZKRATKA = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** Rozdíl proti srovnávané hodnotě v procentech; null, když není s čím. */
export function zmenaProcent(ted: number, drive: number | null | undefined): number | null {
  if (!drive || drive <= 0) return null;
  return Math.round(((ted - drive) / drive) * 100);
}

export type MesicObratu = {
  rok: number;
  /** 1-12 */
  mesic: number;
  vyfakturovano: number;
  uhrazeno: number;
};

/** Průměr posledních `kolik` UZAVŘENÝCH měsíců (bez toho rozjetého). */
export function prumerPoslednich(rady: MesicObratu[], kolik: number): number | null {
  const uzavrene = rady.slice(0, -1).slice(-kolik);
  if (uzavrene.length === 0) return null;
  return uzavrene.reduce((s, m) => s + m.vyfakturovano, 0) / uzavrene.length;
}
