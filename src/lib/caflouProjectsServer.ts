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

const KLIC = 'internal-projects';
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
export async function loadInternalProjects(): Promise<InternalProjectsResult> {
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

  if (!result.error && result.projects.length > 0) {
    await zapisDoDatabaze(result.projects);
    return result;
  }

  // Caflou nedojelo - radši starší seznam než prázdná stránka.
  if (ulozene && Date.now() - ulozene.fetchedAt.getTime() < DB_STALE_MS) {
    primeInternalProjectsCache(ulozene.projects);
    return { projects: ulozene.projects, error: null };
  }

  return result;
}
