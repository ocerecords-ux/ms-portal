/**
 * Kalendáře studií a natáčecí frekvence (zadani 8. 9. 2026).
 *
 * Tenhle soubor je BEZ Prismy — používá ho i prohlížeč. Databázová část
 * (obsazenost, kontrola kolizí, uvolňování prošlých držení) je
 * v `calendarServer.ts`.
 *
 * ČAS. Všechno se v databázi drží jako UTC okamžik. Mřížka kalendáře se ale
 * kreslí v místním čase STUDIA — Brno je Europe/Prague, London Europe/London,
 * a dvakrát ročně se mění čas. Proto se mezi „stěnovým" časem studia a UTC
 * převádí přes `zonedToUtc` / `utcParts` níže; nikde se nepočítá s pevným
 * posunem, ten by v den změny času lhal o hodinu.
 */

export type CalendarView = 'den' | 'tyden' | 'mesic';

export const CALENDAR_VIEWS: { key: CalendarView; label: string }[] = [
  { key: 'den', label: 'Den' },
  { key: 'tyden', label: 'Týden' },
  { key: 'mesic', label: 'Měsíc' },
];

// ---------------------------------------------------------------------------
// Stavy nabídky termínů
// ---------------------------------------------------------------------------

export const RECORDING_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Koncept',
  PREPARING: 'Nabídka se připravuje',
  SENT: 'Nabídka odeslána herci',
  PICKING: 'Herec vybírá termíny',
  SUBMITTED: 'Výběr čeká na schválení',
  RETURNED: 'Vráceno k přepracování',
  REJECTED: 'Zamítnuto',
  CONFIRMED: 'Potvrzeno',
  CANCELLED: 'Zrušeno',
  COMPLETED: 'Dokončeno',
};

export const RECORDING_STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-field text-muted',
  PREPARING: 'bg-field text-muted',
  SENT: 'bg-tint text-brand-purpleDark',
  PICKING: 'bg-tint text-brand-purpleDark',
  SUBMITTED: 'bg-warnTint text-status-progress',
  RETURNED: 'bg-warnTint text-status-progress',
  REJECTED: 'bg-dangerTint text-danger',
  CONFIRMED: 'bg-okTint text-status-done',
  CANCELLED: 'bg-dangerTint text-danger',
  COMPLETED: 'bg-okTint text-status-done',
};

/**
 * Povolené přechody. Schválení a potvrzení je JEDEN krok (rozhodnuto
 * 8. 9. 2026), proto mezi SUBMITTED a CONFIRMED nic není.
 */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SENT', 'DRAFT', 'CANCELLED'],
  SENT: ['PICKING', 'SUBMITTED', 'PREPARING', 'CANCELLED'],
  PICKING: ['SUBMITTED', 'PREPARING', 'CANCELLED'],
  SUBMITTED: ['CONFIRMED', 'RETURNED', 'REJECTED', 'CANCELLED'],
  RETURNED: ['PICKING', 'SUBMITTED', 'PREPARING', 'CANCELLED'],
  REJECTED: ['PREPARING', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  CANCELLED: [],
  COMPLETED: [],
};

export function canTransition(from: string, to: string): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

/** Stavy, ve kterých nabídka čeká na herce — pro jeho vlastní přehled. */
export const ACTOR_OPEN_STATUSES = ['SENT', 'PICKING', 'RETURNED'];

// ---------------------------------------------------------------------------
// Stavy jednotlivých termínů
// ---------------------------------------------------------------------------

export const SLOT_STATE_LABELS: Record<string, string> = {
  OFFERED: 'Nabídnuto',
  SELECTED: 'Drženo',
  CONFIRMED: 'Potvrzeno',
  RELEASED: 'Uvolněno',
  CANCELLED: 'Zrušeno',
};

/** Barvy v kalendáři. Volno je prostě prázdná mřížka, proto tu není. */
export const SLOT_STATE_CLASSES: Record<string, string> = {
  OFFERED: 'bg-tint border-brand-purple text-brand-purpleDark',
  SELECTED: 'bg-warnTint border-status-progress text-status-progress',
  CONFIRMED: 'bg-brand-purple border-brand-purpleDeep text-white',
  RELEASED: 'bg-field border-line text-muted',
  CANCELLED: 'bg-field border-line text-muted line-through',
};

