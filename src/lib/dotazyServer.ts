import { prisma } from '@/lib/db';
import { userLabel } from '@/lib/chatServer';
import { odkazNaFotku } from '@/lib/fotky';

/**
 * Dotazy klienta k projektu (zadání 11. 9. 2026: „chtěl bych přidat
 * k projektům, ale pouze do klientské sekce, tlačítko Zeptat se").
 *
 * Klient nemá přístup do MS chatu a mít ho nebude. Tohle je úzká branka:
 * jeden kanál na dvojici projekt + firma, ve kterém sedí klient a lidé
 * z Mediaspace se zaškrtnutým „Dostává dotazy klientů". U nás kanál naskočí
 * v MS chatu jako každá jiná konverzace, klient vidí jen ten svůj.
 *
 * KAŽDÉ ČTENÍ I PSANÍ SI OVĚŘUJE, ŽE PROJEKT PATŘÍ FIRMĚ PŘIHLÁŠENÉHO
 * KLIENTA - id projektu chodí z prohlížeče, takže se mu nedá věřit.
 */

export type DotazZprava = {
  id: string;
  body: string;
  createdAt: string;
  authorLabel: string;
  authorPhotoUrl: string | null;
  mine: boolean;
};

/** Projekt patří firmě klienta? Bez toho se nic nečte ani nepíše. */
export async function projektPatriFirme(caflouProjectId: string, companyId: string): Promise<boolean> {
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: { companyId: true },
  });
  // Zadna firma u projektu = nikdo se k nemu pres dotazy nedostane. Do
  // 11. 9. 2026 se tu jako zaloha hledalo mezi projekty firmy v Caflou;
  // po odpojeni je firma u projektu jediny zdroj a musi byt vyplnena.
  return meta?.companyId === companyId;
}

/** Kdo z Mediaspace dostává dotazy klientů. */
async function prijemciDotazu(): Promise<string[]> {
  const lide = await prisma.user.findMany({
    where: { active: true, prijimaDotazyKlientu: true, role: { in: ['ADMIN', 'ZVUKAR', 'PRODUKCE'] } },
    select: { id: true },
  });
  return lide.map((u) => u.id);
}

/** Existující kanál dotazu, nebo null. Nic nezakládá. */
export async function najdiKanal(caflouProjectId: string, companyId: string) {
  return prisma.conversation.findFirst({
    where: { kind: 'DOTAZ', dotazProjektId: caflouProjectId, dotazCompanyId: companyId },
    select: { id: true, uzavrenoAt: true },
  });
}

/**
 * Kanál k projektu - založí se až s prvním dotazem, aby nevznikaly prázdné
 * konverzace u projektů, kde se nikdo na nic nezeptal.
 */
async function zalozKanal(caflouProjectId: string, projectName: string, companyId: string, klientId: string) {
  const prijemci = await prijemciDotazu();
  const clenove = Array.from(new Set<string>([klientId, ...prijemci]));

  return prisma.conversation.create({
    data: {
      kind: 'DOTAZ',
      name: `Dotaz: ${projectName}`,
      dotazProjektId: caflouProjectId,
      dotazCompanyId: companyId,
      createdById: klientId,
      members: { create: clenove.map((userId) => ({ userId })) },
    },
    select: { id: true, uzavrenoAt: true },
  });
}

/**
 * SEZNAM PROJEKTŮ PRO KLIENTSKÝ DOK (zadání 12. 9. 2026: „udělal bych
 * stabilní chat na pravé straně, jak to máme interně, kde by zůstávaly
 * konverzace k projektům, když se klient bude na něco doptávat").
 *
 * Vrací všechny rozpracované projekty klienta — i ty, kde se ještě na nic
 * nezeptal. Dok je tak zároveň místo, kde se dotaz zakládá; prázdné kanály
 * přitom nevznikají, kanál pořád vzniká až první zprávou.
 */
export type DotazVSeznamu = {
  projektId: string;
  nazev: string;
  /** Kolik zpráv od nás klient ještě neviděl. */
  neprectene: number;
  /** Poslední zpráva v kanálu; bez kanálu null. */
  posledniAt: string | null;
  zalozeno: boolean;
  uzavreno: boolean;
};

