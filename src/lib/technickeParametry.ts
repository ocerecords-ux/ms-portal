/**
 * TECHNICKÉ PARAMETRY VÝROBY (zadání 27. 9. 2026: „chci nastavit u projektu
 * ještě info o technických parametrech. Ať je to přehledné… uvidí to v kartě
 * projektu a pak v kanálu projektu v chatu pod nějakou ikonkou").
 *
 * Proč šablony a ne pole u projektu: „Každá firma to má jinak." Audiotéka
 * chce mp3 128 a tracky po 30 minutách, Albatros k tomu ještě tagy a názvy
 * souborů, Audiolibrix navíc hlídá hlasitost. Kdyby to byl text u projektu,
 * znamenala by změna bitrate u Albatrosu projít stovky projektů.
 *
 * U reklam je to podle zadání paušální, ale ne všechno se týká všech:
 * voiceover se natáčí do 32bit mono, postprodukce odevzdává jinak pro online
 * a jinak pro TV a mp3 320 je věc rádiového spotu. Proto má sekce nepovinnou
 * podmínku - `sluzba` (klíč z lib/sluzbyReklamy.ts) a `jenRadio`. Zvukař pak
 * v projektu vidí jen řádky, které se ho týkají.
 *
 * SOUBOR JE BEZ PRISMY, ať si ho vezme formulář v prohlížeči i server.
 */

import { prelozit, type Jazyk } from '@/lib/jazyk';

export type DruhParametru = 'AUDIOKNIHA' | 'REKLAMA';

export const DRUHY_PARAMETRU: DruhParametru[] = ['AUDIOKNIHA', 'REKLAMA'];

export const NAZVY_DRUHU: Record<DruhParametru, string> = {
  AUDIOKNIHA: 'Audioknihy',
  REKLAMA: 'Reklamy',
};

/** Nazev druhu podle jazyka (davka 7c); bez jazyka cesky. */
export function nazevDruhuParametru(druh: DruhParametru, jazyk: Jazyk = 'cs'): string {
  return jazyk === 'cs' ? NAZVY_DRUHU[druh] : prelozit(jazyk, `druhParametru.${druh}`);
}

export type SekceTech = {
  /** „Natáčení", „Export", „Tagy"… */
  nadpis: string;
  /** Jeden parametr na řádek - tak se to i čte. */
  radky: string[];
  /**
   * Jen u reklam: klíč služby z lib/sluzbyReklamy.ts (voiceover, postprodukce,
   * sounddesign). Prázdné = platí vždycky.
   */
  sluzba?: string | null;
  /** Jen u reklam: ukázat jen tam, kde se dělá rádiový spot. */
  jenRadio?: boolean;
};

export type TechnickyProfilData = {
  id: string;
  nazev: string;
  druh: DruhParametru;
  perex: string | null;
  sekce: SekceTech[];
  vychozi: boolean;
  aktivni: boolean;
  poradi: number;
  /** Firmy, které profil dodržují - jen pro přehled v administraci. */
  firmy: { id: string; name: string }[];
};

/** Co se k projektu hodí - z toho se vybírají sekce u reklamy. */
export type KontextProjektu = {
  /** Klíče služeb ze všech výstupů projektu (voiceover, postprodukce, …). */
  sluzby: string[];
  /** Má projekt rádiový spot? (typ projektu s příznakem Rodný list) */
  radiovySpot: boolean;
};

/**
 * Které sekce projektu ukázat. U audioknihy všechny - nakladatelství chce
 * dodržet celou svou sadu. U reklamy jen to, co projekt opravdu dělá, aby
 * zvukař nehledal svůj řádek mezi cizími.
 */
export function sekceProProjekt(
  profil: Pick<TechnickyProfilData, 'druh' | 'sekce'>,
  kontext: KontextProjektu,
): SekceTech[] {
  if (profil.druh !== 'REKLAMA') return profil.sekce;
  return profil.sekce.filter((s) => {
    if (s.jenRadio && !kontext.radiovySpot) return false;
    if (s.sluzba && !kontext.sluzby.includes(s.sluzba)) return false;
    return true;
  });
}

/** Kolik řádků profil celkem nese - do počtu u ikony a do přehledu. */
export function pocetRadku(sekce: SekceTech[]): number {
  return sekce.reduce((soucet, s) => soucet + s.radky.filter((r) => r.trim()).length, 0);
}

/** Sekce z textu: prázdný řádek nic neznamená, každý řádek je jeden parametr. */
export function radkyZTextu(text: string): string[] {
  return text
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);
}

/** Hlídá, co přijde z formuláře - ať se do JSONu nedostane nesmysl. */
export function ocistiSekce(vstup: unknown): SekceTech[] {
  if (!Array.isArray(vstup)) return [];
  const out: SekceTech[] = [];
  for (const s of vstup) {
    if (!s || typeof s !== 'object') continue;
    const zaznam = s as Record<string, unknown>;
    const nadpis = typeof zaznam.nadpis === 'string' ? zaznam.nadpis.trim() : '';
    const radky = Array.isArray(zaznam.radky)
      ? zaznam.radky.map((r) => (typeof r === 'string' ? r.trim() : '')).filter(Boolean)
      : [];
    if (!nadpis && radky.length === 0) continue;
    out.push({
      nadpis: nadpis || 'Parametry',
      radky,
      sluzba: typeof zaznam.sluzba === 'string' && zaznam.sluzba.trim() ? zaznam.sluzba.trim() : null,
      jenRadio: zaznam.jenRadio === true,
    });
  }
  return out;
}

/** Přečte sloupec `sekce` z databáze - JSON může být cokoliv, tak opatrně. */
export function sekceZJsonu(hodnota: unknown): SekceTech[] {
  return ocistiSekce(hodnota);
}
