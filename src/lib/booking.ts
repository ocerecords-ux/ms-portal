/**
 * REZERVACE STUDIA MUZIKANTY A PRODUCENTY (zadání 25. 9. 2026: „v rámci
 * londýnského studia potřebuji udělat plánovací kalendář, který budou mít
 * k dispozici muzikanti a producenti, kteří si u nás bookujou termíny. Ať už
 * dlouhodobě nebo krátkodobě. Mělo by to fungovat jako MS portal, člověk si
 * pak dá i webovou aplikaci do mobilu. Ten člověk tam uvidí své pojmenované
 * události a zbytek uvidí jen zabraná né časy - ne názvy událostí. Poslali
 * bychom tomu člověku pozvánku a on by se dostal jen do toho kalendáře").
 *
 * CO TENHLE SOUBOR ŘEŠÍ: tvary dat a pravidla, která platí na obou stranách
 * (server i prohlížeč). Čtení z databáze je v lib/bookingServer.ts.
 *
 * DVĚ VĚCI, KTERÉ TENHLE KALENDÁŘ ODLIŠUJÍ OD NAŠEHO:
 *
 *  1. CIZÍ ČAS NEMÁ JMÉNO. Muzikant vidí svoje rezervace pojmenované a
 *     všechno ostatní - cizí rezervace, naše natáčení, svátky, údržbu -
 *     jako jediné slovo „Busy". Ne proto, že by to bylo tajné, ale proto,
 *     že koho točíme, není jeho věc.
 *
 *  2. VŠECHNO SE POČÍTÁ V PÁSMU STUDIA. London je Europe/London, Brno
 *     Europe/Prague. Kdo se dívá z Prahy na londýnský kalendář, má vidět
 *     londýnské hodiny - jinak si zarezervuje devátou a přijde v osm.
 *
 * REZERVACE PLATÍ HNED (rozhodnuto 25. 9. 2026). Žádné „čeká na potvrzení":
 * co je v mřížce volné, to si člověk vezme, a tím je to hotové. Proto se
 * rezervace ukládá rovnou jako blokace kalendáře (StudioBlock druhu BOOKING)
 * a od té chvíle studio drží úplně stejně jako naše natáčení.
 */

/** Druh blokace, pod kterým rezervace v kalendáři žije. */
export const DRUH_REZERVACE = 'BOOKING';

/**
 * Jedna položka v kalendáři muzikanta. Cizí událost má `nazev` prázdný -
 * a je to tak schválně: kdyby jméno přišlo do prohlížeče a jen se
 * nevykreslilo, stačilo by otevřít vývojářskou konzoli.
 */
export type BookingUdalost = {
  id: string;
  /** ISO 8601 v UTC. */
  start: string;
  end: string;
  celyDen: boolean;
  /** Moje rezervace - jen ta má jméno a jde zrušit. */
  moje: boolean;
  nazev: string | null;
  poznamka: string | null;
};

/** Otevírací doba na jeden den v týdnu; minuty od půlnoci v pásmu studia. */
export type BookingHodiny = {
  /** 0 = neděle … 6 = sobota (stejně jako Date.getDay()). */
  den: number;
  od: number;
  do: number;
  /** Víkend - natáčet jde, ale po domluvě. Rezervovat se smí. */
  poDomluve: boolean;
};

export type BookingStudio = {
  id: string;
  nazev: string;
  kratce: string;
  mesto: string | null;
  barva: string;
  casovePasmo: string;
  hodiny: BookingHodiny[];
  /** Nejkratší rezervace v minutách. */
  minMinut: number;
  /** Kolik dní dopředu se smí rezervovat; 0 = bez omezení. */
  dniDopredu: number;
};

/**
 * Hodiny, které má smysl v mřížce ukazovat: od nejranějšího otevření po
 * nejpozdější zavření, se špetkou místa okolo. Prázdná mřížka od půlnoci do
 * půlnoci by na telefonu znamenala scrollovat přes deset prázdných hodin.
 */
export function rozsahMrizky(hodiny: BookingHodiny[]): { od: number; do: number } {
  if (hodiny.length === 0) return { od: 8, do: 20 };
  const od = Math.min(...hodiny.map((h) => h.od));
  const konec = Math.max(...hodiny.map((h) => h.do));
  return {
    od: Math.max(0, Math.floor(od / 60) - 1),
    do: Math.min(24, Math.ceil(konec / 60) + 1),
  };
}

/** Otevírací doba pro konkrétní den v týdnu, nebo null = zavřeno. */
export function hodinyDne(hodiny: BookingHodiny[], den: number): BookingHodiny | null {
  return hodiny.find((h) => h.den === den) ?? null;
}

/** „9:00", „13:30" - minuty od půlnoci jako čas. */
export function casZMinut(minuty: number): string {
  const h = Math.floor(minuty / 60);
  const m = minuty % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * Co všechno může být s rezervací špatně. Vrací klíč do slovníku, ne hotovou
 * větu - kalendář mluví česky i anglicky podle přepínače v portálu.
 */
export type ChybaRezervace =
  | 'booking.chybaZavreno'
  | 'booking.chybaMimoDobu'
  | 'booking.chybaKratke'
  | 'booking.chybaMinulost'
  | 'booking.chybaDaleko'
  | 'booking.chybaObsazeno';

/**
 * Sedí okno v otevírací době a je dost dlouhé? Stejná funkce běží v prohlížeči
 * (aby se tlačítko rovnou zašedlo) i na serveru (aby to platilo doopravdy).
 *
 * `denVTydnu`, `od` a `do` jsou minuty a den POČÍTANÉ V PÁSMU STUDIA -
 * převod má na starosti volající, tahle funkce o časových pásmech neví.
 */
export function zkontrolujOkno(
  studio: Pick<BookingStudio, 'hodiny' | 'minMinut'>,
  denVTydnu: number,
  od: number,
  doMinut: number,
): ChybaRezervace | null {
  const pravidlo = hodinyDne(studio.hodiny, denVTydnu);
  if (!pravidlo) return 'booking.chybaZavreno';
  if (doMinut - od < studio.minMinut) return 'booking.chybaKratke';
  if (od < pravidlo.od || doMinut > pravidlo.do) return 'booking.chybaMimoDobu';
  return null;
}