/** Termíny, které zabírají studio. Zbytek je volno. */
export const BLOCKING_SLOT_STATES = ['SELECTED', 'CONFIRMED'];

export const BLOCK_KIND_LABELS: Record<string, string> = {
  NATACENI: 'Natáčení',
  STRIH: 'Střih',
  HOLIDAY: 'Svátek',
  VACATION: 'Dovolená',
  MAINTENANCE: 'Údržba',
  INTERNAL: 'Interní blokace',
  OTHER: 'Jiné',
};

/**
 * Druhy, u kterých se v kalendáři vyplňuje projekt, herec a zvukař (zadání
 * 14. 9. 2026). Ostatní druhy zůstávají obyčejná blokace s popisem.
 */
export const PRACOVNI_DRUHY = ['NATACENI', 'STRIH'] as const;

export function jePraceVeStudiu(kind: string): boolean {
  return (PRACOVNI_DRUHY as readonly string[]).includes(kind);
}

/**
 * Popisek události do mřížky. Skládá se ze zapsaných polí, ne z ručně psaného
 * názvu - ať v kalendáři vypadají všechny záznamy stejně.
 *
 * VZOR (zadání 14. 9. 2026):
 *
 *     Vlakař - Jiří Miroslav Valůšek
 *     ZVUKAŘ: Richard Hanula
 *
 * První řádek říká, na čem a s kým se pracuje, druhý kdo to točí. FIRMA SEM
 * NEPATŘÍ („firma je tady zbytečná") - v kalendáři jde o to, kdo kdy stojí
 * ve studiu, ne čí je to zakázka; ta se pozná z projektu.
 *
 * U střihu není herec, takže na jeho místě stojí druh práce - jinak by první
 * řádek končil pomlčkou a nebylo by poznat, jestli se točí nebo stříhá.
 */
