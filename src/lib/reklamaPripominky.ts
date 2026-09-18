import { prisma } from '@/lib/db';
import { extractDriveFolderId, getAccessToken, getFileMeta, isWithinRoot } from '@/lib/googleDrive';
import { projektPodleTokenu } from '@/lib/preposlechOdkaz';

/**
 * PŘIPOMÍNKY KLIENTA K REKLAMNÍMU VIDEU (zadání 18. 9. 2026).
 *
 * Vstupenka je TÝŽ TOKEN jako u nahrávek a přeposlechu: klient se nikam
 * nepřihlašuje, odkaz si může přeposlat a když se dostane, kam neměl, stačí
 * u projektu vygenerovat nový. Token platí do jednoho projektu - a soubor se
 * navíc ověřuje proti složce toho projektu, takže cizí video přes něj otevřít
 * nejde, ani kdyby někdo ID souboru uhodl.
 */

export type PristupKVideu =
  | { caflouProjectId: string; fileId: string; nazev: string; mimeType: string }
  | { chyba: string; status: number };

export async function pristupKVideu(token: string, fileId: string): Promise<PristupKVideu> {
  const caflouProjectId = await projektPodleTokenu(token);
  if (!caflouProjectId) return { chyba: 'Odkaz už neplatí.', status: 403 };

  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: { driveUrl: true },
  });
  const rootId = meta?.driveUrl ? extractDriveFolderId(meta.driveUrl) : null;
  if (!rootId) return { chyba: 'U tohohle projektu zatím není složka s nahrávkami.', status: 404 };

  const pristup = await getAccessToken();
  if (!pristup) return { chyba: 'Napojení na Google Disk zatím není nastavené.', status: 503 };

  const uvnitr = fileId === rootId || (await isWithinRoot(fileId, rootId, pristup));
  if (!uvnitr) return { chyba: 'K tomuhle souboru odkaz nepustí.', status: 403 };

  const soubor = await getFileMeta(fileId, pristup);
  if (!soubor) return { chyba: 'Soubor se nenašel.', status: 404 };

  return { caflouProjectId, fileId, nazev: soubor.name, mimeType: soubor.mimeType };
}

export type PripominkaKVideu = {
  id: string;
  cas: number;
  text: string;
  autorJmeno: string | null;
  vyrizeno: boolean;
  createdAt: string;
};

export async function nactiPripominky(
  caflouProjectId: string,
  driveFileId: string,
): Promise<PripominkaKVideu[]> {
  try {
    const radky = await prisma.reklamaPripominka.findMany({
      where: { caflouProjectId, driveFileId },
      orderBy: { cas: 'asc' },
      take: 500,
    });
    return radky.map((r) => ({
      id: r.id,
      cas: r.cas,
      text: r.text,
      autorJmeno: r.autorJmeno,
      vyrizeno: r.vyrizeno,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (err) {
    // Databaze bez tabulky (jeste nedobehl `prisma db push`) nesmi shodit
    // stranku - klient uvidi prazdny seznam misto chyby.
    console.error('Nacteni pripominek k videu selhalo:', err);
    return [];
  }
}

/**
 * Dělá tahle firma reklamy? Podle toho se u videa ve složce nabízí tlačítko
 * „Připomínkovat" (zadání 18. 9. 2026: „chci mít u klientů, kterým děláme
 * reklamu, modifikovaný AudioTagger").
 *
 * Rozhoduje zaškrtávátko na kartě firmy (Druh zakázek ▸ Reklamy), ne typ
 * projektu - tak si to zadavatel vybral: platí to pro všechny projekty té
 * firmy.
 */
export async function jeReklamniKlient(caflouProjectId: string): Promise<boolean> {
  try {
    const meta = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: { company: { select: { dealsAds: true } } },
    });
    return meta?.company?.dealsAds === true;
  } catch (err) {
    console.error('Overeni reklamniho klienta selhalo:', err);
    return false;
  }
}
