import { prisma } from '@/lib/db';
import { stavJeDokonceny } from '@/lib/stavyProjektu';
import { posliNotifikaciKeStavu } from '@/lib/notifikaceProjektuServer';
import { zapisZmenyProjektu } from '@/lib/projektLogServer';
import type { Puvodce } from '@/lib/projektLogServer';

/**
 * Co tlačítko „Dotočeno" u herce udělá se stavem projektu (zadání 11. 9.
 * 2026: „chci to vyřešit, aby nám to tlačítko nedělalo někdy nepořádek").
 *
 * Herec může dotočit ve dvou různých chvílích a stav se podle toho liší:
 *
 *   Natáčíme          -> Dotočeno           (stříhat se ještě nezačalo)
 *   Natáčíme/stříháme -> Dotočeno/stříháme  (stříhá se už během natáčení)
 *
 * V ŽÁDNÉM JINÉM STAVU SE NESAHÁ NA NIC. Ve „V přípravě" se ještě netočilo,
 * v „Dokončeno - ke schválení" a dál je natáčení dávno za námi — přehodit
 * tam stav zpátky by byl přesně ten nepořádek, kterému se chceme vyhnout.
 * Fajfka se uloží vždycky, i když stav zůstane.
 */
const PREKLOPENI: Record<string, string> = {
  'Natáčíme': 'Dotočeno',
  'Natáčíme/stříháme': 'Dotočeno/stříháme',
};

/**
 * CO PŘESNĚ TLAČÍTKO PŘEHODILO si projekt pamatuje (ProjectMeta.dotocenoStavPred
 * a dotocenoStavPo), ne že by se to odvozovalo ze současného stavu.
 *
 * Proč: z „Dotočeno" se ručně pokračuje na „Dotočeno/stříháme" (potvrzeno
 * 11. 9. 2026). Kdyby se návrat počítal z toho, v čem projekt zrovna je,
 * odškrtnutí herce v „Dotočeno/stříháme" by ho poslalo do „Natáčíme/stříháme"
 * — tedy do stavu, ve kterém nikdy nebyl. Takhle se vrací jen to, co tlačítko
 * opravdu udělalo, a jen dokud tam projekt pořád stojí.
 */

export type VysledekPreklopeni =
  | { zmeneno: true; zStavu: string; naStav: string }
  | { zmeneno: false; duvod: 'jiny-stav' | 'chybi-herci' | 'bez-stavu' };

/**
 * Přehodí stav podle dotočení herců.
 *
 * PŘI ZAŠKRTNUTÍ se stav změní, až když mají fajfku VŠICHNI herci projektu.
 * „Dotočeno" znamená, že natáčení skončilo — u dvojhlasu nebo dabingu by
 * stav po prvním herci lhal. Zpráva o dotočeném herci odejde vždycky, ta
 * s tím nesouvisí.
 */
export async function prehodStavPodleDotoceni(
  caflouProjectId: string,
  puvodce: Puvodce,
): Promise<VysledekPreklopeni> {
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: { statusName: true, herci: { select: { id: true } } },
  });
  const stav = meta?.statusName ?? '';
  if (!stav) return { zmeneno: false, duvod: 'bez-stavu' };

  const cil = PREKLOPENI[stav];
  if (!cil) return { zmeneno: false, duvod: 'jiny-stav' };

  const herci = meta?.herci.map((h) => h.id) ?? [];
  if (herci.length === 0) return { zmeneno: false, duvod: 'chybi-herci' };

  const dotoceni = await prisma.herecDotocen.count({
    where: { caflouProjectId, userId: { in: herci } },
  });
  if (dotoceni < herci.length) return { zmeneno: false, duvod: 'chybi-herci' };

  await zapisStav(caflouProjectId, stav, cil, puvodce, { dotocenoStavPred: stav, dotocenoStavPo: cil });
  return { zmeneno: true, zStavu: stav, naStav: cil };
}

/** Odškrtnutí — vrátí stav zpátky, viz poznámka výš. */
export async function vratStavPoOdskrtnuti(
  caflouProjectId: string,
  puvodce: Puvodce,
): Promise<VysledekPreklopeni> {
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: { statusName: true, dotocenoStavPred: true, dotocenoStavPo: true },
  });
  const stav = meta?.statusName ?? '';
  if (!stav) return { zmeneno: false, duvod: 'bez-stavu' };

  // Projekt uz je jinde, nez ho tlacitko nechalo - na stav se nesaha, jen se
  // zapomene, co tlacitko udelalo (uz to stejne neplati).
  if (!meta?.dotocenoStavPo || meta.dotocenoStavPo !== stav || !meta.dotocenoStavPred) {
    if (meta?.dotocenoStavPo || meta?.dotocenoStavPred) {
      await prisma.projectMeta
        .update({
          where: { caflouProjectId },
          data: { dotocenoStavPred: null, dotocenoStavPo: null },
        })
        .catch(() => undefined);
    }
    return { zmeneno: false, duvod: 'jiny-stav' };
  }

  await zapisStav(caflouProjectId, stav, meta.dotocenoStavPred, puvodce, {
    dotocenoStavPred: null,
    dotocenoStavPo: null,
  });
  return { zmeneno: true, zStavu: stav, naStav: meta.dotocenoStavPred };
}

/**
 * Uložení stavu se vším, co k němu patří — rozpracovanost, historie a zpráva
 * klientovi podle nastavení u firmy. Je to schválně stejná cesta, jakou jde
 * ruční přehození stavu, aby se tlačítko nechovalo jinak než select.
 */
async function zapisStav(
  caflouProjectId: string,
  zeStavu: string,
  naStav: string,
  puvodce: Puvodce,
  pamet: { dotocenoStavPred: string | null; dotocenoStavPo: string | null },
): Promise<void> {
  const dokonceny = stavJeDokonceny(naStav);
  await prisma.projectMeta.update({
    where: { caflouProjectId },
    data: {
      statusName: naStav,
      ...(dokonceny !== null ? { finished: dokonceny } : {}),
      ...pamet,
    },
  });

  // Historie i zprava bez cekani - odskrtnuti herce nesmi zdrzet ani shodit
  // to, ze zrovna nejede SMTP.
  void zapisZmenyProjektu({
    caflouProjectId,
    pred: { statusName: zeStavu },
    ulozeno: { statusName: naStav },
    puvodce,
  }).catch(() => undefined);

  void posliNotifikaciKeStavu(caflouProjectId, naStav).catch(() => undefined);
}