export function popisUdalosti(casti: {
  projectName?: string | null;
  actorName?: string | null;
  zvukarName?: string | null;
  kind?: string | null;
}): string {
  const projekt = (casti.projectName ?? '').trim();
  const herec = (casti.actorName ?? '').trim();
  const zvukar = (casti.zvukarName ?? '').trim();

  const vpravo = herec || (casti.kind === 'STRIH' ? 'střih' : '');
  const prvni = [projekt, vpravo].filter(Boolean).join(' - ');
  const druhy = zvukar ? `ZVUKAŘ: ${zvukar}` : '';
  return [prvni, druhy].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Kolize
// ---------------------------------------------------------------------------

/**
 * Překrývají se dva úseky? Dotyk hranou (konec == začátek) kolize NENÍ —
 * frekvence 9–13 a 13–17 na sebe běžně navazují.
 */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export type TimeRange = { start: Date; end: Date };

/** Najde první úsek ze seznamu, který se s zadaným překrývá. */
export function findOverlap<T extends TimeRange>(range: TimeRange, others: T[]): T | null {
  for (const other of others) {
    if (overlaps(range.start, range.end, other.start, other.end)) return other;
  }
  return null;
}

export type CollisionKind = 'STUDIO' | 'BLOCK' | 'ACTOR' | 'HOURS';

export type Collision = {
  kind: CollisionKind;
  message: string;
  /** Kvůli čemu to koliduje — id slotu nebo blokace, když ho známe. */
  withId?: string;
};

/**
 * Kontrola kolizí. Schválně čistá funkce bez databáze: server si data načte
 * v transakci a zavolá tohle, testy si je podstrčí ručně.
 *
 * Pravidla:
 *  - studio nesmí být ve stejný čas obsazené dvěma projekty,
 *  - přes blokaci (svátek, údržba, dovolená) se netočí,
 *  - herec nesmí mít dvě rezervace ve stejný čas napříč VŠEMI projekty,
 *  - mimo pracovní dobu studia je to jen upozornění (víkend po domluvě se
 *    zvukařem), ne zákaz — proto `hoursWarning` zvlášť.
 */
export function findCollisions(
  range: TimeRange,
  data: {
    studioSlots?: (TimeRange & { id: string; label?: string })[];
    blocks?: (TimeRange & { id: string; title: string })[];
    actorSlots?: (TimeRange & { id: string; label?: string })[];
  },
): Collision[] {
  const kolize: Collision[] = [];

  const slot = findOverlap(range, data.studioSlots ?? []);
  if (slot) {
    kolize.push({
      kind: 'STUDIO',
      withId: slot.id,
      message: slot.label
        ? `Studio už je v tomhle čase obsazené — ${slot.label}.`
        : 'Studio už je v tomhle čase obsazené.',
    });
  }

  const block = findOverlap(range, data.blocks ?? []);
  if (block) {
    kolize.push({ kind: 'BLOCK', withId: block.id, message: `Ve studiu je blokace: ${block.title}.` });
  }

  const actor = findOverlap(range, data.actorSlots ?? []);
  if (actor) {
    kolize.push({
      kind: 'ACTOR',
      withId: actor.id,
      message: actor.label
        ? `Herec už má v tomhle čase natáčení — ${actor.label}.`
        : 'Herec už má v tomhle čase natáčení.',
    });
  }

  return kolize;
}

/**
 * Vejde se termín do pracovní doby studia? Vrací i příznak „jen po domluvě"
 * pro víkendy — ten neblokuje, jen se na něj upozorní.
 */
export function checkOpeningHours(
  range: TimeRange,
  timeZone: string,
  hours: { weekday: number; startMinutes: number; endMinutes: number; byArrangement: boolean }[],
): { ok: boolean; byArrangement: boolean; message?: string } {
  const den = weekdayInZone(range.start, timeZone);
  const od = minutesInZone(range.start, timeZone);
  // Konec o pulnoci patri predchozimu dni.
  const doMin = minutesInZone(range.end, timeZone) === 0 ? 24 * 60 : minutesInZone(range.end, timeZone);

  const pravidlo = hours.find((h) => h.weekday === den);
  if (!pravidlo) {
    return { ok: false, byArrangement: false, message: 'Studio má v tenhle den zavřeno.' };
  }
  if (od < pravidlo.startMinutes || doMin > pravidlo.endMinutes) {
    return {
      ok: false,
      byArrangement: pravidlo.byArrangement,
      message: `Mimo pracovní dobu studia (${minutesToTime(pravidlo.startMinutes)}–${minutesToTime(pravidlo.endMinutes)}).`,
    };
  }
  return {
    ok: true,
    byArrangement: pravidlo.byArrangement,
    message: pravidlo.byArrangement ? 'Víkendový termín — jen po domluvě se zvukařem.' : undefined,
  };
}

// ---------------------------------------------------------------------------
// Kolik frekvencí a kolik termínů
// ---------------------------------------------------------------------------

/**
 * Počet potřebných natáčecích frekvencí. Stejný vzorec, jaký počítá rozpočet
 * (lib/budget.ts) — 40 NS na jednu 4hodinovou frekvenci, hodnota je
 * konfigurovatelná v Cenících (BudgetSettings.pagesPerSession).
 */
export function sessionsForPages(pageCount: number, pagesPerSession: number): number {
  if (pagesPerSession <= 0) return 0;
  return Math.ceil(Math.max(0, Math.round(pageCount)) / pagesPerSession);
}

/** Kolik ještě zbývá vybrat. Nikdy záporné. */
export function remainingToPick(required: number, selected: number): number {
  return Math.max(0, required - selected);
}

export function pickingLabel(required: number, selected: number): string {
  return `Vybráno: ${selected} z ${required}`;
}

// ---------------------------------------------------------------------------
// Čas: převod mezi časovým pásmem studia a UTC
// ---------------------------------------------------------------------------

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const PARTS_FORMAT: Intl.DateTimeFormatOptions = {
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

/** Rozloží UTC okamžik na „stěnový" čas v daném pásmu. */
export function utcParts(date: Date, timeZone: string): Parts {
  const parts = new Intl.DateTimeFormat('en-US', { ...PARTS_FORMAT, timeZone }).formatToParts(date);
  const cislo = (typ: string) => Number(parts.find((p) => p.type === typ)?.value ?? '0');
  const year = cislo('year');
  const month = cislo('month');
  const day = cislo('day');
  // Nektera prostredi vraci pri pulnoci hodinu 24 misto 0.
  const hour = cislo('hour') % 24;
  const minute = cislo('minute');
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, hour, minute, weekday };
}

/** Posun pásma vůči UTC v milisekundách pro konkrétní okamžik. */
function offsetMs(date: Date, timeZone: string): number {
  const p = utcParts(date, timeZone);
  const seconds = new Intl.DateTimeFormat('en-US', { ...PARTS_FORMAT, timeZone })
    .formatToParts(date)
    .find((x) => x.type === 'second')?.value;
  const jakoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, Number(seconds ?? '0'));
  return jakoUtc - date.getTime();
}

