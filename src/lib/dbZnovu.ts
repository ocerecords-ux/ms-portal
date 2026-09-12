/**
 * Opakování dotazu, když databáze zrovna nemá volné místo (12. 9. 2026).
 *
 * PROČ: Supabase pouští přes pooler omezený počet spojení a každá serverless
 * funkce na Vercelu si jedno drží. Když jich naběhne moc najednou (nasazení,
 * několik lidí naráz, cron), vrátí se
 *
 *     FATAL: (EMAXCONNSESSION) max clients reached in session mode
 *
 * a s aplikací přitom není nic špatně — za pár set milisekund je místo zpátky.
 * Bez opakování z toho byla bílá stránka, nebo hůř: prázdný seznam, který
 * vypadal jako ztracená data („zmizely nám z chatu skupiny").
 *
 * OPAKUJE SE JEN NA ZAHLCENÍ SPOJENÍ. Chyba v dotazu nebo ve schématu se
 * opakováním nespraví a musí být vidět hned.
 */

/** Hlášky, které znamenají „teď se nemám kam připojit", ne „něco je špatně". */
const ZAHLCENI = [
  'EMAXCONNSESSION',
  'max clients reached',
  'too many clients',
  'Timed out fetching a new connection',
  "Can't reach database server",
  'Connection terminated',
  'ECONNRESET',
  'ETIMEDOUT',
  'P1001',
  'P1017',
  'P2024',
];

export function jeZahlceniDatabaze(err: unknown): boolean {
  const text = err instanceof Error ? `${err.message}${(err as { code?: string }).code ?? ''}` : String(err);
  return ZAHLCENI.some((v) => text.includes(v));
}

/** Kolikátý pokus, tolik čekání — krátce, ať na to nikdo nečeká. */
const CEKANI_MS = [200, 500, 900];

export async function zkusDatabazi<T>(co: () => Promise<T>, pokusy = 3): Promise<T> {
  let posledni: unknown;
  for (let pokus = 0; pokus < pokusy; pokus++) {
    try {
      return await co();
    } catch (err) {
      posledni = err;
      if (pokus === pokusy - 1 || !jeZahlceniDatabaze(err)) throw err;
      console.warn(`Databáze je zrovna plná (pokus ${pokus + 1} z ${pokusy}), zkouším znovu.`);
      await new Promise((hotovo) => setTimeout(hotovo, CEKANI_MS[pokus] ?? 900));
    }
  }
  throw posledni;
}

/**
 * Totéž, ale místo výjimky vrátí náhradní hodnotu. Pro místa, kde je lepší
 * ukázat stránku bez dat než bílou obrazovku — viz nouzový režim v layoutu.
 */
export async function zkusDatabaziNeboNic<T>(co: () => Promise<T>, nahrada: T, pokusy = 2): Promise<T> {
  try {
    return await zkusDatabazi(co, pokusy);
  } catch (err) {
    console.error('Dotaz do databáze se nepovedl, jedu bez něj:', err);
    return nahrada;
  }
}
