import { prisma } from '@/lib/db';
import { getAccessToken } from '@/lib/googleDrive';
import { nactiZDisku } from '@/lib/preposlechDriveServer';
import { pocetStranPdf } from '@/lib/pdfStrany';

/**
 * KOLIK STRAN MÁ TEXT PROJEKTU (zadání 19. 9. 2026: „Progres natáčení má
 * počítat strany v PDF versus zápis stránka, na které se skončilo").
 *
 * Text je PDF ve složce projektu na Disku (končí _RE, viz
 * preposlechDriveServer). Počet stran se uloží k PreposlechStav i s ID
 * souboru, takže se PDF nestahuje při každém otevření přehledu:
 *  - dokud je záznam čerstvý (6 h), bere se z databáze,
 *  - pak se znovu podívá do složky; když je tam pořád TENTÝŽ soubor, jen se
 *    obnoví čas, a stahuje se jen nový nebo vyměněný text.
 * Chyba Disku nic neshodí - projekt pak prostě počet stran nemá.
 */
const CERSTVE_MS = 6 * 60 * 60 * 1000;

async function spocitej(caflouProjectId: string, puvodni: { textSouborId: string | null } | null) {
  const obsah = await nactiZDisku(caflouProjectId);
  if (!obsah.ok || !obsah.text) return null;

  if (puvodni?.textSouborId === obsah.text.id) {
    const z = await prisma.preposlechStav.update({
      where: { caflouProjectId },
      data: { textStranAt: new Date() },
      select: { textStran: true },
    });
    return z.textStran;
  }

  const token = await getAccessToken();
  if (!token) return null;
  const odpoved = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(obsah.text.id)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!odpoved.ok) return null;
  const stran = pocetStranPdf(Buffer.from(await odpoved.arrayBuffer()));

  await prisma.preposlechStav.upsert({
    where: { caflouProjectId },
    create: { caflouProjectId, textSouborId: obsah.text.id, textStran: stran, textStranAt: new Date() },
    update: {
      textSouborId: obsah.text.id,
      textStran: stran,
      textStranAt: new Date(),
      // Vymeneny text = jine strany; stare procento preposlechu by lhalo.
      ...(puvodni?.textSouborId ? { slyseneStrany: [], slyseneStranyZ: stran } : {}),
    },
  });
  return stran;
}

export async function pocetStranTextu(caflouProjectIds: string[]): Promise<Map<string, number>> {
  const vysledek = new Map<string, number>();
  if (caflouProjectIds.length === 0) return vysledek;

  type Ulozeny = { caflouProjectId: string; textSouborId: string | null; textStran: number | null; textStranAt: Date | null };
  const ulozene: Ulozeny[] = await prisma.preposlechStav
    .findMany({
      where: { caflouProjectId: { in: caflouProjectIds } },
      select: { caflouProjectId: true, textSouborId: true, textStran: true, textStranAt: true },
    })
    .catch((): Ulozeny[] => []);
  const podleId = new Map(ulozene.map((u) => [u.caflouProjectId, u]));

  const obnovit: string[] = [];
  for (const id of caflouProjectIds) {
    const u = podleId.get(id);
    if (u?.textStran) vysledek.set(id, u.textStran);
    if (!u?.textStranAt || Date.now() - u.textStranAt.getTime() > CERSTVE_MS) obnovit.push(id);
  }

  // Obnova ma strop - prehled se kvuli Disku nesmi otevirat dlouho. Co se
  // nestihne, dopocita se pri pristim otevreni.
  const LIMIT_MS = 8000;
  await Promise.race([
    Promise.all(
      obnovit.slice(0, 10).map(async (id) => {
        try {
          const n = await spocitej(id, podleId.get(id) ?? null);
          if (n) vysledek.set(id, n);
        } catch (err) {
          console.error(`Pocet stran textu projektu ${id} se nepodarilo zjistit:`, err);
        }
      }),
    ),
    new Promise((hotovo) => setTimeout(hotovo, LIMIT_MS)),
  ]);
  return vysledek;
}
