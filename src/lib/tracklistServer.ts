import { prisma } from '@/lib/db';
import type { Track } from '@/lib/tracklist';

/**
 * TRACKLIST AUDIOKNIHY (zadání 15. 10. 2026: „vytvoř v detailu každého
 * projektu, který je audiokniha, ještě záložku tracklist. Tam bude seznam
 * tracků editovatelný" → „pořadové číslo, název tracku, název kapitoly"
 * → „01, 02, 03").
 *
 * TŘI SLOUPCE, PROTOŽE JSOU TO TŘI RŮZNÉ VĚCI:
 *  - POŘADOVÉ ČÍSLO se nezadává, dopočítá se z pořadí v seznamu a píše se
 *    vždy dvojmístně (01, 02, 03) - stejně jako na začátku názvů souborů.
 *  - NÁZEV TRACKU je jméno samotné stopy / souboru.
 *  - NÁZEV KAPITOLY je, jak se kapitola jmenuje ve výchozí knize. Nemusí
 *    být - ne každá kniha pojmenované kapitoly má, a tehdy se do tagu
 *    title dává název tracku, jen s diakritikou.
 *
 * NIC SE ODNIKUD NENAČÍTÁ (upřesnění 15. 10. 2026: „nechci nikde načítat
 * tracklist"). Tracklist je PŘEDPIS, podle kterého se stopy teprve pojmenují,
 * ne soupis toho, co na Disku leží. Zakládá se naráz z vlastního vzoru.
 */

export type { Track } from '@/lib/tracklist';
export { cisloTracku } from '@/lib/tracklist';

export async function nactiTracklist(caflouProjectId: string): Promise<Track[]> {
  const radky = await prisma.trackProjektu
    .findMany({ where: { caflouProjectId }, orderBy: { poradi: 'asc' } })
    .catch(() => [] as { poradi: number; nazevTracku: string; nazevKapitoly: string }[]);
  return radky.map((r) => ({
    poradi: r.poradi,
    nazevTracku: r.nazevTracku ?? '',
    nazevKapitoly: r.nazevKapitoly ?? '',
  }));
}
