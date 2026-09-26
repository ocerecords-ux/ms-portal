/**
 * VÝSTUPY PROJEKTU (zadání 26. 9. 2026: „potřebuju vyřešit to, že u jednoho
 * projektu máme více výstupů… u Strabagu jsme teď dělali 4 různé délky
 * a v každém spotu jiní herci. Nebo děláme pod jedním projektem 5 různých
 * rádiových spotů").
 *
 * Výstup je konkrétní odevzdaná věc - jeden spot, jeden voiceover, jeden
 * downcut. Projekt zůstává zakázkou (složka, faktura, chat, rozpočet).
 *
 * TENHLE SOUBOR JE ZÁMĚRNĚ BEZ PRISMY, aby se dal importovat i v prohlížeči -
 * stejné dělení jako u kalendáře (calendar.ts / calendarServer.ts) nebo
 * rodného listu. Databázová část je ve vystupyServer.ts.
 *
 * Celý návrh: claude/ms-portal-vystupy-projektu-navrh.md.
 */

/** Výstup tak, jak s ním pracuje formulář i server. */
export type VystupData = {
  id: string;
  poradi: number;
  nazev: string;
  typKlic: string | null;
  delkaSekund: number | null;
  /** Vyplněné u downcutu - id hlavního výstupu, po kterém dědí. */
  odvozenoZId: string | null;
  sluzby: string[];
  herciIds: string[];
  rezie: string | null;
  hudbaNazev: string | null;
  hudbaAutor: string | null;
  bezHudby: boolean;
  /** YYYY-MM-DD, jak ho dává <input type="date">. */
  datumVyroby: string | null;
  klientNaRL: string | null;
  licenceIds: string[];
  licenceUziti: string | null;
  licenceOd: string | null;
  licenceMesicu: number | null;
  hotovo: boolean;
  /** Návrh z objednávky, který produkce ještě nepotvrdila. */
  potvrzeno: boolean;
};

/**
 * Délky downcutů, které se nabízejí zaškrtnutím (zadání 26. 9. 2026: „jeden
 * hlavní spot voiceover 1 min. a pak třeba downcuty 30, 20 a 6 s").
 *
 * Je to jen nabídka pro rychlé zadání - vlastní délka jde vždycky napsat.
 */
export const NABIZENE_DOWNCUTY = [30, 20, 15, 10, 6, 5] as const;

/** Výchozí název hlavního výstupu u nového projektu. */
export const VYCHOZI_NAZEV_VYSTUPU = 'Hlavní spot';

/**
 * Délka do textu - „30s", od minuty výš „1:30" (26. 9. 2026). Jeden tvar
 * všude: v řádku výstupu, v názvu downcutu, v nabídce i v názvu rodného
 * listu, ať se nestane, že jinde stojí 90s a jinde 1:30.
 */
export function popisDelky(sekundy: number | null | undefined): string {
  return delkaNaText(sekundy);
}

/**
 * DÉLKA PRO ČLOVĚKA (zadání 26. 9. 2026: „u délky bych potřeboval mít
 * i minuty - když to přesáhne 60 s").
 *
 * Do minuty se píše v sekundách („30s"), od minuty výš jako „1:30" - spot
 * o délce 90 s nikdo nečte jako devadesát, ale jako minutu a půl.
 */
export function delkaNaText(sekundy: number | null | undefined): string {
  if (sekundy == null || sekundy <= 0) return '';
  if (sekundy < 60) return `${Math.round(sekundy)}s`;
  const minuty = Math.floor(sekundy / 60);
  const zbytek = Math.round(sekundy % 60);
  return `${minuty}:${String(zbytek).padStart(2, '0')}`;
}

/**
 * Zpátky na sekundy. Bere, co kdo napíše: „30", „30s", „1:30", „1.30",
 * „2 min", „1 min 30 s". Co nedává smysl, vrátí jako null - políčko pak
 * zůstane, jak bylo, místo aby se uložila nula.
 */
export function textNaDelku(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return null;

  // 1:30 nebo 1.30 - minuty a sekundy
  const dvojtecka = t.match(/^(\d+)\s*[:.]\s*(\d{1,2})$/);
  if (dvojtecka) {
    const sekundy = Number(dvojtecka[1]) * 60 + Number(dvojtecka[2]);
    return sekundy > 0 ? sekundy : null;
  }

  // 1 min 30 s / 2 min / 90 s / 90
  const slovy = t.match(/^(?:(\d+)\s*(?:m|min|minut[ay]?|minuta)\b)?\s*(?:(\d+)\s*(?:s|sec|sek|sekund[y]?)?)?$/);
  if (slovy && (slovy[1] || slovy[2])) {
    const minuty = slovy[1] ? Number(slovy[1]) : 0;
    const sekundy = slovy[2] ? Number(slovy[2]) : 0;
    const celkem = minuty * 60 + sekundy;
    return celkem > 0 ? celkem : null;
  }

  return null;
}

/** Název downcutu podle délky - „Downcut 30s". */
export function nazevDowncutu(sekundy: number): string {
  return `Downcut ${popisDelky(sekundy)}`;
}

