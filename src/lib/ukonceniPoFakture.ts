import { prisma } from '@/lib/db';
import { zapisZmenyProjektu } from '@/lib/projektLogServer';
import { STAVY_PROJEKTU } from '@/lib/stavyProjektu';
import { uzavriDotazyProjektu } from '@/lib/dotazyServer';
import { uzavriKanalProjektu } from '@/lib/chatServer';

/**
 * ODESLANÁ FAKTURA ZAVŘE ZAKÁZKU (zadání 19. 10. 2026: „po té automatické
 * fakturaci a odeslání by se měl přehodit projekt Vyfakturováno a přesunout
 * do dokončených", a hned nato „u reklam chybí stav vyfakturováno. Tam by se
 * to mělo překlopit, když se odešle faktura").
 *
 * U AUDIOKNIHY SE PORTÁL PTÁ („Ukončit projekt?", pojistka z 25. 9. 2026):
 * posíláme i ostré zálohové faktury, po kterých zakázka pokračuje, takže
 * fakturu a konec zakázky tam nelze ztotožnit.
 *
 * U REKLAMY JE TO JEDNA FAKTURA NA KONCI. Spot je hotový, odsouhlasený,
 * vyfakturovaný - a ptát se, jestli má zakázka skončit, znamená jen nechat ji
 * viset mezi aktivními, dokud si toho někdo nevšimne.
 *
 * Dělá přesně totéž co ruční ukončení (/api/projekty/[id]/ukonceni): stav
 * „Vyfakturováno", příznak hotovo, a zavřené kanály - kanál projektu i kanál
 * dotazů klienta, ať v chatu nezůstávají hotové zakázky.
 *
 * NIKDY NEVYHAZUJE. Faktura už je u klienta; kdyby se nepovedlo přehodit
 * stav, je to řádek v logu, ne důvod hlásit, že fakturace selhala.
 */

/** Konec cesty projektu - poslední stav v seznamu, ne napsaný řetězec. */
export const STAV_PO_FAKTURE = STAVY_PROJEKTU[STAVY_PROJEKTU.length - 1].nazev;

export async function zavriPoFakture(
  caflouProjectId: string,
  kdo: { id: string | null; jmeno: string | null },
): Promise<void> {
  try {
    const pred = (await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: { statusName: true, finished: true },
    })) as { statusName: string | null; finished: boolean } | null;
    if (!pred) return;
    if (pred.finished && pred.statusName === STAV_PO_FAKTURE) return;

    await prisma.projectMeta.update({
      where: { caflouProjectId },
      data: { statusName: STAV_PO_FAKTURE, finished: true },
    });

    await zapisZmenyProjektu({
      caflouProjectId,
      pred: { statusName: pred.statusName, finished: pred.finished },
      ulozeno: { statusName: STAV_PO_FAKTURE, finished: true },
      puvodce: { id: kdo.id, jmeno: kdo.jmeno },
    }).catch(() => undefined);

    await uzavriDotazyProjektu(caflouProjectId).catch(() => undefined);
    await uzavriKanalProjektu(caflouProjectId).catch(() => undefined);
  } catch (err) {
    console.error(`Projekt ${caflouProjectId} se po faktuře nepodařilo zavřít:`, err);
  }
}