export async function nactiDotazyKlienta(companyId: string, userId: string): Promise<DotazVSeznamu[]> {
  const projekty = await prisma.projectMeta.findMany({
    where: { companyId, klientUserId: userId, finished: false, name: { not: null } },
    select: { caflouProjectId: true, name: true },
    orderBy: { name: 'asc' },
    take: 200,
  });
  if (projekty.length === 0) return [];

  const kanaly = await prisma.conversation.findMany({
    where: {
      kind: 'DOTAZ',
      dotazCompanyId: companyId,
      dotazProjektId: { in: projekty.map((p) => p.caflouProjectId) },
    },
    select: {
      id: true,
      dotazProjektId: true,
      uzavrenoAt: true,
      lastMessageAt: true,
      members: { where: { userId }, select: { lastReadAt: true } },
    },
  });
  if (kanaly.length === 0) {
    return projekty.map((p) => ({
      projektId: p.caflouProjectId,
      nazev: p.name ?? '',
      neprectene: 0,
      posledniAt: null,
      zalozeno: false,
      uzavreno: false,
    }));
  }

  // Neprectene jednim dotazem pres vsechny kanaly - u klienta jich je par,
  // ale i tak nema smysl se ptat na kazdy zvlast.
  const cizi = await prisma.message.findMany({
    where: { conversationId: { in: kanaly.map((k) => k.id) }, userId: { not: userId } },
    select: { conversationId: true, createdAt: true },
    take: 2000,
  });

  const podleProjektu = new Map(kanaly.map((k) => [k.dotazProjektId ?? '', k]));
  return projekty.map((p) => {
    const kanal = podleProjektu.get(p.caflouProjectId);
    if (!kanal) {
      return {
        projektId: p.caflouProjectId,
        nazev: p.name ?? '',
        neprectene: 0,
        posledniAt: null,
        zalozeno: false,
        uzavreno: false,
      };
    }
    const videno = kanal.members[0]?.lastReadAt ?? null;
    const neprectene = cizi.filter(
      (m) => m.conversationId === kanal.id && (!videno || m.createdAt > videno),
    ).length;
    return {
      projektId: p.caflouProjectId,
      nazev: p.name ?? '',
      neprectene,
      posledniAt: kanal.lastMessageAt.toISOString(),
      zalozeno: true,
      uzavreno: Boolean(kanal.uzavrenoAt),
    };
  });
}

/** Zprávy kanálu pro klienta. Když kanál ještě není, vrátí prázdno. */
export async function nactiDotaz(
  caflouProjectId: string,
  companyId: string,
  userId: string,
): Promise<{ zalozeno: boolean; uzavreno: boolean; zpravy: DotazZprava[] }> {
  const kanal = await najdiKanal(caflouProjectId, companyId);
  if (!kanal) return { zalozeno: false, uzavreno: false, zpravy: [] };

  const [zpravy] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: kanal.id, parentId: null },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { user: { select: { id: true, name: true, email: true, photoUrl: true } } },
    }),
    prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: kanal.id, userId } },
      update: { lastReadAt: new Date() },
      create: { conversationId: kanal.id, userId },
    }),
  ]);

  return {
    zalozeno: true,
    uzavreno: Boolean(kanal.uzavrenoAt),
    zpravy: zpravy.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      authorLabel: userLabel(m.user),
      authorPhotoUrl: odkazNaFotku(m.userId, m.user.photoUrl),
      mine: m.userId === userId,
    })),
  };
}

/** Odeslání dotazu. Kanál vznikne, pokud ještě není. */
export async function posliDotaz(
  caflouProjectId: string,
  projectName: string,
  companyId: string,
  userId: string,
  text: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const telo = text.trim();
  if (!telo) return { ok: false, message: 'Napište prosím dotaz.' };
  if (telo.length > 4000) return { ok: false, message: 'Dotaz je příliš dlouhý.' };

  let kanal = await najdiKanal(caflouProjectId, companyId);
  if (kanal?.uzavrenoAt) {
    return { ok: false, message: 'Projekt je dokončený, tenhle kanál je už uzavřený.' };
  }
  if (!kanal) kanal = await zalozKanal(caflouProjectId, projectName, companyId, userId);

  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: kanal.id, userId, body: telo } }),
    prisma.conversation.update({ where: { id: kanal.id }, data: { lastMessageAt: new Date() } }),
  ]);

  return { ok: true };
}

/**
 * Uzavře kanály dotazů k projektu - volá se, když projekt přejde do
 * dokončeného stavu. Klientovi tlačítko zmizí (nabízí se jen u aktivních
 * projektů) a nám kanál vypadne ze seznamu; historie zůstává v databázi.
 */
export async function uzavriDotazyProjektu(caflouProjectId: string): Promise<void> {
  try {
    await prisma.conversation.updateMany({
      where: { kind: 'DOTAZ', dotazProjektId: caflouProjectId, uzavrenoAt: null },
      data: { uzavrenoAt: new Date() },
    });
  } catch (err) {
    // Uzavreni kanalu nikdy nesmi shodit ulozeni stavu projektu.
    console.error('Uzavreni kanalu dotazu selhalo:', err);
  }
}
