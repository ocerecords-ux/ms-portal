import { prisma } from '@/lib/db';
import { jeReklamaPodleMeta, nactiCiselnikReklam } from '@/lib/reklamniProjektServer';
import { zapisZmenyProjektu } from '@/lib/projektLogServer';
import { STAV_OPRAVUJEME, STAVY_PROJEKTU } from '@/lib/stavyProjektu';

/**
 * PO DOKONČENÉM PŘEPOSLECHU SE OPRAVUJE (zadání 27. 9. 2026: „když se označí
 * v AudioTaggeru přeposlech jako dokončený, tak už by se neměly odesílat
 * upomínky čekáme na opravy. Ale vytvořil bych pro to nový stav, do kterého by
 * se to překlopilo: Opravujeme").
 *
 * Do téhle chvíle zůstával projekt v „Dokončeno - ke schválení" a denní úloha
 * ho po sedmi dnech překlopila na „Čekáme na opravy" - a klientovi odešlo
 * připomenutí, že na něj čekáme. Jenže on svoje odvedl: přeposlech dokončil
 * a připomínky poslal. Čeká se na NÁS. Stav to teď říká nahlas a zároveň tím
 * projekt z dosahu té denní úlohy zmizí (ta sahá jen na „Dokončeno -
 * ke schválení").
 *
 * JEN U AUDIOKNIH - stejné pravidlo jako u „Čekáme na opravy": u reklamy je
 * cesta projektu krátká a tenhle stav se tam ani nenabízí.
 *
 * DOPŘEDU, NE DOZADU: projekt, který je už schválený nebo vyfakturovaný, se
 * zpátky do oprav nevrací. Druhé kliknutí na „přeposlechnuto" tedy nic nedělá.
 */

const PORADI = STAVY_PROJEKTU.map((s) => s.nazev);

export async function preklopNaOpravujeme(
  caflouProjectId: string,
  kdo: string | null,
): Promise<boolean> {
  try {
    const projekt = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: {
        statusName: true,
        finished: true,
        projectType: true,
        company: { select: { dealsAds: true, dealsAudiobooks: true } },
      },
    });
    if (!projekt || projekt.finished) return false;
    if (projekt.company && !projekt.company.dealsAudiobooks) return false;

    // Jedno pravidlo pro všechna místa (30. 9. 2026) - viz lib/reklamniProjekt.ts.
    if (jeReklamaPodleMeta(projekt, await nactiCiselnikReklam())) return false;

    const ted = PORADI.indexOf((projekt.statusName ?? '').trim());
    const cil = PORADI.indexOf(STAV_OPRAVUJEME);
    // Stav mimo naši cestu (starý přenos z Caflou) necháváme být - nevíme,
    // kde v cestě je, a přepsat ho by znamenalo hádat.
    if (ted < 0 || cil < 0 || ted >= cil) return false;

    await prisma.projectMeta.update({
      where: { caflouProjectId },
      data: { statusName: STAV_OPRAVUJEME },
    });
    await zapisZmenyProjektu({
      caflouProjectId,
      pred: { statusName: projekt.statusName },
      ulozeno: { statusName: STAV_OPRAVUJEME },
      puvodce: { id: null, jmeno: kdo ? `Portál (přeposlech dokončil ${kdo})` : 'Portál (přeposlech dokončen)' },
    });
    return true;
  } catch (err) {
    // Označení přeposlechu nesmí spadnout kvůli stavu projektu.
    console.error('Preklopeni na "Opravujeme" selhalo:', err);
    return false;
  }
}
