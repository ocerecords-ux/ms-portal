import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { maPristup } from '@/lib/pristupy';

/**
 * KDO SMÍ DO TECHNIKY (zadání 24. 11. 2026: „potřebuji, ať vedoucí poboček
 * mají oprávnění přidávat techniku").
 *
 * DVĚ ÚROVNĚ, ŽÁDNÁ JMÉNA V KÓDU - stejné pravidlo jako u ceníku studia
 * (lib/studioCenikServer.ts) a u seznamu „Co je potřeba"
 * (lib/pozadavkyStudii.ts):
 *
 *   Žůžo-labůžo nebo zaškrtnuté *Technika* na kartě → celá evidence, všechna
 *                                                     studia, i kategorie,
 *   vedoucí pobočky (`Studio.vedouci`)              → přidává a upravuje kusy
 *                                                     ve studiích, která vede.
 *
 * VIDÍ VŠICHNI STEJNĚ. Je to inventura, ne tajemství: vedoucí z Brna má vidět
 * i to, co stojí v Praze - jinak by se půjčený mikrofon nedohledal. Omezené
 * je jen psaní, a to podle studia u konkrétního kusu.
 *
 * KATEGORIE ZŮSTÁVAJÍ SPRÁVCŮM. Jsou společné pro celou firmu a vedoucí
 * pobočky je k přidání kusu nepotřebuje - kus bez kategorie spadne do „Bez
 * kategorie" a správce ho zařadí.
 */

export type PristupKTechnice = {
  userId: string;
  /** Vidí a mění všechno, včetně kategorií. */
  spravce: boolean;
  /** ID studií, která ten člověk vede. Správce má prázdné - smí všude. */
  vedeStudia: string[];
};

const ZADNY: PristupKTechnice = { userId: '', spravce: false, vedeStudia: [] };

/** Jediné místo, kde se práva k technice zjišťují. */
export async function pristupKTechnice(userId: string, role: string): Promise<PristupKTechnice> {
  try {
    const ucet = (await prisma.user.findUnique({
      where: { id: userId },
      select: {
        superadmin: true,
        pristupy: true,
        vedeStudia: { select: { id: true } },
      },
    })) as {
      superadmin: boolean | null;
      pristupy: string[] | null;
      vedeStudia: { id: string }[];
    } | null;
    if (!ucet) return { ...ZADNY, userId };

    return {
      userId,
      spravce:
        role === 'ADMIN' ||
        maPristup(
          { role, superadmin: ucet.superadmin ?? false, pristupy: ucet.pristupy ?? [] },
          'STUDIA.TECHNIKA',
        ),
      vedeStudia: (ucet.vedeStudia ?? []).map((s) => s.id),
    };
  } catch (err) {
    console.error('Práva k technice se nepodařilo načíst:', err);
    return { ...ZADNY, userId };
  }
}

/** Pustit toho člověka na stránku vůbec? */
export function smiNaTechniku(pristup: PristupKTechnice): boolean {
  return pristup.spravce || pristup.vedeStudia.length > 0;
}

/**
 * Smí zapsat kus, který stojí (nebo má stát) v tomhle studiu?
 *
 * Kus BEZ STUDIA je jen pro správce: „nikde" je stav celé firmy, ne pobočky,
 * a vedoucí by si přes něj mohl sáhnout na cokoliv.
 */
export function smiDoStudia(pristup: PristupKTechnice, studioId: string | null): boolean {
  if (pristup.spravce) return true;
  return Boolean(studioId) && pristup.vedeStudia.includes(studioId as string);
}

/**
 * Totéž ze session - pro API routy. `null` znamená „sem nemáš co psát" a
 * volající vrací 403, stejně jako u requireAdmin.
 */
export async function requireTechniku(): Promise<PristupKTechnice | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  /** Náhledový účet si prohlíží, ale nezapisuje (stejně jako jinde v portálu). */
  if (session.user.jenNahled) return null;
  const pristup = await pristupKTechnice(session.user.id, session.user.role);
  return smiNaTechniku(pristup) ? pristup : null;
}
