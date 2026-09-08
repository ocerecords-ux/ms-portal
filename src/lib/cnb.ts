import type { Currency } from '@prisma/client';

/**
 * Denní kurzy devizového trhu ČNB (zadani 8. 9. 2026: "denní kurz z ČNB").
 *
 * ČNB publikuje jednoduchý textový soubor, který vypadá takhle:
 *
 *   08.09.2026 #174
 *   země|měna|množství|kód|kurz
 *   EMU|euro|1|EUR|25,120
 *   Velká Británie|libra|1|GBP|29,340
 *
 * Kurz je uvedený za "množství" jednotek (u některých měn 100), takže se dělí.
 * O víkendu a o svátcích vrátí ČNB kurz platný pro ten den, tedy poslední
 * vyhlášený - není proto potřeba nic dohledávat zpětně.
 *
 * Kurz se u faktury ULOŽÍ. Doklad si tak nese kurz, který platil v den
 * vystavení, a pozdější pohyb na trhu už s ním nehne.
 */

const CNB_URL =
  'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt';

export type CnbRates = {
  /** Kolik CZK stojí jedna jednotka měny. CZK je vždy 1. */
  rates: Record<string, number>;
  /** Ke kterému dni kurz je (tak, jak ho vyhlásila ČNB). */
  date: string; // DD.MM.YYYY
};

// Kurz se během dne nemění, stačí ho držet v paměti.
const cache = new Map<string, { value: CnbRates; expiresAt: number }>();
const CACHE_MS = 6 * 60 * 60 * 1000;

function toCnbDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${date.getFullYear()}`;
}

function parse(text: string): CnbRates | null {
  const lines = text.trim().split('\n');
  if (lines.length < 3) return null;

  const header = lines[0].trim();
  const date = header.split(' ')[0] || '';
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) return null;

  const rates: Record<string, number> = { CZK: 1 };
  for (const line of lines.slice(2)) {
    const parts = line.split('|');
    if (parts.length < 5) continue;
    const amount = Number.parseFloat(parts[2].replace(',', '.'));
    const code = parts[3].trim();
    const rate = Number.parseFloat(parts[4].replace(',', '.'));
    if (!code || !Number.isFinite(amount) || !Number.isFinite(rate) || amount <= 0) continue;
    rates[code] = rate / amount;
  }

  return Object.keys(rates).length > 1 ? { rates, date } : null;
}

/**
 * Kurzy k danému dni (výchozí dnešní). Vrací null, když se ČNB nepodařilo
 * zeptat - volající pak nechá kurz na uživateli, doklad kvůli tomu nepadá.
 */
export async function getCnbRates(date: Date = new Date()): Promise<CnbRates | null> {
  const key = toCnbDate(date);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const res = await fetch(`${CNB_URL}?date=${key}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('ČNB kurzy: odpověď', res.status);
      return null;
    }
    const parsed = parse(await res.text());
    if (!parsed) return null;
    cache.set(key, { value: parsed, expiresAt: Date.now() + CACHE_MS });
    return parsed;
  } catch (err) {
    console.error('ČNB kurzy se nepodařilo načíst:', err);
    return null;
  }
}

/** Kurz jedné měny k CZK. CZK vrací 1 bez dotazu na ČNB. */
export async function getRateForCurrency(
  currency: Currency,
  date: Date = new Date(),
): Promise<{ rate: number; date: string } | null> {
  if (currency === 'CZK') return { rate: 1, date: toCnbDate(date) };
  const data = await getCnbRates(date);
  const rate = data?.rates[currency];
  if (!data || !rate) return null;
  return { rate, date: data.date };
}

/** Přepočet částky v nejmenší jednotce měny na haléře CZK. */
export function toCzkMinor(minor: number, rate: number): number {
  return Math.round(minor * rate);
}

/** "25.12" → hezky vypsaný kurz. */
export function formatRate(rate: number): string {
  return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(rate);
}
