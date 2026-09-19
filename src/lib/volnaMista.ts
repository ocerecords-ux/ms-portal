import {
  checkOpeningHours,
  findCollisions,
  weekdayInZone,
  zonedToUtc,
  type TimeRange,
} from '@/lib/calendar';

/**
 * AUTOMATICKÁ NABÍDKA TERMÍNŮ (zadání 19. 9. 2026: „Počítá se potřebný počet
 * frekvencí a podle data odevzdání se vymezí poslední možná frekvence
 * k nabídnutí. Nabídne to v podstatě možná místa všechna, kromě těch
 * obsazených v našem kalendáři. Nechci termíny nabízet ručně… herec musí
 * zakliknout 7 termínů, může vybírat všude tam, kde je místo v rámci jeho
 * lokace a studia").
 *
 * Tenhle soubor jen POČÍTÁ - nesahá do databáze, takže se dá otestovat.
 * Načtení dat a zápis nabídky je v lib/volnaMistaServer.ts.
 *
 * CO JE „MOŽNÉ MÍSTO":
 * - studio, ve kterém herec umí natáčet (jeho lokace), plus studio nabídky,
 * - den od zítřka do posledního dne období (poslední možná frekvence),
 * - okno podle zkratek studia (9–13, 13–17); studio bez zkratek se rozdělí
 *   na bloky o délce frekvence od začátku pracovní doby,
 * - v pracovní době studia, VČETNĚ víkendů „po domluvě" (upřesnění
 *   19. 9. 2026: „pak bych takto nabídnul i víkendy") - víkendové místo nese
 *   příznak `poDomluve` a herec u něj vidí, že se potvrzuje se zvukařem,
 * - nic, co je v kalendáři obsazené: vybraný nebo potvrzený termín jiné
 *   nabídky, jakákoli událost ve studiu (natáčení, střih, svátek, údržba)
 *   a jiné natáčení téhož herce.
 *
 * Nabídnutá místa jiných nabídek NEblokují - obsadí je až ten, kdo si je
 * vybere první. Při odeslání výběru se to ověřuje znovu.
 */

export type StudioProNabidku = {
  id: string;
  timezone: string;
  hours: { weekday: number; startMinutes: number; endMinutes: number; byArrangement: boolean }[];
  presets: { startMinutes: number; endMinutes: number }[];
};

export type VolneMisto = { studioId: string; start: Date; end: Date; poDomluve: boolean };

/**
 * Poznámka u místa v nabídce. Víkendové místo se tím označí pro herce;
 * NAVRH_HERCE je čas, který si herec navrhl sám (zadání 19. 9. 2026: „herec
 * měl možnost navrhnout, že může třeba 14-18, nebo chce natáčet jen tři
 * hodiny"). Takové místo obnova nabídky nemaže - není ze zkratek studia.
 */
export const POZNAMKA_VIKEND = 'Víkend – po domluvě';
export const POZNAMKA_NAVRH_HERCE = 'Návrh herce';

