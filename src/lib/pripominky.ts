/**
 * Zpětná vazba k portálu (zadání 15. 9. 2026).
 *
 * Tenhle soubor je BEZ Prismy - používá ho i prohlížeč (upozornění na
 * podobnou připomínku se ukazuje rovnou při psaní).
 */

export const STAV_PRIPOMINKY_POPISKY: Record<string, string> = {
  NOVA: 'Čeká',
  HOTOVA: 'Hotovo',
};

/** Kolik příloh se vejde k jedné připomínce. */
export const MAX_PRILOH = 4;

/** Nejdelší rozumná připomínka - delší text stejně nikdo nepřečte. */
export const MAX_DELKA_TEXTU = 2000;

/**
 * Srovnávací tvar textu: bez diakritiky, malými písmeny, bez interpunkce
 * a bez zdvojených mezer. „Nejde mi ULOŽIT výkaz!!!" a „nejde ulozit vykaz"
 * mají vyjít stejně.
 */
export function normalizuj(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trojice písmen, ze kterých se počítá podobnost. */
function trojice(text: string): Set<string> {
  const t = ` ${text} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i += 1) out.add(t.slice(i, i + 3));
  return out;
}

/**
 * Podobnost dvou textů 0-1 (Sørensenův-Diceův koeficient nad trojicemi
 * písmen). Nic chytrého se tu neděje schválně: portál nemá jak poznat, že
 * „nejde uložit" a „padá to při ukládání" je totéž, a hádat to za člověka by
 * bylo horší než mu dvě podobné připomínky ukázat a nechat ho rozhodnout.
 */
export function podobnost(a: string, b: string): number {
  const x = trojice(normalizuj(a));
  const y = trojice(normalizuj(b));
  if (x.size === 0 || y.size === 0) return 0;
  let spolecne = 0;
  x.forEach((t) => {
    if (y.has(t)) spolecne += 1;
  });
  return (2 * spolecne) / (x.size + y.size);
}

/**
 * Od kolika se dvě připomínky považují za podobné. 0,45 je usazené tak, aby
 * upozornění vyskočilo u přeformulované téže věci, ale ne u dvou různých
 * připomínek ke stejné obrazovce.
 */
export const PRAH_PODOBNOSTI = 0.45;

export type PodobnaPripominka = {
  id: string;
  text: string;
  autor: string;
  shoda: number;
};

/** Najde nejpodobnější z existujících připomínek. */
export function najdiPodobne<T extends { id: string; text: string; autor: string }>(
  text: string,
  existujici: T[],
  prah = PRAH_PODOBNOSTI,
): PodobnaPripominka[] {
  if (normalizuj(text).length < 8) return [];
  return existujici
    .map((p) => ({ id: p.id, text: p.text, autor: p.autor, shoda: podobnost(text, p.text) }))
    .filter((p) => p.shoda >= prah)
    .sort((a, b) => b.shoda - a.shoda)
    .slice(0, 3);
}
