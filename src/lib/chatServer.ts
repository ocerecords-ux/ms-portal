import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import type { ChatConversation } from '@/lib/chat';

// Serverova cast chatu - oddelena od lib/chat.ts, protoze konstanty odtamtud
// pouziva i klientsky panel a Prisma se do prohlizece dostat nesmi.

/** Jmeno cloveka do seznamu - jmeno, a kdyz chybi, aspon e-mail. */
export function userLabel(user: { name: string | null; email: string }): string {
  return user.name || user.email;
}

/**
 * Vidi tenhle uzivatel chat? Jen tym Mediaspace, stejne jako Ukoly - klienti
 * a herci se k nemu nedostanou ani pres API.
 */
export function canUseChat(role: Role): boolean {
  return isInternalRole(role);
}

/**
 * Konverzace, ktere ma uzivatel videt: vsechny kanaly k projektum (ty jsou
 * pro cely tym) plus soukrome a skupinove, kde je clenem. U kazde spocitame
 * neprectene zpravy - podle lastReadAt jeho radku clenstvi; kdyz radek jeste
 * nema (kanal, kam nikdy nezasel), pocitaji se vsechny cizi zpravy.
 */
export async function loadConversations(userId: string): Promise<ChatConversation[]> {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ kind: 'PROJEKT' }, { members: { some: { userId } } }],
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 300,
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (conversations.length === 0) return [];

  // Neprectene spocitame jednim dotazem pres vsechny konverzace najednou.
  const meMembers = new Map<string, Date>(
    conversations
      .map((c) => c.members.find((m) => m.userId === userId))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map((m): [string, Date] => [m.conversationId, m.lastReadAt]),
  );

  const counts = await prisma.message.groupBy({
    by: ['conversationId'],
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      userId: { not: userId },
    },
    _count: { _all: true },
  });
  const totalById = new Map(counts.map((c): [string, number] => [c.conversationId, c._count._all]));

  // Kazdy clen ma vlastni lastReadAt, coz do jednoho groupBy nedostaneme.
  // Nacteme proto jednim dotazem zpravy novejsi nez NEJSTARSI z tech hranic a
  // dopocitame v pameti - objem je u tymoveho chatu maly.
  let novejsi: { conversationId: string; createdAt: Date }[] = [];
  if (meMembers.size > 0) {
    const nejstarsi = new Date(Math.min(...[...meMembers.values()].map((d) => d.getTime())));
    novejsi = await prisma.message.findMany({
      where: {
        conversationId: { in: [...meMembers.keys()] },
        userId: { not: userId },
        createdAt: { gt: nejstarsi },
      },
      select: { conversationId: true, createdAt: true },
      take: 5000,
    });
  }

  return conversations.map((c) => {
    const lastRead = meMembers.get(c.id);
    const unread = lastRead
      ? novejsi.filter((m) => m.conversationId === c.id && m.createdAt > lastRead).length
      : (totalById.get(c.id) ?? 0);

    const ostatni = c.members.filter((m) => m.userId !== userId).map((m) => userLabel(m.user));
    const label =
      c.kind === 'SOUKROMA' ? (ostatni[0] ?? 'Soukromá zpráva') : (c.name ?? 'Bez názvu');

    return {
      id: c.id,
      kind: c.kind,
      label,
      unread,
      lastMessageAt: c.lastMessageAt.toISOString(),
      caflouProjectId: c.caflouProjectId,
      memberLabels: ostatni,
    };
  });
}

/** Ostatni clenove tymu - pro zalozeni soukrome zpravy nebo skupiny. */
export async function loadTeam(userId: string) {
  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'ZVUKAR', 'PRODUKCE'] }, active: true, id: { not: userId } },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  });
  return users.map((u) => ({ id: u.id, label: userLabel(u) }));
}
