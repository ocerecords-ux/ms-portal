import { prisma } from '@/lib/db';
import {
  listAllCaflouProjectsForInternal,
  peekInternalProjectsCache,
  primeInternalProjectsCache,
  type AdminDisplayProject,
} from '@/lib/caflou';

/**
 * Načtení interního seznamu projektů - oprava 9. 9. 2026.
 *
 * PROČ TENHLE SOUBOR VZNIKL
 * Přehled projektů si z Caflou stahuje celý účet po stovkách záznamů, tedy
 * osmi dotazy za sebou. Naměřeno na produkci: 12,5 s. Cache na to existovala,
 * ale jen v paměti jedné instance funkce na Vercelu - a jakmile požadavek
 * obsloužila jiná instance (což je běžné), zaplatilo se celých 12,5 s znovu.
 * Proto se seznam nově ukládá i do databáze, kam vidí všechny instance.
 *
 * Pořadí zdrojů, od nejlevnějšího:
 *   1. paměť instance (5 minut) - zadarmo,
 *   2. sdílená cache v databázi (10 minut) - jeden dotaz,
 *   3. Caflou - osm dotazů, jednou za deset minut na celou aplikaci.
 *
 * Když Caflou selže a v databázi je starší seznam, ukáže se radši ten starší
 * než prázdná stránka s chybou - stejná úvaha jako u cache v paměti.
 */

// Klic zamerne "v2": radek ulozeny starsi verzi mohl obsahovat NEUPLNY
// seznam (chyba 9. 9. 2026 - v prehledu zbylo 100 projektu misto 709),
// a ten se uz nesmi pouzit.
const KLIC = 'internal-projects-v2';
const DB_TTL_MS = 10 * 60 * 1000;
/** Jak stará data se ještě smí ukázat, když Caflou zrovna nefunguje. */
const DB_STALE_MS = 24 * 60 * 60 * 1000;

export type InternalProjectsResult = { projects: AdminDisplayProject[]; error: string | null };

/** Data se ukládají jako JSON, takže se z dat musí zpátky udělat Date. */
function reviveDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parsePayload(payload: string): AdminDisplayProject[] | null {
  try {
    const raw = JSON.parse(payload);
    if (!Array.isArray(raw)) return null;
    return raw.map((p) => ({
      ...p,
      finishedAt: reviveDate(p.finishedAt),
      releaseDate: reviveDate(p.releaseDate),
      startDate: reviveDate(p.startDate),
      endDate: reviveDate(p.endDate),
    })) as AdminDisplayProject[];
  } catch (err) {
    console.error('Uložený seznam projektů se nepodařilo přečíst:', err);
    return null;
  }
}

async function nactiZDatabaze(): Promise<{ projects: AdminDisplayProject[]; fetchedAt: Date } | null> {
  try {
    const row = await prisma.caflouProjectsCache.findUnique({ where: { key: KLIC } });
    if (!row) return null;
    const projects = parsePayload(row.payload);
    if (!projects || projects.length === 0) return null;
    return { projects, fetchedAt: row.fetchedAt };
  } catch (err) {
    // Chybějící tabulka (ještě nedoběhl `prisma db push`) nesmí shodit stránku.
    console.error('Sdílenou cache projektů se nepodařilo načíst:', err);
    return null;
  }
}

async function zapisDoDatabaze(projects: AdminDisplayProject[]): Promise<void> {
  try {
    const payload = JSON.stringify(projects);
    await prisma.caflouProjectsCache.upsert({
      where: { key: KLIC },
      create: { key: KLIC, payload, count: projects.length, fetchedAt: new Date() },
      update: { payload, count: projects.length, fetchedAt: new Date() },
    });
  } catch (err) {
    console.error('Sdílenou cache projektů se nepodařilo uložit:', err);
  }
}

/**
 * Seznam všech projektů účtu pro interní přehledy (stránka Projekty, výběr
 * projektu u dokladů). Nikdy nevyhazuje - při chybě vrátí prázdný seznam
 * a text chyby, který si volající zobrazí.
 */
/**
 * Projekty z vlastní databáze (přechod z Caflou, 10. 9. 2026).
 *
 * Jakmile v portálu existuje aspoň jeden projekt s názvem - tedy jakmile
 * proběhl přenos z Caflou nebo někdo projekt založil rovnou tady - přestává
 * se Caflou volat úplně. Přepínač se schválně neřeší proměnnou prostředí:
 * data v portálu jsou tím jediným rozhodujícím znakem, takže se nemůže stát,
 * že by byl přepínač zapnutý a v portálu prázdno.
 */
