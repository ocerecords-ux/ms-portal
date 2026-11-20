import { prisma } from '@/lib/db';
import type { Role } from '@prisma/client';
import { studiaSCenikem } from '@/lib/studioCenikServer';

/**
 * CENÍKY DO DOKLADŮ (zadání 19. 11. 2026: „u dokladů - nabídky a faktury bych
 * chtěl mít možnost přidat položky z ceníku", připomenuto 20. 11. 2026).
 *
 * Ceník studia je hotový seznam služeb i s cenami - přesně to, co se do
 * nabídky píše ručně. Tady se jen načte, nic se neupravuje.
 *
 * NEZAKLÁDÁ CENÍK. `zajistiCenik` umí ceník založit z výchozího vzoru, když
 * studio ještě žádný nemá - to je v pořádku v editoru ceníku, ale tady by to
 * znamenalo, že otevření nabídky založí prázdné ceníky všem studiím. Čtou se
 * proto jen ty, které opravdu existují.
 *
 * DVA CENOVÉ SLOUPCE. Ceník jich má dva (třeba „bez technika" a „s technikem")
 * a do dokladu jde vždycky jeden řádek s jednou cenou - proto se každý sloupec
 * nabízí zvlášť, s popiskem sloupce v závorce.
 */

export type PolozkaCeniku = {
  /** Jedinečné v rámci nabídky - řádek a sloupec. */
  klic: string;
  /** Co se napíše do popisu položky dokladu. */
  popis: string;
  /** Cena v nejmenší jednotce měny; null = ceník ji neuvádí. */
  cenaMinor: number | null;
  /** „od 2 500 Kč" - cena je orientační a v dokladu se má přepsat. */
  od: boolean;
};

export type CenikProDoklad = {
  studioId: string;
  studioNazev: string;
  nadpis: string;
  mena: string;
  polozky: PolozkaCeniku[];
};

export async function cenikyProDoklady(
  userId: string,
  role: Role,
): Promise<CenikProDoklad[]> {
  try {
    const studia = await studiaSCenikem(userId, role);
    if (studia.length === 0) return [];

    const ceniky = await prisma.studioCenik.findMany({
      where: { studioId: { in: studia.map((s) => s.id) } },
      include: { radky: { orderBy: { poradi: 'asc' } } },
    });

    return ceniky
      .map((c) => {
        const studio = studia.find((s) => s.id === c.studioId);
        const polozky: PolozkaCeniku[] = [];
        for (const r of c.radky) {
          if (!r.popis.trim()) continue;
          const sloupce: [number | null, boolean, string | null][] = [
            [r.cena1Minor, r.od1, c.sloupec1],
            [r.cena2Minor, r.od2, c.sloupec2],
          ];
          sloupce.forEach(([cena, od, hlavicka], i) => {
            // Sloupec, ktery cenik nema nebo necha prazdny, se nenabizi.
            if (i === 1 && !c.sloupec2) return;
            if (cena === null || cena === undefined) return;
            const dvaSloupce = Boolean(c.sloupec2);
            polozky.push({
              klic: `${r.id}-${i}`,
              popis: dvaSloupce && hlavicka ? `${r.popis} (${hlavicka})` : r.popis,
              cenaMinor: cena,
              od,
            });
          });
        }
        return {
          studioId: c.studioId,
          studioNazev: studio?.name ?? c.nadpis,
          nadpis: c.nadpis,
          mena: String(c.mena),
          polozky,
        };
      })
      .filter((c) => c.polozky.length > 0);
  } catch (err) {
    console.error('Ceniky pro doklady se nepodarilo nacist:', err);
    return [];
  }
}
