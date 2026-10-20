import { prisma } from '@/lib/db';
import { extractDriveFolderId } from '@/lib/googleDrive';

/**
 * KDY SE NA TÉHLE SLOŽCE DODĚLALO (zadání 20. 10. 2026: „u klientů bych
 * potřeboval, aby na stránce nahrávky bylo řazení i podle dokončení
 * posledního projektu").
 *
 * Disk o zakázkách nic neví - umí jen „upraveno", a to se hne pokaždé, když
 * si někdo do složky něco uloží. Tohle je druhý údaj vedle něj: DATUM
 * ODEVZDÁNÍ zakázky z portálu.
 *
 *  - U SLOŽKY PROJEKTU je to datum odevzdání té zakázky.
 *  - U SLOŽKY KLIENTA je to datum odevzdání jeho POSLEDNÍ hotové zakázky -
 *    podle toho se pozná, u koho se naposledy dodělávalo a kdo už dlouho nic
 *    nemá.
 *
 * JEN HOTOVÉ ZAKÁZKY. U rozdělané je `endDate` plán, ne skutečnost, a datum
 * dokončení, které se ještě nestalo, by řadilo podle přání.
 *
 * Dva dotazy na celou stránku, žádné sahání na Disk: klíčem je ID složky
 * z uloženého odkazu, takže se mapa dá přiložit k výpisu, ať je otevřená
 * kterákoliv úroveň.
 */
export async function mapaDokonceni(): Promise<Record<string, string>> {
  const mapa: Record<string, string> = {};
  try {
    const projekty = (await prisma.projectMeta.findMany({
      where: { finished: true, endDate: { not: null } },
      select: { driveUrl: true, endDate: true, companyId: true },
    })) as { driveUrl: string | null; endDate: Date | null; companyId: string | null }[];

    /** Nejnovější odevzdání u firmy - pro složku klienta. */
    const poFirmach = new Map<string, Date>();

    for (const p of projekty) {
      if (!p.endDate) continue;
      if (p.companyId) {
        const dosud = poFirmach.get(p.companyId);
        if (!dosud || p.endDate > dosud) poFirmach.set(p.companyId, p.endDate);
      }
      const id = p.driveUrl ? extractDriveFolderId(p.driveUrl) : null;
      if (!id) continue;
      const stavajici = mapa[id] ? new Date(mapa[id]) : null;
      // Jedna složka může patřit víc zakázkám (dílům série) - platí ta poslední.
      if (!stavajici || p.endDate > stavajici) mapa[id] = p.endDate.toISOString();
    }

    const firmy = (await prisma.company.findMany({
      where: { driveFolderUrl: { not: null } },
      select: { id: true, driveFolderUrl: true },
    })) as { id: string; driveFolderUrl: string | null }[];

    for (const f of firmy) {
      const kdy = poFirmach.get(f.id);
      if (!kdy) continue;
      const id = f.driveFolderUrl ? extractDriveFolderId(f.driveFolderUrl) : null;
      if (!id) continue;
      const stavajici = mapa[id] ? new Date(mapa[id]) : null;
      if (!stavajici || kdy > stavajici) mapa[id] = kdy.toISOString();
    }
  } catch (err) {
    // Sloupec navíc nesmí shodit výpis Disku - zůstane prázdný.
    console.error('Mapu dokonceni se nepodarilo sestavit:', err);
  }
  return mapa;
}
