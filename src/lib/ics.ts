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
};

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

/** Řádek delší než 75 oktetů se podle normy zalamuje mezerou na začátku. */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const casti: string[] = [];
  let zbytek = line;
  casti.push(zbytek.slice(0, 74));
  zbytek = zbytek.slice(74);
  while (zbytek.length > 73) {
    casti.push(` ${zbytek.slice(0, 73)}`);
    zbytek = zbytek.slice(73);
  }
  if (zbytek.length) casti.push(` ${zbytek}`);
  return casti.join('\r\n');
}

export function buildIcs(name: string, events: IcsEvent[]): string {
  const radky: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mediaspace//MS portal//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    'X-WR-TIMEZONE:Europe/Prague',
  ];

  for (const e of events) {
    radky.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${icsDate(e.updatedAt)}`,
      `DTSTART:${icsDate(e.start)}`,
      `DTEND:${icsDate(e.end)}`,
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
