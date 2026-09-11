import { prisma } from '@/lib/db';
import { projektZMeta, type AdminDisplayProject } from '@/lib/projektyTypy';

/**
 * Co se z ProjectMeta načítá. Je to napsané u každého dotazu zvlášť a ne
 * vytažené do sdílené konstanty schválně: Prisma odvozuje tvar výsledku právě
 * z tohohle zápisu a přes proměnnou by z něj zbylo „něco s těmi sloupci".
 */

/**
 * Seznam projektů pro interní přehledy — od 11. 9. 2026 z NAŠÍ databáze.
 *
 * CO SE ZMĚNILO: do 11. 9. 2026 se projekty stahovaly z Caflou, celý účet po
 * stovkách záznamů, osmi dotazy za sebou. Naměřeno na produkci 12,5 s, takže
 * kolem toho musela být dvoupatrová cache (paměť instance + sdílená tabulka
 * v databázi) a když Caflou nefungovalo, ukazovala se raději stará data než
 * chyba. Nic z toho už není potřeba: projekty přišly jednorázovým přenosem do
 * ProjectMeta (viz lib/prenosProjektu.ts) a čtou se jedním dotazem odtud.
 *
 * `error` v návratové hodnotě zůstává, aby volající místa nemusela měnit tvar
 * — vyplní se jen tehdy, když selže databáze, což je jiná úroveň problému než
 * nedostupné cizí API.
 */

export type InternalProjectsResult = { projects: AdminDisplayProject[]; error: string | null };

/**
 * Všechny projekty portálu.
 *
 * Projekty BEZ NÁZVU se vynechávají: je to řádek ProjectMeta, který vznikl
 * jen jako nosič našich atributů (třeba u rozpracovaného rodného listu) a
 * jako projekt by v přehledu vypadal jako prázdná řádka.
 */
export async function loadInternalProjects(): Promise<InternalProjectsResult> {
  try {
    const radky = await prisma.projectMeta.findMany({
      where: { name: { not: null } },
      select: {
        caflouProjectId: true,
        name: true,
        statusName: true,
        finished: true,
        priority: true,
        narrator: true,
        pageCount: true,
        releaseDate: true,
        startDate: true,
        endDate: true,
        klientName: true,
        companyName: true,
        company: { select: { name: true, caflouCompanyId: true } },
      },
      orderBy: { name: 'asc' },
    });
    return { projects: radky.map(projektZMeta), error: null };
  } catch (err) {
    console.error('Seznam projektů se nepodařilo načíst:', err);
    return { projects: [], error: 'Projekty se nepodařilo načíst z databáze.' };
  }
}

/**
 * Jeden projekt. `null` = v portálu není.
 *
 * Tvar návratové hodnoty zůstal z doby Caflou, aby detail projektu nemusel
 * měnit rozhraní; `caflouCompanyId` je dnes jen pro dohledání ve starých
 * datech.
 */
export async function findInternalProject(
  caflouProjectId: string,
): Promise<{ project: AdminDisplayProject; caflouCompanyId: string | null } | null> {
  try {
    const radek = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: {
        caflouProjectId: true,
        name: true,
        statusName: true,
        finished: true,
        priority: true,
        narrator: true,
        pageCount: true,
        releaseDate: true,
        startDate: true,
        endDate: true,
        klientName: true,
        companyName: true,
        company: { select: { name: true, caflouCompanyId: true } },
      },
    });
    if (!radek || !radek.name) return null;
    const project = projektZMeta(radek);
    return { project, caflouCompanyId: project.caflouCompanyId };
  } catch (err) {
    console.error('Projekt se nepodařilo načíst:', err);
    return null;
  }
}