/** Dny „YYYY-MM-DD" od `od` do `doo` včetně. Pojistka proti nekonečnu: rok. */
export function dnyObdobi(od: string, doo: string): string[] {
  const dny: string[] = [];
  const d = new Date(`${od}T12:00:00.000Z`);
  const konec = new Date(`${doo}T12:00:00.000Z`);
  while (d <= konec && dny.length < 366) {
    dny.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dny;
}

/** Okna jednoho dne ve studiu - zkratky, nebo bloky délky frekvence. */
function oknaDne(
  studio: StudioProNabidku,
  pravidlo: { startMinutes: number; endMinutes: number },
  delkaMinut: number,
): { od: number; do: number }[] {
  if (studio.presets.length > 0) {
    return studio.presets.map((p) => ({ od: p.startMinutes, do: p.endMinutes }));
  }
  const okna: { od: number; do: number }[] = [];
  const krok = Math.max(30, delkaMinut);
  for (let od = pravidlo.startMinutes; od + krok <= pravidlo.endMinutes; od += krok) {
    okna.push({ od, do: od + krok });
  }
  return okna;
}

export function spocitejVolnaMista(vstup: {
  studia: StudioProNabidku[];
  /** První den období „YYYY-MM-DD". */
  od: string;
  /** Poslední den, kdy ještě může být frekvence, „YYYY-MM-DD". */
  doo: string;
  /** Délka frekvence - použije se jen u studia bez zkratek. */
  delkaMinut: number;
  /** Obsazené časy ve studiích (vybrané/potvrzené termíny a události). */
  obsazeno: (TimeRange & { id: string; studioId: string })[];
  /** Jiná natáčení téhož herce - kdekoli. */
  hercovy: (TimeRange & { id: string })[];
  /** Nic, co začíná dřív, se nenabízí. */
  nejdrive: Date;
}): VolneMisto[] {
  const vysledek: VolneMisto[] = [];
  const dny = dnyObdobi(vstup.od, vstup.doo);

  for (const studio of vstup.studia) {
    const obsazenoTady = vstup.obsazeno.filter((o) => o.studioId === studio.id);
    for (const den of dny) {
      const [y, m, d] = den.split('-').map(Number);
      const poledne = zonedToUtc(y, m, d, 12 * 60, studio.timezone);
      const pravidlo = studio.hours.find((h) => h.weekday === weekdayInZone(poledne, studio.timezone));
      // Zavreno - nic. Vikend "po domluve" se nabizi taky, jen s priznakem.
      if (!pravidlo) continue;

      for (const okno of oknaDne(studio, pravidlo, vstup.delkaMinut)) {
        const start = zonedToUtc(y, m, d, okno.od, studio.timezone);
        const end = zonedToUtc(y, m, d, okno.do, studio.timezone);
        if (start < vstup.nejdrive || end <= start) continue;

        const doba = checkOpeningHours({ start, end }, studio.timezone, studio.hours);
        if (!doba.ok) continue;

        const kolize = findCollisions(
          { start, end },
          { studioSlots: obsazenoTady, actorSlots: vstup.hercovy },
        );
        if (kolize.length > 0) continue;

        vysledek.push({ studioId: studio.id, start, end, poDomluve: pravidlo.byArrangement });
      }
    }
  }

  return vysledek.sort((a, b) => a.start.getTime() - b.start.getTime() || a.studioId.localeCompare(b.studioId));
}

/**
 * Poslední den, kdy může být frekvence: DVA DNY PŘED datem dokončení
 * (upřesnění 19. 9. 2026: „poslední frekvence by měla být nastavena tak,
 * abychom stihli odevzdat. Tzn. poslední termín max. dva dny před datem
 * dokončení"). Zbytek je čas na střih a předání.
 */
export const DNU_PRED_DOKONCENIM = 2;

export function posledniDenFrekvence(datumOdevzdani: string): string {
  const d = new Date(`${datumOdevzdani}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - DNU_PRED_DOKONCENIM);
  return d.toISOString().slice(0, 10);
}

/** Klíč místa - podle něj se pozná, co v nabídce už je. */
export function klicMista(m: { studioId: string; start: Date; end: Date }): string {
  return `${m.studioId}|${m.start.toISOString()}|${m.end.toISOString()}`;
}

/**
 * Město studia - z názvu: „MS Studio - Brno II" → „brno". Název je
 * spolehlivější než `location`, kde může být celá adresa a dvě brněnská
 * studia by se pak lišila. Studio s názvem bez pomlčky se bere podle
 * `location`, a když ani ta není, je samo za sebe.
 */
export function mestoStudia(s: { name: string; location?: string | null }): string {
  if (s.name.includes(' - ')) {
    const posledni = s.name.split(' - ').pop() ?? s.name;
    return posledni.replace(/\s+[IVX]+$/, '').trim().toLowerCase();
  }
  return (s.location?.trim() || s.name).toLowerCase();
}

/**
 * Výběr studia při plánování po MĚSTECH (zadání 19. 9. 2026: „už by se měla
 * objevit ta studia obě brněnská tady, když plánujeme"). Nabídka stejně
 * bere všechna studia města, takže vybírat Brno I zvlášť od Brna II by
 * nic neznamenalo. Hodnota volby je první studio města - to se uloží
 * k nabídce jako hlavní.
 */
export function volbyStudiiPodleMest(
  studia: { id: string; name: string; location?: string | null }[],
): { id: string; label: string; ids: string[] }[] {
  const mesta = new Map<string, { id: string; name: string }[]>();
  for (const s of studia) {
    const klic = mestoStudia(s);
    if (!mesta.has(klic)) mesta.set(klic, []);
    mesta.get(klic)!.push(s);
  }
  return Array.from(mesta.values()).map((skupina) => {
    const prvni = skupina[0];
    if (skupina.length === 1) return { id: prvni.id, label: prvni.name, ids: [prvni.id] };
    const mesto = (prvni.name.split(' - ').pop() ?? prvni.name).replace(/\s+[IVX]+$/, '').trim();
    const cast = skupina.map((s) => (s.name.split(' - ').pop() ?? s.name).trim());
    return { id: prvni.id, label: `${mesto} – všechna studia (${cast.join(' + ')})`, ids: skupina.map((s) => s.id) };
  });
}