/**
 * „9:00 v Brně 12. září" → UTC okamžik. Počítá se dvakrát, protože první
 * odhad může spadnout do jiného posunu než výsledek — přesně to se stane
 * v noci, kdy se mění čas.
 */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  minutes: number,
  timeZone: string,
): Date {
  const odhad = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  const prvni = new Date(odhad - offsetMs(new Date(odhad), timeZone));
  return new Date(odhad - offsetMs(prvni, timeZone));
}

/** Minuty od půlnoci v pásmu studia. */
export function minutesInZone(date: Date, timeZone: string): number {
  const p = utcParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

/** Den v týdnu v pásmu studia: 0 = neděle … 6 = sobota. */
export function weekdayInZone(date: Date, timeZone: string): number {
  return utcParts(date, timeZone).weekday;
}

// ---------------------------------------------------------------------------
// Mřížka a popisky
// ---------------------------------------------------------------------------

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Pondělí toho týdne (v místním čase prohlížeče). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const posun = (d.getDay() + 6) % 7; // pondeli = 0
  d.setDate(d.getDate() - posun);
  return d;
}

export function startOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Klíč dne pro seskupení: "2026-09-12" v pásmu studia. */
export function dayKey(date: Date, timeZone: string): string {
  const p = utcParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function formatTimeRange(start: Date, end: Date, timeZone: string): string {
  return `${minutesToTime(minutesInZone(start, timeZone))} – ${minutesToTime(minutesInZone(end, timeZone))}`;
}

export function formatDayLong(date: Date, timeZone = 'Europe/Prague'): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function formatDayShort(date: Date, timeZone = 'Europe/Prague'): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  }).format(date);
}

export function formatDateTime(date: Date | string | null, timeZone = 'Europe/Prague'): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export const WEEKDAY_LABELS = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
export const WEEKDAY_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

/**
 * Mřížka kreslí celý den, 0–24 (zprava uzivatele 9. 9. 2026: "určitě by tam
 * mělo být všech 24 h za den zobrazeno"). Aby se do okna vešel, je hodina
 * nižší než dřív — 34 px místo 60. Na 4hodinovou frekvenci to pořád stačí
 * s přehledem.
 */
export const GRID_START_HOUR = 0;
export const GRID_END_HOUR = 24;
/** Výška jedné hodiny v mřížce. */
export const HOUR_PX = 34;

/** Kam se má mřížka po otevření nascrollovat — ať se nekouká na noc. */
export const GRID_SCROLL_TO_HOUR = 7;

/**
 * ROZVRŽENÍ PŘEKRÝVAJÍCÍCH SE UDÁLOSTÍ (zadání 14. 9. 2026: „podívej se
 * pořádně na ten Google kalendář, jak mají vyřešeno to překrývání událostí,
 * chci to stejné").
 *
 * Do teď ležela každá událost přes celou šířku sloupce, takže dvě natáčení
 * ve stejnou hodinu se úplně zakryla a to spodní nebylo vidět ani myší.
 *
 * Postupuje se jako v Google Kalendáři:
 *
 *  1. Události, které se řetězově překrývají, tvoří JEDEN SHLUK. Stačí, že
 *     A zasahuje do B a B do C - všechny tři se dělí o šířku dohromady, i
 *     když se A s C nepotkají.
 *  2. Uvnitř shluku dostane každá událost první SLOUPEC, který je v jejím
 *     čase volný. Řadí se podle začátku, při shodě delší napřed - dlouhá
 *     frekvence tak drží levý kraj a krátké zápisy se skládají vedle ní.
 *  3. Nakonec se každá roztáhne doprava přes všechny sloupce, které má po
 *     celou svou dobu volné. Bez toho by osamocená událost vedle jednoho
 *     krátkého překryvu zbytečně držela půlku šířky.
 *
 * Vrací zlomky šířky sloupce dne: `posun` je levý okraj, `podil` šířka.
 */
export type Prekryv = { posun: number; podil: number };

