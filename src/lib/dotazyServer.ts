import { prisma } from '@/lib/db';
import { userLabel } from '@/lib/chatServer';
import { odkazNaFotku } from '@/lib/fotky';
import { listCaflouProjectsForCompanyCached, mapCaflouProjects } from '@/lib/caflou';

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
  if (meta?.companyId) return meta.companyId === companyId;

  // Projekty prevzate z Caflou nemusi mit companyId vyplnene. Pak se pta
  // stejneho zdroje, ze ktereho se klientovi vykresluje jeho seznam projektu:
  // je to ID mezi projekty jeho firmy v Caflou?
  const firma = await prisma.company.findUnique({
    where: { id: companyId },
    select: { caflouCompanyId: true },
  });
  if (!firma?.caflouCompanyId) return false;

  const vysledek = await listCaflouProjectsForCompanyCached(firma.caflouCompanyId);
  if (!vysledek.ok) return false;
  return mapCaflouProjects(vysledek.body).some((p) => String(p.id) === caflouProjectId);
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
