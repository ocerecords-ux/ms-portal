/**
 * ČTENÍ CHYBY NA OBRAZOVCE (dávka 7o, 18. 10. 2026).
 *
 * Routa posílá `{ error, klic }` (viz `lib/chybyApi.ts`). Obrazovka má klíč
 * přeložit, a když ho odpověď nenese - starší routa, výpadek sítě, cizí
 * služba - ukázat to, co přišlo, a teprve nakonec vlastní záložní hlášku.
 */
export function hlaskaChyby(
  data: unknown,
  t: (klic: string) => string,
  zaloha: string,
): string {
  const odpoved = data as { error?: string; klic?: string } | null | undefined;
  if (odpoved?.klic) {
    const text = t(odpoved.klic);
    if (text && text !== odpoved.klic) return text;
  }
  return odpoved?.error || zaloha;
}
