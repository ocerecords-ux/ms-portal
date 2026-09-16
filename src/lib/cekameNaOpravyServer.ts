import { prisma } from '@/lib/db';
import { STAVY_PROJEKTU } from '@/lib/stavyProjektu';
import { zapisZmenyProjektu } from '@/lib/projektLogServer';
import { posliNotifikaciKeStavu } from '@/lib/notifikaceProjektuServer';

/**
 * PO SEDMI DNECH SE ČEKÁ NA OPRAVY (zadání 10. 9. 2026, dodělané 16. 9. 2026:
 * „funguje nějak to, že u audioknih se po sedmi dnech po tom, co se překlopí
 * projekt na Dokončeno - ke schválení, překlopí sám na Čekáme na opravy?").
 *
 * Nefungovalo. V popisu stavů to stálo od začátku jako záměr, ale nikdy to
 * nikdo nespustil - projekt tak zůstal viset v „Dokončeno - ke schválení",
 * dokud si toho někdo nevšiml, a klient nedostal připomenutí.
 *
 * KDY SE PŘEKLOPÍ: sedmý den po tom, co projekt do stavu vstoupil. Okamžik
 * vstupu se nebere z `updatedAt` (ten se hýbe při každé úpravě projektu, takže
 * by se lhůta pořád posouvala), ale z HISTORIE PROJEKTU - z posledního zápisu,
 * kterým se stav na tenhle změnil. Historie se píše u každé změny stavu
 * (viz projektLogServer), takže to platí i zpětně pro projekty, které v tom
 * stavu už dávno jsou.
 *
 * Ukončeným projektům se nic nepřehazuje.
 */

/** Kolik dní se čeká, než se stav překlopí sám. */
export const DNU_NA_OPRAVY = 7;

const STAV_ODEVZDANO = 'Dokončeno - ke schválení';
const STAV_CEKAME =
  STAVY_PROJEKTU.find((s) => s.nazev === 'Čekáme na opravy')?.nazev ?? 'Čekáme na opravy';

/** Kdy projekt naposledy vstoupil do stavu `stav`. `null` = v historii to není. */
export async function kdyVstoupilDoStavu(
  caflouProjectId: string,
  stav: string,
): Promise<Date | null> {
  try {
    const zapis = await prisma.projektUdalost.findFirst({
      where: { caflouProjectId, pole: 'statusName', nova: stav },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return zapis?.createdAt ?? null;
  } catch (err) {
    console.error('Cteni historie stavu selhalo:', err);
    return null;
  }
}

/**
 * Kolik dní zbývá do překlopení. `null` = projekt v tom stavu není, je
 * ukončený, nebo se nepodařilo zjistit, odkdy v něm je.
 *
 * Záporně to nejde: když lhůta uplynula a cron ještě neproběhl, vrátí se 0.
 */
export function dnuDoPreklopeni(vstupDoStavu: Date | null): number | null {
  if (!vstupDoStavu) return null;
  const konec = new Date(vstupDoStavu);
  konec.setDate(konec.getDate() + DNU_NA_OPRAVY);
  const zbyva = Math.ceil((konec.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, zbyva);
}

export type VysledekPreklopeni = {
  preklopeno: { caflouProjectId: string; nazev: string | null }[];
  preskoceno: number;
};

/**
 * Projde projekty ve stavu „Dokončeno - ke schválení" a ty, které v něm jsou
 * dost dlouho, překlopí. Pouští to denní úloha (viz /api/cron/cekame-na-opravy).
 *
 * Zpráva klientovi odchází stejným způsobem jako při ručním přehození stavu -
 * o tom, jestli u té firmy vzor existuje, rozhoduje notifikaceProjektuServer.
 */
export async function preklopCekameNaOpravy(): Promise<VysledekPreklopeni> {
  const projekty = await prisma.projectMeta.findMany({
    where: { statusName: STAV_ODEVZDANO, finished: false },
    select: { caflouProjectId: true, name: true, statusName: true },
  });

  const preklopeno: VysledekPreklopeni['preklopeno'] = [];
  let preskoceno = 0;

  for (const p of projekty) {
    const vstup = await kdyVstoupilDoStavu(p.caflouProjectId, STAV_ODEVZDANO);
    const zbyva = dnuDoPreklopeni(vstup);
    // Bez záznamu v historii se nic nepřeklápí - radši nechat stát než hádat.
    if (zbyva === null || zbyva > 0) {
      preskoceno += 1;
      continue;
    }

    try {
      await prisma.projectMeta.update({
        where: { caflouProjectId: p.caflouProjectId },
        data: { statusName: STAV_CEKAME },
      });
      await zapisZmenyProjektu({
        caflouProjectId: p.caflouProjectId,
        pred: { statusName: p.statusName },
        ulozeno: { statusName: STAV_CEKAME },
        puvodce: { id: null, jmeno: `Portál (po ${DNU_NA_OPRAVY} dnech)` },
      });
      // Zpráva klientovi je best effort - stav už je přehozený a nesmí na ni čekat.
      void posliNotifikaciKeStavu(p.caflouProjectId, STAV_CEKAME).catch(() => undefined);
      preklopeno.push({ caflouProjectId: p.caflouProjectId, nazev: p.name });
    } catch (err) {
      console.error(`Preklopeni projektu ${p.caflouProjectId} na "${STAV_CEKAME}" selhalo:`, err);
      preskoceno += 1;
    }
  }

  return { preklopeno, preskoceno };
}

export { STAV_ODEVZDANO, STAV_CEKAME };
