/**
 * Export do kalendáře (zadani 8. 9. 2026). Externí kalendář slouží jen jako
 * osobní přehled — vybírat, schvalovat, měnit a rušit se dá výhradně
 * v MS portalu, proto se ven posílají jen POTVRZENÉ termíny.
 *
 * Formát iCalendar (RFC 5545) je prostý text; skládá se ručně, aby portál
 * kvůli tomu netahal další knihovnu.
 */

export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string | null;
  location?: string | null;
  /** Kdy byl záznam naposled změněn - podle toho se kalendáře aktualizují. */
  updatedAt: Date;
  cancelled?: boolean;
  /**
   * Celodenní událost (dovolená, svátek) - v kalendáři se ukáže nahoře
   * v řádku dne, ne jako blok přes celou mřížku. `end` je vyloučený konec
   * (půlnoc PO posledním dni), přesně jak to iCalendar chce.
   */
  celyDen?: boolean;
};

/** Den v Praze jako „20260914" - pro celodenní události. */
function icsDen(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(date).replace(/-/g, '');
}

/** "2026-09-14T07:00:00.000Z" -> "20260914T070000Z" */
function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Escapování podle RFC 5545: zpětné lomítko, středník, čárka a nový řádek.
 * Bez toho by čárka v názvu projektu rozbila celý záznam.
 */
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Řádek delší než 75 OKTETŮ se podle normy zalamuje mezerou na začátku.
 * Počítají se bajty, ne znaky - „č" má v UTF-8 dva a přísnější kalendáře
 * (Apple, Outlook) by jinak dostaly moc dlouhé řádky (oprava 20. 9. 2026).
 * Znak se nikdy nerozdělí napůl.
 */
function fold(line: string): string {
  const bajty = (t: string) => Buffer.byteLength(t, 'utf8');
  if (bajty(line) <= 75) return line;
  const casti: string[] = [];
  let aktualni = '';
  let limit = 75;
  for (const znak of line) {
    if (bajty(aktualni + znak) > limit) {
      casti.push(aktualni);
      aktualni = '';
      limit = 74; // pokracovaci radek zacina mezerou
    }
    aktualni += znak;
  }
  if (aktualni) casti.push(aktualni);
  return casti.map((c, i) => (i === 0 ? c : ` ${c}`)).join('\r\n');
}

export function buildIcs(name: string, events: IcsEvent[], barva?: string | null): string {
  const radky: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mediaspace//MS portal//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    'X-WR-TIMEZONE:Europe/Prague',
    // Jak casto si ma kalendar odber obnovit (zadani 20. 9. 2026: „aby se
    // synchronizoval co 5 min"). Posilame 5 minut; Outlook a dalsi klienti se
    // tim ridi, Apple ma vlastni nastaveni u kalendare (default hodina) a
    // Google si interval urcuje sam (12-24 h).
    'REFRESH-INTERVAL;VALUE=DURATION:PT5M',
    'X-PUBLISHED-TTL:PT5M',
  ];
  // Barva kalendare (20. 9. 2026 - kazde studio zvlast). Apple ji bere pri
  // odberu jako navrh, ostatni ji ignoruji.
  if (barva && /^#[0-9a-f]{6}$/i.test(barva)) {
    radky.push(`X-APPLE-CALENDAR-COLOR:${barva.toUpperCase()}`, `COLOR:${barva.toUpperCase()}`);
  }

  for (const e of events) {
    radky.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${icsDate(e.updatedAt)}`,
      e.celyDen ? `DTSTART;VALUE=DATE:${icsDen(e.start)}` : `DTSTART:${icsDate(e.start)}`,
      e.celyDen ? `DTEND;VALUE=DATE:${icsDen(e.end)}` : `DTEND:${icsDate(e.end)}`,
      `SUMMARY:${esc(e.summary)}`,
    );
    if (e.description) radky.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.location) radky.push(`LOCATION:${esc(e.location)}`);
    radky.push(`STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`);
    radky.push('END:VEVENT');
  }

  radky.push('END:VCALENDAR');
  return radky.map(fold).join('\r\n');
}
