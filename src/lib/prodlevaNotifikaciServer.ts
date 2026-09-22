import { prisma } from '@/lib/db';
import { posliNotifikaciKeStavu } from '@/lib/notifikaceProjektuServer';

/**
 * PRODLEVA NOTIFIKACÍ PŘI ZMĚNĚ STAVU (zadání 22. 9. 2026: „nastav ještě
 * z bezpečnostních důvodů latenci v posílání notifikací při změně stavu. 10s.
 * Bylo by dobré, kdybych to později mohl někde hromadně nastavit").
 *
 * Zpráva klientovi neodchází hned: portál počká nastavenou dobu a pak se
 * podívá, jestli projekt v tom stavu pořád je. Když ho mezitim někdo přehodil
 * jinam (překlep, špatný projekt), zpráva k původnímu stavu NEODEJDE - poslat
 * se pak ze stavu, ve kterém projekt skončil, jen podle jeho vlastní změny.
 *
 * Nastavuje se jednou pro všechny firmy: Administrace → Vzory zpráv.
 */

export const VYCHOZI_PRODLEVA_S = 10;
export const MAX_PRODLEVA_S = 120;

export async function nactiProdlevu(): Promise<number> {
  try {
    const radek = await prisma.nastaveniNotifikaci.findUnique({ where: { id: 'vychozi' } });
    return radek ? radek.prodlevaSekund : VYCHOZI_PRODLEVA_S;
  } catch (err) {
    console.error('Prodlevu notifikací se nepodařilo načíst:', err);
    return VYCHOZI_PRODLEVA_S;
  }
}

export async function nastavProdlevu(sekund: number, zmenilJmeno: string | null): Promise<number> {
  const s = Math.max(0, Math.min(MAX_PRODLEVA_S, Math.round(sekund)));
  await prisma.nastaveniNotifikaci.upsert({
    where: { id: 'vychozi' },
    create: { id: 'vychozi', prodlevaSekund: s, zmenilJmeno },
    update: { prodlevaSekund: s, zmenilJmeno },
  });
  return s;
}

/**
 * Nechá práci doběhnout i po odeslané odpovědi. Na Vercelu přes jeho
 * waitUntil (stejná cesta, jakou používá balíček @vercel/functions), jinde
 * prostě běží dál.
 */
function nechDobehnout(prace: Promise<unknown>): void {
  try {
    const kontext = (globalThis as Record<symbol, unknown>)[Symbol.for('@vercel/request-context')] as
      | { get?: () => { waitUntil?: (p: Promise<unknown>) => void } | undefined }
      | undefined;
    kontext?.get?.()?.waitUntil?.(prace);
  } catch {
    // Bez kontextu Vercelu nic - promise běží tak jako tak.
  }
}

/**
 * Zpráva klientovi ke stavu - po prodlevě a jen když projekt v tom stavu
 * pořád je. Nečeká se na ni (vrací hned).
 */
export function posliNotifikaciPoProdleve(caflouProjectId: string, stav: string): void {
  const prace = (async () => {
    const sekund = await nactiProdlevu();
    if (sekund > 0) await new Promise((r) => setTimeout(r, sekund * 1000));
    const ted = await prisma.projectMeta
      .findUnique({ where: { caflouProjectId }, select: { statusName: true } })
      .catch(() => null);
    if (ted && (ted.statusName ?? '') !== stav) {
      console.log(`[notifikace] ${caflouProjectId}: stav se během ${sekund} s změnil na „${ted.statusName ?? ''}" - zpráva ke „${stav}" neodešla`);
      return;
    }
    await posliNotifikaciKeStavu(caflouProjectId, stav);
  })().catch((err) => console.error('[notifikace] odeslání po prodlevě selhalo:', err));
  nechDobehnout(prace);
}
