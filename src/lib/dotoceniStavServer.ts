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
 * Odškrtnutí vrací stav zpátky — ale jen tehdy, když je projekt PŘESNĚ v tom
 * stavu, do kterého ho tlačítko přehodilo. Kdo mezitím posunul projekt dál,
 * tomu se odškrtnutím herce stav nevrátí o dva kroky zpět.
 */
const ZPET: Record<string, string> = {
  'Dotočeno': 'Natáčíme',
  'Dotočeno/stříháme': 'Natáčíme/stříháme',
};

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

  await zapisStav(caflouProjectId, stav, cil, puvodce);
  return { zmeneno: true, zStavu: stav, naStav: cil };
}

/** Odškrtnutí — vrátí stav zpátky, viz poznámka u ZPET. */
export async function vratStavPoOdskrtnuti(
  caflouProjectId: string,
  puvodce: Puvodce,
): Promise<VysledekPreklopeni> {
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: { statusName: true },
  });
  const stav = meta?.statusName ?? '';
  const cil = stav ? ZPET[stav] : undefined;
  if (!cil) return { zmeneno: false, duvod: stav ? 'jiny-stav' : 'bez-stavu' };

  await zapisStav(caflouProjectId, stav, cil, puvodce);
  return { zmeneno: true, zStavu: stav, naStav: cil };
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
): Promise<void> {
  const dokonceny = stavJeDokonceny(naStav);
  await prisma.projectMeta.update({
    where: { caflouProjectId },
    data: { statusName: naStav, ...(dokonceny !== null ? { finished: dokonceny } : {}) },
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
