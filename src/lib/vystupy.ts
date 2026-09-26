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

/** „60s", prázdno když délku neznáme. */
export function popisDelky(sekundy: number | null | undefined): string {
  if (sekundy == null || sekundy <= 0) return '';
  return `${Math.round(sekundy)}s`;
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

/** Shrnutí do řádku tabulky - „60s · voiceover, postprodukce". */
export function souhrnVystupu(vystup: VystupData, nazvySluzeb: string[]): string {
  const casti = [popisDelky(vystup.delkaSekund), ...nazvySluzeb].filter(Boolean);
  return casti.join(' · ');
}
