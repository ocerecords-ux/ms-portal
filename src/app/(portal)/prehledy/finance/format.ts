/** Celé koruny z haléřů: 1234567 -> „12 346 Kč". */
export function kc(minor: number): string {
  return `${Math.round(minor / 100).toLocaleString('cs-CZ')} Kč`;
}

/** Krátce na osu: „1,2 mil.", „350 tis.", „800". */
export function kcKratce(minor: number): string {
  const k = minor / 100;
  const a = Math.abs(k);
  if (a >= 1_000_000) return `${(k / 1_000_000).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} mil.`;
  if (a >= 1_000) return `${Math.round(k / 1_000).toLocaleString('cs-CZ')} tis.`;
  return Math.round(k).toLocaleString('cs-CZ');
}
