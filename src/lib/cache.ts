/**
 * Malá paměťová cache pro pomalá externí volání (Caflou, Google Disk).
 *
 * Proč: stránky portálu jsou `force-dynamic` a tahají data živě, takže každé
 * kliknutí v liště znamenalo nový dotaz ven. U interního přehledu projektů
 * tenhle problém už vyřešená cache měla (viz listAllCaflouProjectsForInternal
 * v lib/caflou.ts) - tohle je stejný princip vytažený zvlášť, aby se dal
 * použít i jinde, než aby se kopíroval.
 *
 * Co umí:
 *  - drží výsledek po dobu `ttlMs`,
 *  - souběžné požadavky na stejný klíč sdílí JEDEN probíhající dotaz (jinak
 *    Caflou vrací 429 "Rate limit exceeded - same request is processing"),
 *  - když dotaz selže a v paměti je starší hodnota, radši vrátí tu starou než
 *    aby uživateli ukázala chybu.
 *
 * Vědomé omezení: je to paměť jedné instance funkce na Vercelu, ne sdílené
 * úložiště. Studený start tedy cache nemá - to je v pořádku, cílem je ušetřit
 * opakované dotazy během jednoho proklikávání portálu, ne postavit CDN.
 */

type Entry = { at: number; value: unknown };

const store = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();

/** Jak dlouho se smí použít stará hodnota, když nový dotaz selže. */
const DEFAULT_STALE_MS = 30 * 60 * 1000;

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  staleMs: number = DEFAULT_STALE_MS,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as T;

  const running = inFlight.get(key);
  if (running) return running as Promise<T>;

  const promise = load()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .catch((err) => {
      const stale = store.get(key);
      if (stale && Date.now() - stale.at < staleMs) {
        console.error(`cached(${key}): dotaz selhal, používám starší hodnotu:`, err);
        return stale.value as T;
      }
      throw err;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise as Promise<T>;
}

/** Zahodí uloženou hodnotu - po zápisu, který ji mohl znehodnotit. */
export function invalidate(key: string): void {
  store.delete(key);
}
