/**
 * Zeme pro vyber u adresy firmy (zadani 6. 9. 2026: "Zemi - tady bych dal
 * výběr z menu s vlaječkama a aby šlo hledat - defaultně by měla být
 * nastavena Česká republika").
 *
 * Ukladame ISO kod (dve pismena), vlajka se z nej dopocita - neni potreba
 * zadny obrazek ani knihovna.
 */
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

export function countryName(code: string | null | undefined): string {
  if (!code) return '';
  return COUNTRIES.find((c) => c.code === code.toUpperCase())?.name ?? code;
}
