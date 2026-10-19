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

/**
 * Zapíše notifikaci. Selhání nesmí shodit akci, kvůli které vznikla.
 *
 * VRACÍ ID ZALOŽENÉHO ŘÁDKU (19. 10. 2026), nebo null, když se zápis nepovedl.
 * Volající, který k témuž upozornění posílá i mail, si tím k němu umí připsat,
 * jestli mail odešel - viz zaznamenejMail níž.
 */
export async function notify(input: NotifyInput): Promise<string | null> {
  try {
    const vznikla = (await prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        url: input.url ?? null,
      },
      select: { id: true },
    })) as { id: string };
    return vznikla.id;
  } catch (err) {
    console.error('Notifikaci se nepodařilo uložit:', err);
    return null;
  }
}

/**
 * Totéž pro víc lidí naráz; duplicitní a prázdná ID se vyhodí.
 * Vrací, komu které upozornění vzniklo - klíčem je id uživatele.
 */
export async function notifyMany(
  userIds: (string | null | undefined)[],
  input: Omit<NotifyInput, 'userId'>,
): Promise<Record<string, string>> {
  const unikatni = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  const vznikle: Record<string, string> = {};
  for (const userId of unikatni) {
    const id = await notify({ ...input, userId });
    if (id) vznikle[userId] = id;
  }
  return vznikle;
}

/**
 * JESTLI K UPOZORNĚNÍ ODEŠEL MAIL (19. 10. 2026: „a prislo ji to
 * upozorneni?").
 *
 * Na otázku, jestli zpráva doopravdy odešla, se do téhle chvíle nedalo
 * odpovědět: výsledek od pošty se zahodil a log Vercelu po pár hodinách
 * zmizí. Teď se zapisuje k samotnému upozornění, takže to jde dohledat
 * i za měsíc.
 *
 * `emailedAt` se vyplní jen při úspěchu. Když pošta zprávu nevzala, zůstane
 * prázdné a důvod je v `emailChyba` - tedy „prázdno a bez chyby" znamená
 * „mail se k tomuhle druhu upozornění neposílá", ne „nedošel".
 *
 * Nikdy nevyhazuje: záznam o mailu nesmí shodit nic, co ho vyvolalo.
 */
export async function zaznamenejMail(
  notifikaceId: string | null | undefined,
  vysledek: { sent: boolean; reason?: string | null },
): Promise<void> {
  if (!notifikaceId) return;
  try {
    await prisma.notification.update({
      where: { id: notifikaceId },
      data: vysledek.sent
        ? { emailedAt: new Date(), emailChyba: null }
        : { emailChyba: (vysledek.reason ?? 'neznámý důvod').slice(0, 500) },
    });
  } catch (err) {
    console.error('Výsledek odeslání mailu se nepodařilo zapsat:', err);
  }
}

/**
 * Druhy, které se pod zvonkem NEUKAZUJÍ.
 *
 * `chat-zminka` sem přibyl 17. 9. 2026 („do zvonečku na horní liště by neměly
 * chodit notifikace zmínky z chatu"). Nové už nevznikají — viz
 * /api/chat/konverzace/[id]/zpravy — ale ty, které vznikly mezi 14. a 17. 9.,
 * jsou v databázi a bez tohohle by pod zvonkem visely dál. Nemažou se:
 * schovat řádek jde vrátit, smazaný se nevrátí.
 */
const SKRYTE_DRUHY = ['chat-zminka'];

export async function loadNotifications(userId: string, limit = 20) {
  try {
    return await prisma.notification.findMany({
      where: { userId, kind: { notIn: SKRYTE_DRUHY } },
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
    return await prisma.notification.count({
      where: { userId, readAt: null, kind: { notIn: SKRYTE_DRUHY } },
    });
  } catch {
    return 0;
  }
}
