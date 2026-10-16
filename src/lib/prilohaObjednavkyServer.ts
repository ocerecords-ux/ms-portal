import { prisma } from '@/lib/db';
import { extractDriveFolderId, nahrajSouborDoSlozky } from '@/lib/googleDrive';
import { klicZAdresyUloziste, stahniZUloziste } from '@/lib/storage';

/**
 * PŘÍLOHA OBJEDNÁVKY DO SLOŽKY PROJEKTU NA DISKU (zadání 22. 9. 2026: „pořád
 * se nevkládají PDF automaticky do složky projektu z nové objednávky").
 *
 * Soubor leží v našem úložišti; stáhne se a nahraje do složky projektu.
 * Výsledek se ZAPÍŠE K OBJEDNÁVCE (diskPrilohaId / diskPrilohaChyba) - dřív
 * šel důvod selhání jen do logu serveru a nikdo se nedozvěděl, proč tam PDF
 * není. V detailu projektu je pak vidět a jde to zkusit znovu.
 */
export async function nahrajPrilohuObjednavkyNaDisk(
  orderId: string,
): Promise<{ ok: true } | { ok: false; chyba: string }> {
  const zapis = async (data: { diskPrilohaId?: string | null; diskPrilohaChyba: string | null }) => {
    await prisma.order.update({ where: { id: orderId }, data }).catch(() => undefined);
  };
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        attachmentUrl: true,
        attachmentName: true,
        caflouProjectId: true,
        // DALŠÍ PŘÍLOHY (16. 10. 2026) - do složky patří stejně jako hlavní.
        dalsiPrilohy: { select: { url: true, nazev: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) return { ok: false, chyba: 'Objednávka neexistuje.' };
    if (!order.attachmentUrl && order.dalsiPrilohy.length === 0) {
      return { ok: false, chyba: 'Objednávka nemá přílohu.' };
    }

    const meta = order.caflouProjectId
      ? await prisma.projectMeta.findUnique({ where: { caflouProjectId: order.caflouProjectId }, select: { driveUrl: true } })
      : null;
    const slozka = meta?.driveUrl ? extractDriveFolderId(meta.driveUrl) : null;
    if (!slozka) {
      const chyba = 'Projekt nemá složku na Disku.';
      await zapis({ diskPrilohaChyba: chyba });
      return { ok: false, chyba };
    }

    /**
     * DALŠÍ PŘÍLOHY JDOU DO TÉŽE SLOŽKY (16. 10. 2026), ale jen „jak to
     * půjde": stav, který se ukazuje v detailu projektu, se pořád týká
     * hlavní přílohy - to je ten text, na který se čeká. Kdyby neúspěch
     * u obálky přepsal zelený stav rukopisu, hlásil by portál problém tam,
     * kde žádný není.
     */
    const doSlozky = async (url: string, nazev: string) => {
      const klic = klicZAdresyUloziste(url);
      const soubor = klic ? await stahniZUloziste(klic) : null;
      if (!soubor) return { ok: false as const, duvod: 'Přílohu se nepodařilo stáhnout z úložiště portálu.' };
      return nahrajSouborDoSlozky(slozka, nazev || 'priloha', soubor.bytes, soubor.mime);
    };

    for (const dalsi of order.dalsiPrilohy) {
      const vysledek = await doSlozky(dalsi.url, dalsi.nazev);
      if (!vysledek.ok) {
        console.error(`Další příloha objednávky ${orderId} („${dalsi.nazev}") na Disk: ${vysledek.duvod}`);
      }
    }

    if (!order.attachmentUrl) return { ok: true };

    const nahrano = await doSlozky(order.attachmentUrl, order.attachmentName || 'priloha');
    if (!nahrano.ok) {
      console.error(`Příloha objednávky ${orderId} na Disk: ${nahrano.duvod}`);
      await zapis({ diskPrilohaChyba: nahrano.duvod });
      return { ok: false, chyba: nahrano.duvod };
    }
    await zapis({ diskPrilohaId: nahrano.id, diskPrilohaChyba: null });
    return { ok: true };
  } catch (err) {
    console.error(`Příloha objednávky ${orderId} na Disk spadla:`, err);
    const chyba = err instanceof Error ? err.message : 'Neznámá chyba.';
    await zapis({ diskPrilohaChyba: chyba });
    return { ok: false, chyba };
  }
}