/**
 * DĚDĚNÍ U DOWNCUTU. Downcut je tatáž nahrávka jen kratší: hraje v něm týž
 * herec, běží pod toutéž hudbou a režíroval ho týž člověk. Proto se u něj
 * vyplňuje jen délka a všechno ostatní se bere z hlavního výstupu - dokud si
 * u něj někdo nevyplní vlastní hodnotu.
 *
 * Prázdné pole tedy NENÍ „nevyplněno", ale „stejné jako u hlavního". Kdyby se
 * hodnoty při zakládání downcutu zkopírovaly, oprava hudby u hlavního spotu by
 * se do zkrácených verzí nepromítla a rodné listy by si odporovaly.
 */
export function sDedenim<T extends VystupData>(vystup: T, rodic: T | null | undefined): T {
  if (!rodic) return vystup;
  return {
    ...vystup,
    typKlic: vystup.typKlic ?? rodic.typKlic,
    sluzby: vystup.sluzby.length > 0 ? vystup.sluzby : rodic.sluzby,
    herciIds: vystup.herciIds.length > 0 ? vystup.herciIds : rodic.herciIds,
    rezie: vystup.rezie ?? rodic.rezie,
    hudbaNazev: vystup.hudbaNazev ?? rodic.hudbaNazev,
    hudbaAutor: vystup.hudbaAutor ?? rodic.hudbaAutor,
    bezHudby: vystup.bezHudby || rodic.bezHudby,
    datumVyroby: vystup.datumVyroby ?? rodic.datumVyroby,
    klientNaRL: vystup.klientNaRL ?? rodic.klientNaRL,
    licenceIds: vystup.licenceIds.length > 0 ? vystup.licenceIds : rodic.licenceIds,
    licenceUziti: vystup.licenceUziti ?? rodic.licenceUziti,
    licenceOd: vystup.licenceOd ?? rodic.licenceOd,
    licenceMesicu: vystup.licenceMesicu ?? rodic.licenceMesicu,
  };
}

/**
 * Seřadí výstupy tak, jak se ukazují: hlavní výstupy podle pořadí a hned za
 * každým jeho downcuty. Sirotek (rodič mezitím zmizel) se chová jako hlavní,
 * ať se řádek neztratí.
 */
export function serad<T extends { id: string; poradi: number; odvozenoZId: string | null }>(
  vystupy: T[],
): T[] {
  const podleId = new Map(vystupy.map((v) => [v.id, v]));
  const hlavni = vystupy
    .filter((v) => !v.odvozenoZId || !podleId.has(v.odvozenoZId))
    .sort((a, b) => a.poradi - b.poradi);

  const vysledek: T[] = [];
  for (const v of hlavni) {
    vysledek.push(v);
    vysledek.push(
      ...vystupy.filter((d) => d.odvozenoZId === v.id).sort((a, b) => a.poradi - b.poradi),
    );
  }
  return vysledek;
}

/**
 * Název výstupu do rodného listu a do názvu souboru. Délka se připojuje
 * schválně: v klientově složce leží čtyři PDF vedle sebe a „Strabag" na všech
 * čtyřech by se nedal rozeznat.
 */
export function nazevSpotuZVystupu(vystup: {
  nazev: string;
  delkaSekund: number | null;
}, nazevProjektu: string): string {
  const zaklad = vystup.nazev.trim() || nazevProjektu.trim();
  const delka = popisDelky(vystup.delkaSekund);
  if (!delka) return zaklad;
  // Když už délku někdo do názvu napsal, nepřidává se podruhé.
  return zaklad.toLowerCase().includes(delka.toLowerCase()) ? zaklad : `${zaklad} ${delka}`;
}

// ---------------------------------------------------------------------------
// VÝSTUPY V OBJEDNÁVCE (zadání 26. 9. 2026, etapa 3)
// ---------------------------------------------------------------------------

/**
 * Řádek, který klient vyplní v objednávce. Zkrácené verze jsou jen seznam
 * délek - všechno ostatní po hlavním výstupu podědí, takže je klient nemusí
 * popisovat znovu.
 */
export type VystupObjednavky = {
  nazev: string;
  delkaSekund: number | null;
  sluzby: string[];
  downcuty: number[];
};

export function prazdnyVystupObjednavky(poradi: number): VystupObjednavky {
  return {
    nazev: poradi === 0 ? VYCHOZI_NAZEV_VYSTUPU : `Spot ${poradi + 1}`,
    delkaSekund: null,
    sluzby: [],
    downcuty: [],
  };
}

/**
 * Jeden řádek objednávky slovy - do mailu týmu i do shrnutí ve formuláři.
 * `nazvySluzeb` si volající dodá sám, aby tenhle soubor nezávisel na číselníku.
 */
export function popisVystupuObjednavky(
  vystup: VystupObjednavky,
  nazvySluzeb: string[],
): string {
  const casti = [popisDelky(vystup.delkaSekund), ...nazvySluzeb].filter(Boolean);
  const zaklad = `${vystup.nazev}${casti.length ? ` — ${casti.join(' · ')}` : ''}`;
  if (vystup.downcuty.length === 0) return zaklad;
  return `${zaklad}; zkrácené verze ${vystup.downcuty.map((s) => popisDelky(s)).join(', ')}`;
}

/** Shrnutí do řádku tabulky - „60s · voiceover, postprodukce". */
export function souhrnVystupu(vystup: VystupData, nazvySluzeb: string[]): string {
  const casti = [popisDelky(vystup.delkaSekund), ...nazvySluzeb].filter(Boolean);
  return casti.join(' · ');
}
