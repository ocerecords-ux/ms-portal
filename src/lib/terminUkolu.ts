/**
 * TERMÍN ÚKOLU S ČASEM (zadání 21. 9. 2026: „u úkolu potřebuji nastavit i čas
 * do kdy").
 *
 * Datum zůstává, jak bylo (YYYY-MM-DD), čas je vedle něj zvlášť jako „HH:MM"
 * v pražském čase a je dobrovolný. Úkol bez času platí do konce dne - stejně
 * jako dřív.
 *
 * Bez Prismy a bez serveru - používá to i prohlížeč.
 */

export const CAS_UKOLU = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Teď v Praze jako „YYYY-MM-DDTHH:MM" - dá se porovnávat jako text. */
function tedVPraze(ted: Date = new Date()): string {
  const casti = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ted);
  const d = (typ: string) => casti.find((c) => c.type === typ)?.value ?? '00';
  return `${d('year')}-${d('month')}-${d('day')}T${d('hour')}:${d('minute')}`;
}

/** Je úkol po termínu? Bez času se počítá až od dalšího dne. */
export function jePoTerminu(dueDate: string | null, dueTime: string | null, ted: Date = new Date()): boolean {
  if (!dueDate) return false;
  const hranice = `${dueDate}T${dueTime && CAS_UKOLU.test(dueTime) ? dueTime : '23:59'}`;
  return hranice < tedVPraze(ted);
}

/** „22. 9." nebo „22. 9. 14:30". */
export function popisTerminu(dueDate: string, dueTime: string | null): string {
  const den = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric' }).format(
    new Date(`${dueDate}T12:00:00`),
  );
  return dueTime ? `${den} ${dueTime}` : den;
}
