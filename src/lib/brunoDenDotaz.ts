import { utcParts, zonedToUtc } from '@/lib/calendar';

/**
 * „CO MÁM DNESKA?" (zadání 23. 9. 2026: „Bruno by měl i fungovat tak, že když
 * se ho zeptám v chatu na daný den, tak mi to řekne, co tam mám").
 *
 * Soubor je bez Prismy a bez modelu: jen se z věty vyčte, na KTERÝ DEN se
 * člověk ptá. Odpověď pak skládá lib/ranniPrehledServer.ts - stejný text
 * jako ranní přehled, takže se to nemůže rozejít.
 *
 * Schválně bez jazykového modelu: „co mám v pátek" je otázka na kalendář,
 * na kterou musí sednout přesná data, ne odhad.
 */

const PASMO = 'Europe/Prague';

/** Ptá se ta věta na program dne? */
const PTA_SE = [
  /\bco\s+(m[áa]m|m[ěe]\s+[čc]ek[áa]|je)\b/iu,
  /\bco\s+tam\s+m[áa]m\b/iu,
  /\bm[áa]m\s+(n[ěe]co|n[áa]hodou)\b/iu,
  /\b(program|rozvrh|kalend[áa][řr]|p[řr]ehled)\b/iu,
];

const DNY_V_TYDNU = [
  { slova: ['ned[ěe]l', 'nedeli'], index: 0 },
  { slova: ['pond[ěe]l'], index: 1 },
  { slova: ['[úu]ter'], index: 2 },
  { slova: ['st[řr]ed'], index: 3 },
  { slova: ['[čc]tvrt'], index: 4 },
  { slova: ['p[áa]t(ek|ku|e[čc])'], index: 5 },
  { slova: ['sobot'], index: 6 },
];

/**
 * Den, na který se věta ptá. `null` = není to otázka na program (nebo není
 * jasné, na kdy) a Bruno se k ní chová jako dosud.
 */
export function denZDotazu(text: string, ted: Date = new Date()): Date | null {
  const veta = (text ?? '').trim();
  if (!veta) return null;

  const dnes = utcParts(ted, PASMO);
  const posunDne = (o: number) => zonedToUtc(dnes.year, dnes.month, dnes.day + o, 12, PASMO);

  // Konkrétní datum „25. 9." nebo „25.9.2026" - jen v otázce na program.
  const datum = PTA_SE.some((r) => r.test(veta)) ? veta.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})?/u) : null;
  if (datum) {
    const den = Number(datum[1]);
    const mesic = Number(datum[2]);
    const rok = datum[3] ? Number(datum[3]) : dnes.year;
    if (den >= 1 && den <= 31 && mesic >= 1 && mesic <= 12) {
      return zonedToUtc(rok, mesic, den, 12, PASMO);
    }
  }

  /**
   * Bez otázky na program se den nehledá - jinak by „zítra dotočíme" v kanálu
   * projektu vypadalo jako dotaz na kalendář.
   */
  const jeOtazka = PTA_SE.some((r) => r.test(veta));
  if (!jeOtazka) return null;

  if (/\bpoz[íi]t[řr][íi]\b/iu.test(veta)) return posunDne(2);
  if (/\bz[íi]tra\b/iu.test(veta)) return posunDne(1);
  if (/\bv[čc]era\b/iu.test(veta)) return posunDne(-1);
  if (/\b(dnes|dneska|dnešek|dnesek)\b/iu.test(veta)) return posunDne(0);

  for (const den of DNY_V_TYDNU) {
    if (!den.slova.some((s) => new RegExp(s, 'iu').test(veta))) continue;
    // Nejbližší takový den včetně dneška.
    const rozdil = (den.index - dnes.weekday + 7) % 7;
    return posunDne(rozdil);
  }

  // „Co mám?" bez určení dne se bere jako dnešek.
  return posunDne(0);
}