export function rozvrhniPrekryvy<T extends { id: string; od: number; do: number }>(
  polozky: T[],
): Map<string, Prekryv> {
  const vysledek = new Map<string, Prekryv>();
  if (polozky.length === 0) return vysledek;

  const serazene = [...polozky].sort((a, b) => a.od - b.od || b.do - a.do);

  let shluk: T[] = [];
  let konecShluku = -Infinity;

  const dokonciShluk = () => {
    if (shluk.length === 0) return;
    // Sloupce shluku - v kazdem si drzime konec posledni udalosti.
    const sloupce: number[] = [];
    const kam = new Map<string, number>();
    for (const u of shluk) {
      let i = sloupce.findIndex((konec) => konec <= u.od);
      if (i === -1) {
        i = sloupce.length;
        sloupce.push(u.do);
      } else {
        sloupce[i] = u.do;
      }
      kam.set(u.id, i);
    }
    const celkem = sloupce.length;
    for (const u of shluk) {
      const od = kam.get(u.id)!;
      // Kam az doprava se da roztahnout, nez narazi na jinou udalost.
      let az = od + 1;
      while (az < celkem) {
        const obsazeno = shluk.some(
          (j) => j.id !== u.id && kam.get(j.id) === az && j.od < u.do && j.do > u.od,
        );
        if (obsazeno) break;
        az += 1;
      }
      vysledek.set(u.id, { posun: od / celkem, podil: (az - od) / celkem });
    }
    shluk = [];
    konecShluku = -Infinity;
  };

  for (const u of serazene) {
    if (u.od >= konecShluku) dokonciShluk();
    shluk.push(u);
    konecShluku = Math.max(konecShluku, u.do);
  }
  dokonciShluk();

  return vysledek;
}

/** Pozice a výška události v mřížce, v pixelech. */
export function gridPosition(startMinutes: number, endMinutes: number) {
  const top = ((startMinutes - GRID_START_HOUR * 60) * HOUR_PX) / 60;
  const vyska = ((endMinutes - startMinutes) * HOUR_PX) / 60;
  return { top, height: Math.max(16, vyska) };
}

/**
 * Barva události podle STUDIA, odlišená podle stavu (zprava uzivatele
 * 9. 9. 2026: "každý bude mít jinou barvu").
 *
 * PRŮHLEDNÉ PODKLADY, TEXT Z MOTIVU (zadání 14. 9. 2026: „ty segmenty
 * v kalendáři musí být průhledné, vypadá to hrozně, nemůže být bílá barva
 * textu na zeleném podkladu").
 *
 * Do 14. 9. 2026 se barva textu psala natvrdo - bílá na plné barvě studia,
 * tmavá na světlé. Jenže barvu si u studia nastavuje člověk: na fialové byla
 * bílá čitelná, na zelené ne. A v tmavém režimu seděl tmavý text na tmavém
 * podkladu.
 *
 * Proto je podklad průhledný a text se bere z motivu (`--c-ink`). Tím se
 * stará o čitelnost motiv, ne tabulka natvrdo psaných barev, a funguje to
 * ve světlém i tmavém režimu s libovolnou barvou studia. Že událost patří
 * konkrétnímu studiu, nese plný rámeček a silný pruh vlevo - stejně jako
 * v Kalendáři na Macu nebo na Googlu.
 *
 * Sytost průhlednosti odlišuje stav: čím jistější termín, tím výraznější.
 */
export function eventColors(studioColor: string, state: string): { background: string; border: string; text: string } {
  const text = 'rgb(var(--c-ink))';

  // Pevná rezervace a ručně zapsané natáčení - nejvýraznější.
  if (state === 'CONFIRMED' || state === 'NATACENI') {
    return { background: `${studioColor}4D`, border: studioColor, text };
  }
  // Drženo hercem a střih - o stupeň tišší.
  if (state === 'SELECTED' || state === 'STRIH') {
    return { background: `${studioColor}2E`, border: studioColor, text };
  }
  // Jen nabídnuto, zatím nic nedrží.
  if (state === 'OFFERED') {
    return { background: `${studioColor}1A`, border: studioColor, text };
  }
  /**
   * Kdy se NETOCI - svatek, udrzba, dovolena, uvolneny termin. Seda je
   * schvalne bez barvy studia: neni to prace, je to dira v kalendari.
   */
  return { background: 'rgb(var(--c-muted) / 0.16)', border: 'rgb(var(--c-muted))', text };
}
