/**
 * Zeme pro vyber u adresy firmy (zadani 6. 9. 2026: "Zemi - tady bych dal
 * výběr z menu s vlaječkama a aby šlo hledat - defaultně by měla být
 * nastavena Česká republika").
 *
 * Ukladame ISO kod (dve pismena), vlajka se z nej dopocita - neni potreba
 * zadny obrazek ani knihovna.
 */
import type { Jazyk } from '@/lib/jazyk';

export const DEFAULT_COUNTRY = 'CZ';

export type Country = { code: string; name: string };

export const COUNTRIES: Country[] = [
  { code: 'CZ', name: 'Česká republika' },
  { code: 'SK', name: 'Slovensko' },
  { code: 'PL', name: 'Polsko' },
  { code: 'DE', name: 'Německo' },
  { code: 'AT', name: 'Rakousko' },
  { code: 'HU', name: 'Maďarsko' },
  { code: 'GB', name: 'Spojené království' },
  { code: 'IE', name: 'Irsko' },
  { code: 'US', name: 'Spojené státy americké' },
  { code: 'CA', name: 'Kanada' },
  { code: 'FR', name: 'Francie' },
  { code: 'ES', name: 'Španělsko' },
  { code: 'PT', name: 'Portugalsko' },
  { code: 'IT', name: 'Itálie' },
  { code: 'NL', name: 'Nizozemsko' },
  { code: 'BE', name: 'Belgie' },
  { code: 'LU', name: 'Lucembursko' },
  { code: 'CH', name: 'Švýcarsko' },
  { code: 'DK', name: 'Dánsko' },
  { code: 'SE', name: 'Švédsko' },
  { code: 'NO', name: 'Norsko' },
  { code: 'FI', name: 'Finsko' },
  { code: 'EE', name: 'Estonsko' },
  { code: 'LV', name: 'Lotyšsko' },
  { code: 'LT', name: 'Litva' },
  { code: 'SI', name: 'Slovinsko' },
  { code: 'HR', name: 'Chorvatsko' },
  { code: 'RS', name: 'Srbsko' },
  { code: 'RO', name: 'Rumunsko' },
  { code: 'BG', name: 'Bulharsko' },
  { code: 'GR', name: 'Řecko' },
  { code: 'UA', name: 'Ukrajina' },
  { code: 'TR', name: 'Turecko' },
  { code: 'AU', name: 'Austrálie' },
  { code: 'NZ', name: 'Nový Zéland' },
  { code: 'JP', name: 'Japonsko' },
  { code: 'KR', name: 'Jižní Korea' },
  { code: 'CN', name: 'Čína' },
  { code: 'IN', name: 'Indie' },
  { code: 'BR', name: 'Brazílie' },
  { code: 'MX', name: 'Mexiko' },
  { code: 'ZA', name: 'Jihoafrická republika' },
  { code: 'IL', name: 'Izrael' },
  { code: 'AE', name: 'Spojené arabské emiráty' },
];

/** Vlajka jako emoji z ISO kodu (regionalni indikatory). */
export function countryFlag(code: string): string {
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '🏳️';
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/**
 * NÁZEV ZEMĚ PODLE JAZYKA (dávka 7e).
 *
 * Ukládá se ISO kód, takže překlad nesahá na data vůbec. Anglické názvy se
 * neopisují do druhého stočlenného seznamu - bere je `Intl.DisplayNames`,
 * tedy tatáž data, podle kterých je pojmenuje operační systém. Český seznam
 * zůstává ručně psaný: je zdroj pravdy a je v něm dohodnuté znění
 * („Spojené království", ne „Velká Británie").
 *
 * Kdyby `Intl.DisplayNames` v daném prostředí nebylo, projde český název -
 * portál nikdy neukáže holý kód.
 */
let anglickeNazvy: Intl.DisplayNames | null | undefined;

function anglicky(code: string): string | null {
  if (anglickeNazvy === undefined) {
    try {
      anglickeNazvy = new Intl.DisplayNames(['en-GB'], { type: 'region' });
    } catch {
      anglickeNazvy = null;
    }
  }
  if (!anglickeNazvy) return null;
  try {
    const nazev = anglickeNazvy.of(code);
    return nazev && nazev !== code ? nazev : null;
  } catch {
    return null;
  }
}

export function countryName(code: string | null | undefined, jazyk?: Jazyk): string {
  if (!code) return '';
  const kod = code.toUpperCase();
  const cesky = COUNTRIES.find((c) => c.code === kod)?.name;
  if (!jazyk || jazyk === 'cs') return cesky ?? code;
  return anglicky(kod) ?? cesky ?? code;
}

/** Seznam zemí v jazyce rozhraní. Pořadí zůstává - sousedi nahoře. */
export function zeme(jazyk: Jazyk): Country[] {
  if (jazyk === 'cs') return COUNTRIES;
  return COUNTRIES.map((c) => ({ ...c, name: countryName(c.code, jazyk) }));
}

/** Text bez háčků, čárek a velkých písmen - kvůli hledání i porovnávání. */
export function bezDiakritiky(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * ISO kod z čehokoliv, co je v databázi uložené.
 *
 * U firem se země vybírá z nabídky a ukládá se kód, ale u lidí bylo dlouho
 * obyčejné textové pole - leží tam „Česká republika", „ČR" i „cz". Tohle to
 * srovná na kód, aby nabídka s vlaječkami hned ukázala tu správnou zemi.
 * Co se poznat nedá, zůstane, jak je - radši cizí text než smazaná adresa.
 */
export function kodZeme(hodnota: string | null | undefined): string {
  if (!hodnota) return '';
  const text = hodnota.trim();
  if (!text) return '';
  if (/^[A-Za-z]{2}$/.test(text)){
    const kod = text.toUpperCase();
    if (COUNTRIES.some((c) => c.code === kod)) return kod;
  }
  const klic = bezDiakritiky(text);
  const podleJmena = COUNTRIES.find((c) => bezDiakritiky(c.name) === klic);
  if (podleJmena) return podleJmena.code;
  // Běžné zkratky a lidové názvy, na které se v portálu narazí.
  const zkratky: Record<string, string> = {
    'cr': 'CZ', 'ceska republika': 'CZ', 'cesko': 'CZ', 'czech republic': 'CZ', 'czechia': 'CZ',
    'sr': 'SK', 'slovenska republika': 'SK', 'slovakia': 'SK',
    'deutschland': 'DE', 'germany': 'DE', 'nemecko': 'DE',
    'austria': 'AT', 'osterreich': 'AT',
    'poland': 'PL', 'polska': 'PL',
    'uk': 'GB', 'velka britanie': 'GB', 'anglie': 'GB',
    'usa': 'US', 'spojene staty': 'US',
  };
  return zkratky[klic] ?? text;
}