async function nactiZPortalu(): Promise<AdminDisplayProject[] | null> {
  const projekty = await prisma.projectMeta.findMany({
    where: { name: { not: null } },
    select: {
      caflouProjectId: true,
      name: true,
      companyName: true,
      statusName: true,
      finished: true,
      priority: true,
      pageCount: true,
      narrator: true,
      releaseDate: true,
      startDate: true,
      endDate: true,
      company: { select: { caflouCompanyId: true } },
    },
    orderBy: { name: 'asc' },
  });
  if (projekty.length === 0) return null;

  return projekty.map((p) => ({
    id: Number(p.caflouProjectId),
    name: p.name ?? '',
    finished: p.finished,
    statusName: p.statusName ?? '',
    priority: p.priority,
    narrator: p.narrator,
    pageCount: p.pageCount,
    // Caflou rozlisovalo "finished_at" a "end_date"; v portalu staci datum
    // dokonceni - odznak i razeni si vystaci s nim.
    finishedAt: p.endDate,
    releaseDate: p.releaseDate,
    startDate: p.startDate,
    endDate: p.endDate,
    // Projekt uz je v portalu, takze stitek z Caflou nema co resit.
    clientTag: null,
    companyName: p.companyName ?? '',
    caflouCompanyId: p.company?.caflouCompanyId ?? null,
  }));
}

export async function loadInternalProjects(): Promise<InternalProjectsResult> {
  // 0) Vlastni data maji prednost pred vsim ostatnim - vcetne cache, ktera
  //    drzi starou odpoved z Caflou.
  const zPortalu = await nactiZPortalu();
  if (zPortalu) return { projects: zPortalu, error: null };

  // 1) Paměť instance - když ji máme, nesaháme ani do databáze.
  const zPameti = peekInternalProjectsCache();
  if (zPameti) return { projects: zPameti, error: null };

  // 2) Sdílená cache v databázi.
  const ulozene = await nactiZDatabaze();
  if (ulozene && Date.now() - ulozene.fetchedAt.getTime() < DB_TTL_MS) {
    primeInternalProjectsCache(ulozene.projects);
    return { projects: ulozene.projects, error: null };
  }

  // 3) Teprve teď do Caflou. Názvy firem si držíme u sebe (Caflou u projektu
  //    vrací hlavně ID firmy) a slouží jen k doplnění sloupce Firma.
  const companies = await prisma.company.findMany({
    where: { caflouCompanyId: { not: null } },
    select: { name: true, caflouCompanyId: true },
    orderBy: { name: 'asc' },
  });

  const result = await listAllCaflouProjectsForInternal(
    companies.map((c) => ({ name: c.name, caflouCompanyId: c.caflouCompanyId! })),
  );

  // Ukládá se JEN úplný seznam. Když Caflou uprostřed stránkování odmítne
  // další stránku (typicky 429), dostaneme jen jeho začátek - a protože Caflou
  // řadí od nejstarších, vypadalo by to, že žádné projekty nejsou rozpracované
  // (chyba 9. 9. 2026: v přehledu zbylo 100 projektů z 709 a všechny
  // dokončené). Takový výsledek by se navíc rozlezl do všech instancí.
  if (!result.error && result.complete && result.projects.length > 0) {
    await zapisDoDatabaze(result.projects);
    return result;
  }

  // Nedotaženo nebo chyba - radši starší, ale úplný seznam než useknutá
  // nebo prázdná stránka.
  if (ulozene && Date.now() - ulozene.fetchedAt.getTime() < DB_STALE_MS) {
    primeInternalProjectsCache(ulozene.projects);
    return { projects: ulozene.projects, error: null };
  }

  // Ani cache nemáme. Neúplný seznam je pořád lepší než prázdná stránka, ale
  // musí být vidět, že je useknutý.
  if (!result.error && result.projects.length > 0) {
    return {
      projects: result.projects,
      error: 'Caflou nestihlo vrátit celý seznam, tohle je jen jeho část. Zkuste stránku načíst znovu.',
    };
  }

  return { projects: result.projects, error: result.error };
}

/**
 * Jeden projekt ze sdíleného seznamu - pro detail projektu.
 *
 * Detail se dřív ptal Caflou zvlášť na ten jeden projekt (naměřeno 1,7 s jen
 * za tenhle dotaz), přestože stejná data už leží v seznamu, který si portál
 * drží. Tady se proto sáhne nejdřív do něj; když tam projekt není (nový, ještě
 * nepromítnutý do cache), volající se doptá Caflou přímo.
 *
 * Cena za to je, že údaje na detailu můžou být až deset minut staré - stejně
 * jako v přehledu projektů, odkud se na detail kliká.
 */
export async function findInternalProject(
  caflouProjectId: string,
): Promise<{ project: AdminDisplayProject; caflouCompanyId: string | null } | null> {
  const { projects } = await loadInternalProjects();
  const found = projects.find((p) => String(p.id) === String(caflouProjectId));
  if (!found) return null;
  return { project: found, caflouCompanyId: found.caflouCompanyId };
}
