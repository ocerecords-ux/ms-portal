import { prisma } from '@/lib/db';
import { BRUNO_EMAIL } from '@/lib/brunoServer';
import { komuPoslatUpozorneni } from '@/lib/chatUpozorneniServer';
import { posliPush } from '@/lib/pushServer';

/**
 * SMLOUVY OD KLIENTA - archiv u projektu (zadání 21. 9. 2026). Viz model
 * SmlouvaKlienta v schema.prisma.
 */

export type SmlouvaKlientaVSeznamu = {
  id: string;
  nazev: string;
  nazevSouboru: string;
  velikost: number | null;
  podepsanoDne: string | null;
  nahralJmeno: string | null;
  createdAt: string;
  oznamenoAt: string | null;
  oznamenoKomu: string | null;
};

export async function nactiSmlouvyKlienta(caflouProjectId: string): Promise<SmlouvaKlientaVSeznamu[]> {
  const radky = await prisma.smlouvaKlienta
    .findMany({ where: { caflouProjectId }, orderBy: { createdAt: 'desc' } })
    .catch(() => []);
  return radky.map((r) => ({
    id: r.id,
    nazev: r.nazev,
    nazevSouboru: r.nazevSouboru,
    velikost: r.velikost,
    podepsanoDne: r.podepsanoDne ? r.podepsanoDne.toISOString().slice(0, 10) : null,
    nahralJmeno: r.nahralJmeno,
    createdAt: r.createdAt.toISOString(),
    oznamenoAt: r.oznamenoAt ? r.oznamenoAt.toISOString() : null,
    oznamenoKomu: r.oznamenoKomu,
  }));
}

/**
 * Komu Bruno o smlouvě píše, když se nevybere nikdo jiný: Bára Šiblová
 * (zadání: „Bruno napíše třeba soukromě do chatu Báře Šiblové"). Hledá se
 * podle příjmení, ať to přežije „Bára" i „Barbora".
 */
export async function vychoziPrijemceSmlouvy(): Promise<{ id: string; jmeno: string } | null> {
  const lide = await prisma.user
    .findMany({
      where: { active: true, role: { in: ['ADMIN', 'PRODUKCE', 'ZVUKAR'] } },
      select: { id: true, name: true, email: true },
    })
    .catch(() => []);
  const bez = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const bara = lide.find((l) => bez(l.name ?? '').includes('siblov') || bez(l.email).includes('siblov'));
  return bara ? { id: bara.id, jmeno: bara.name || bara.email } : null;
}

/**
 * Bruno napíše SOUKROMOU zprávu jednomu člověku z týmu. Soukromý rozhovor
 * Bruno ↔ člověk se najde, nebo založí. Cinkne podle nastavení upozornění
 * toho člověka. Vrací false, když to nejde (Bruno nemá účet).
 */
export async function brunoNapisSoukrome(prijemceId: string, text: string): Promise<boolean> {
  const bruno = await prisma.user.findUnique({ where: { email: BRUNO_EMAIL }, select: { id: true } });
  if (!bruno) return false;

  let rozhovor = await prisma.conversation.findFirst({
    where: {
      kind: 'SOUKROMA',
      AND: [{ members: { some: { userId: bruno.id } } }, { members: { some: { userId: prijemceId } } }],
    },
    select: { id: true },
  });
  if (!rozhovor) {
    rozhovor = await prisma.conversation.create({
      data: {
        kind: 'SOUKROMA',
        createdById: bruno.id,
        members: { create: [{ userId: bruno.id }, { userId: prijemceId }] },
      },
      select: { id: true },
    });
  }

  const ted = new Date();
  await prisma.message.create({ data: { conversationId: rozhovor.id, userId: bruno.id, body: text, createdAt: ted } });
  await prisma.conversation.update({ where: { id: rozhovor.id }, data: { lastMessageAt: ted } });

  const komu = await komuPoslatUpozorneni([prijemceId], {
    conversationId: rozhovor.id,
    druh: 'SOUKROMA',
    body: text,
    parentId: null,
  });
  if (komu.length > 0) {
    void posliPush(komu, {
      titulek: 'Bruno',
      text: text.slice(0, 140),
      odkaz: `/chat?konverzace=${rozhovor.id}`,
      znacka: `chat-${rozhovor.id}`,
    });
  }
  return true;
}
