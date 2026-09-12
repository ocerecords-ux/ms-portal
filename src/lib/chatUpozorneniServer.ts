import type { ChatUpozorneni } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * Komu z příjemců opravdu poslat upozornění na novou zprávu
 * (zadání 12. 9. 2026: „pojďme přidat detailnější nastavení notifikací
 * v chatu, ať si nastaví každý sám individuálně").
 *
 * DO TÉ DOBY dostal upozornění každý, kdo v konverzaci seděl. U přímé zprávy
 * to dává smysl, u kanálu projektu, kde si dva lidé přehazují dvacet vět
 * o mikrofonu, už ne — a člověk pak vypne upozornění úplně, čímž mu utečou
 * i věci, které se ho týkají.
 *
 * TŘI STUPNĚ, ZVLÁŠŤ PRO ROZHOVORY A ZVLÁŠŤ PRO KANÁLY:
 *   VSE    - každá zpráva
 *   ZMINKY - jen když mě někdo zmíní (@Jméno) nebo odpoví v mém vlákně
 *   NIC    - nic
 *
 * K tomu ztlumení JEDNOHO rozhovoru a noční klid. Ztlumení je nejsilnější:
 * když je kanál ztlumený, neprojde ani zmínka — o to při ztlumení jde.
 *
 * Zpráva se doručí vždy; tohle rozhoduje jen o upozornění. Nepřečtené se
 * počítají dál, takže se nic neztratí, jen to nezazvoní.
 */

/** Bez diakritiky a malými písmeny - „Řehoř" má najít i „rehor". */
function klic(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Je ve zprávě zmínka tohohle člověka?
 *
 * Zmínka se do textu vkládá jako „@Jméno Příjmení" (viz ChatDock), ale lidé
 * ji dopisují i ručně a často jen křestním jménem. Bere se proto jak celé
 * jméno, tak jeho první slovo — a jen za zavináčem, aby „@petr" zabralo
 * a věta „ptal se Petr" ne.
 */
export function jeZminen(body: string, jmeno: string | null, email: string): boolean {
  const text = klic(body);
  if (!text.includes('@')) return false;

  const podoby = new Set<string>();
  const cele = (jmeno || '').trim();
  if (cele) {
    podoby.add(klic(cele));
    const prvni = cele.split(/\s+/)[0];
    if (prvni.length >= 3) podoby.add(klic(prvni));
  }
  const pred = email.split('@')[0];
  if (pred.length >= 3) podoby.add(klic(pred));

  for (const podoba of podoby) {
    // Za zavinacem, a hned za jmenem nesmi pokracovat dalsi pismeno -
    // „@petra" neni zminka Petra.
    const kde = text.indexOf(`@${podoba}`);
    if (kde < 0) continue;
    const dalsi = text[kde + 1 + podoba.length];
    if (!dalsi || !/[\p{L}\p{N}]/u.test(dalsi)) return true;
  }
  return false;
}

/** Je teď u tohohle člověka noční klid? Hodiny se počítají v Praze. */
export function jeTicho(od: number | null, doo: number | null, ted = new Date()): boolean {
  if (od === null || doo === null || od === doo) return false;
  const hodina = Number(
    new Intl.DateTimeFormat('cs-CZ', {
      timeZone: 'Europe/Prague',
      hour: 'numeric',
      hour12: false,
    }).format(ted),
  );
  // Rozsah smi prechazet pres pulnoc: 22 -> 7 znamena 22,23,0..6.
  return od < doo ? hodina >= od && hodina < doo : hodina >= od || hodina < doo;
}

export type ZpravaProFiltr = {
  conversationId: string;
  /**
   * Druh rozhovoru. Soukromá zpráva, skupina a kanál projektu mají každý své
   * nastavení (zadání 12. 9. 2026: „potřeboval bych ještě upravovat notifikace
   * zvlášť na soukromé zprávy a na individuální skupiny").
   */
  druh: 'SOUKROMA' | 'SKUPINA' | 'PROJEKT' | 'DOTAZ';
  body: string;
  /** Vlákno, do kterého zpráva patří (null = hlavní proud kanálu). */
  parentId: string | null;
};

/**
 * Profiltruje příjemce podle toho, co si každý nastavil.
 *
 * Nikdy nevyhazuje: kdyby dotaz selhal, je lepší poslat upozornění všem než
 * nikomu — o zprávu tak nikdo nepřijde a nejhorší dopad je jedno zbytečné
 * cinknutí.
 */
export async function komuPoslatUpozorneni(
  prijemci: string[],
  zprava: ZpravaProFiltr,
): Promise<string[]> {
  if (prijemci.length === 0) return [];

  try {
    const [lide, clenstvi, vlakno] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: prijemci } },
        select: {
          id: true,
          name: true,
          email: true,
          chatUpozorneniZpravy: true,
          chatUpozorneniSkupiny: true,
          chatUpozorneniKanaly: true,
          chatTichoOd: true,
          chatTichoDo: true,
        },
      }),
      prisma.conversationMember.findMany({
        where: { conversationId: zprava.conversationId, userId: { in: prijemci } },
        select: { userId: true, ztlumeno: true, upozorneni: true },
      }),
      // Kdo uz ve vlakne mluvil - odpoved ve vlakne se ho tyka i bez zminky.
      zprava.parentId
        ? prisma.message.findMany({
            where: { OR: [{ id: zprava.parentId }, { parentId: zprava.parentId }] },
            select: { userId: true },
          })
        : Promise.resolve([] as { userId: string }[]),
    ]);

    const ztlumeni = new Set(clenstvi.filter((c) => c.ztlumeno).map((c) => c.userId));
    // Nastaveni jen pro tenhle rozhovor - prebiji obecne (zadani 12. 9. 2026).
    const vlastni = new Map(
      clenstvi.filter((c) => c.upozorneni).map((c): [string, ChatUpozorneni] => [c.userId, c.upozorneni!]),
    );
    const veVlakne = new Set(vlakno.map((m) => m.userId));

    return lide
      .filter((clovek) => {
        // Ztlumeny rozhovor prebiji vsechno ostatni - o to pri ztlumeni jde.
        if (ztlumeni.has(clovek.id)) return false;
        if (jeTicho(clovek.chatTichoOd, clovek.chatTichoDo)) return false;

        const podleDruhu: ChatUpozorneni =
          zprava.druh === 'SOUKROMA'
            ? clovek.chatUpozorneniZpravy
            : zprava.druh === 'SKUPINA'
              ? clovek.chatUpozorneniSkupiny
              : clovek.chatUpozorneniKanaly;
        const rezim: ChatUpozorneni = vlastni.get(clovek.id) ?? podleDruhu;
        if (rezim === 'NIC') return false;
        if (rezim === 'VSE') return true;

        // ZMINKY: zminka jmenem, nebo odpoved ve vlakne, kde uz clovek mluvil.
        return jeZminen(zprava.body, clovek.name, clovek.email) || veVlakne.has(clovek.id);
      })
      .map((clovek) => clovek.id);
  } catch (err) {
    console.error('Filtr upozornění selhal, posílám všem:', err);
    return prijemci;
  }
}
