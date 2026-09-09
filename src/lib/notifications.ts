import { prisma } from '@/lib/db';

/**
 * Notifikace v portálu (zadani 8. 9. 2026). Zámerně obecné — nesou je
 * kalendáře, ale stejně dobře poslouží dokladům i smlouvám. Push do mobilu
 * se jednou přidá jako další odesílací kanál, ne jako nový model.
 *
 * E-maily se posílají zvlášť (lib/email.ts) — tohle je jen to, co uživatel
 * uvidí pod zvonkem v liště.
 */

export type NotifyInput = {
  userId: string;
  kind: string;
  title: string;
  body?: string | null;
  url?: string | null;
};

/** Zapíše notifikaci. Selhání nesmí shodit akci, kvůli které vznikla. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        url: input.url ?? null,
      },
    });
  } catch (err) {
    console.error('Notifikaci se nepodařilo uložit:', err);
  }
}

/** Totéž pro víc lidí naráz; duplicitní a prázdná ID se vyhodí. */
export async function notifyMany(userIds: (string | null | undefined)[], input: Omit<NotifyInput, 'userId'>) {
  const unikatni = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  for (const userId of unikatni) {
    await notify({ ...input, userId });
  }
}

export async function loadNotifications(userId: string, limit = 20) {
  try {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch (err) {
    // Databaze bez tabulky Notification (jeste nedobehl `prisma db push`)
    // nesmi shodit cely portal - zvonek proste zustane prazdny.
    console.error('Nacteni notifikaci selhalo:', err);
    return [];
  }
}

export async function countUnread(userId: string): Promise<number> {
  try {
    return await prisma.notification.count({ where: { userId, readAt: null } });
  } catch {
    return 0;
  }
}
