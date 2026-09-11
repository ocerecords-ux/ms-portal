import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractDriveFolderId } from '@/lib/googleDrive';
import { projektPodleTokenu } from '@/lib/preposlechOdkaz';

/**
 * Kořenová složka, ve které smí ten, kdo se ptá, koukat (zadání 11. 9. 2026:
 * „potřebuju, ať se klient nemusí přihlašovat a jsou ty odkazy otevřené,
 * mnohdy to někomu posílá").
 *
 * Dvě cesty dovnitř:
 *
 * 1. TOKEN v adrese (`?k=`) — stejný, jakým se otevírá přeposlech. Platí do
 *    jednoho jediného projektu a pouští jen do JEHO složky. Nikdo se nemusí
 *    přihlašovat, takže odkaz z mailu funguje i přeposlaný dál — a když se
 *    dostane, kam neměl, stačí u projektu vygenerovat nový a starý umře.
 * 2. PŘIHLÁŠENÝ KLIENT — vidí celou složku své firmy, jako dosud.
 *
 * Proč ne ID složky přímo v adrese: to by šlo uhodnout a člověk by koukal do
 * složky cizí firmy. Token je náhodných 24 bajtů a váže se na projekt.
 */
export type Koren = { rootId: string } | { chyba: string; status: number };

export async function korenProZadost(req: NextRequest): Promise<Koren> {
  const token = req.nextUrl.searchParams.get('k');

  if (token) {
    const caflouProjectId = await projektPodleTokenu(token);
    if (!caflouProjectId) {
      return { chyba: 'Odkaz už neplatí.', status: 403 };
    }
    const meta = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: { driveUrl: true },
    });
    const rootId = meta?.driveUrl ? extractDriveFolderId(meta.driveUrl) : null;
    if (!rootId) {
      return { chyba: 'U tohohle projektu zatím není vyplněná složka s nahrávkami.', status: 404 };
    }
    return { rootId };
  }

  const session = await getServerSession(authOptions);
  if (!session || !session.user.companyId) {
    return { chyba: 'Nejste přihlášen k žádné firmě.', status: 401 };
  }
  const company = await prisma.company.findUnique({ where: { id: session.user.companyId } });
  const rootId = company?.driveFolderUrl ? extractDriveFolderId(company.driveFolderUrl) : null;
  if (!rootId) {
    return { chyba: 'Firmě není přiřazena složka na Google Disku.', status: 404 };
  }
  return { rootId };
}
