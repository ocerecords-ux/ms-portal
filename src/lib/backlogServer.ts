import { prisma } from '@/lib/db';
import { dnuDoTerminu } from '@/lib/terminProjektu';
import type { ZaznamBacklogu } from '@/lib/backlog';

/**
 * PODKLADY PRO BACKLOG (zadání 18. 9. 2026).
 *
 * ODKUD SE BERE „ODEVZDÁNO": z historie projektu - z okamžiku, kdy projekt
 * POPRVÉ vstoupil do stavu „Dokončeno - ke schválení". Přesně jak si to
 * zadavatel přál: „systém myslí a bere si data z toho, kdy se reálně dostal
 * projekt do stavu dokončeno - ke schválení".
 *
 * Bere se PRVNÍ vstup, ne poslední: když se projekt po opravách vrátí a znovu
 * odevzdá, termín stejně splnil (nebo nesplnil) už poprvé. Poslední vstup by
 * z každé opravy dělal skluz.
 *
 * CO V PŘEHLEDU NEBUDE: projekty bez data dokončení (není se čím porovnat)
 * a projekty odevzdané dřív, než portál začal psát historii (10. 9. 2026) -
 * o těch prostě nevíme, kdy se odevzdaly, a hádat se to nedá.
 */

const STAV_ODEVZDANO = 'Dokončeno - ke schválení';

/** Den v místním čase jako YYYY-MM-DD. */
function den(hodnota: Date): string {
  const posun = hodnota.getTimezoneOffset() * 60 * 1000;
  return new Date(hodnota.getTime() - posun).toISOString().slice(0, 10);
}

export async function nactiBacklog(): Promise<ZaznamBacklogu[]> {
  try {
    const udalosti = await prisma.projektUdalost.findMany({
      where: { pole: 'statusName', nova: STAV_ODEVZDANO },
      orderBy: { createdAt: 'asc' },
      select: { caflouProjectId: true, createdAt: true },
    });
    if (udalosti.length === 0) return [];

    // Prvni vstup do stavu na projekt - seznam uz je serazeny od nejstarsiho.
    const prvniOdevzdani = new Map<string, Date>();
    for (const u of udalosti) {
      if (!prvniOdevzdani.has(u.caflouProjectId)) prvniOdevzdani.set(u.caflouProjectId, u.createdAt);
    }

    const projekty = await prisma.projectMeta.findMany({
      where: { caflouProjectId: { in: Array.from(prvniOdevzdani.keys()) }, endDate: { not: null } },
      select: { caflouProjectId: true, name: true, projectType: true, endDate: true },
    });

    // Reklamy najednou, ne dotaz na kazdy projekt zvlast.
    const reklamniTypy = new Set(
      (
        await prisma.priceListItem.findMany({
          where: { rodnyList: true },
          select: { name: true },
        })
      ).map((i) => i.name),
    );

    const zaznamy: ZaznamBacklogu[] = [];
    for (const p of projekty) {
      const odevzdano = prvniOdevzdani.get(p.caflouProjectId);
      if (!odevzdano || !p.endDate) continue;
      const skluz = dnuDoTerminu(p.endDate, odevzdano);
      if (skluz === null) continue;
      zaznamy.push({
        caflouProjectId: p.caflouProjectId,
        nazev: p.name?.trim() || `Projekt ${p.caflouProjectId}`,
        typ: p.projectType,
        reklama: Boolean(p.projectType && reklamniTypy.has(p.projectType)),
        termin: den(p.endDate),
        odevzdano: den(odevzdano),
        skluz,
      });
    }

    // Od nejnovejsiho odevzdani - tabulka pod grafem se cte shora.
    zaznamy.sort((a, b) => b.odevzdano.localeCompare(a.odevzdano));
    return zaznamy;
  } catch (err) {
    // Databaze bez historie nesmi shodit stranku - ukaze se prazdny prehled.
    console.error('Nacteni backlogu selhalo:', err);
    return [];
  }
}
