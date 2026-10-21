/**
 * ČTENÍ CHYBY NA OBRAZOVCE (dávka 7o, 18. 10. 2026).
 *
 * Routa posílá `{ error, klic }` (viz `lib/chybyApi.ts`). Obrazovka má klíč
 * přeložit, a když ho odpověď nenese - starší routa, výpadek sítě, cizí
 * služba - ukázat to, co přišlo, a teprve nakonec vlastní záložní hlášku.
 *
 * `hodnoty` patří do značek ve větě (dávka 7q) - routa je posílá vedle klíče
 * a dosazuje je až obrazovka, do své vlastní jazykové verze věty.
 */
export function hlaskaChyby(
  data: unknown,
  t: (klic: string, hodnoty?: Record<string, string | number>) => string,
  zaloha: string,
): string {
  const odpoved = data as
    | { error?: string; klic?: string; hodnoty?: Record<string, string | number> }
    | null
    | undefined;
  if (odpoved?.klic) {
    const text = t(odpoved.klic, odpoved.hodnoty);
    if (text && text !== odpoved.klic) return text;
  }
  return odpoved?.error || zaloha;
}
