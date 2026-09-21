import { prisma } from '@/lib/db';
import { BRUNO_EMAIL } from '@/lib/brunoServer';
import { komuPoslatUpozorneni } from '@/lib/chatUpozorneniServer';
import { posliPush } from '@/lib/pushServer';
import { spocitejPostup } from '@/lib/preposlechPostup';

/**
 * BRUNO OZNAMUJE DO KANÁLU PROJEKTU (zadání 21. 9. 2026: „potřebujeme dostat
 * notifikaci do kanálu projektu do chatu od Bruna o tom, že klient dokončil
 * přeposlech. Teď se to stalo u Annie bot a nevěděli jsme to").
 *
 * Zpráva jde do kanálu projektu pod Brunovým účtem a cinkne těm, kdo v kanálu
 * jsou - podle jejich nastavení upozornění, stejně jako zpráva od člověka.
 * Kanál, který ještě neexistuje, se založí. Nikdy nevyhazuje.
 */
export async function brunoNapisDoKanalu(caflouProjectId: string, text: string): Promise<boolean> {
  try {
    const bruno = await prisma.user.findUnique({ where: { email: BRUNO_EMAIL }, select: { id: true } });
    if (!bruno) return false;

    let kanal = await prisma.conversation.findUnique({
      where: { caflouProjectId },
      select: { id: true, name: true },
    });
    if (!kanal) {
      const projekt = await prisma.projectMeta.findUnique({ where: { caflouProjectId }, select: { name: true } });
      kanal = await prisma.conversation.create({
        data: { kind: 'PROJEKT', name: projekt?.name || 'Projekt', caflouProjectId, createdById: bruno.id },
        select: { id: true, name: true },
      });
    }

    const ted = new Date();
    await prisma.message.create({ data: { conversationId: kanal.id, userId: bruno.id, body: text, createdAt: ted } });
    await prisma.conversation.update({ where: { id: kanal.id }, data: { lastMessageAt: ted } });

    const clenove = await prisma.conversationMember.findMany({
      where: { conversationId: kanal.id, userId: { not: bruno.id } },
      select: { userId: true },
    });
    const prijemci = await komuPoslatUpozorneni(
      clenove.map((c) => c.userId),
      { conversationId: kanal.id, druh: 'PROJEKT', body: text, parentId: null },
    );
    if (prijemci.length > 0) {
      void posliPush(prijemci, {
        titulek: `# ${kanal.name ?? 'Projekt'}`,
        text: `Bruno: ${text.slice(0, 140)}`,
        odkaz: `/chat?konverzace=${kanal.id}`,
        znacka: `chat-${kanal.id}`,
      });
    }
    return true;
  } catch (err) {
    console.error('Bruno: zprávu do kanálu projektu se nepodařilo poslat:', err);
    return false;
  }
}

/**
 * Text zprávy o dokončeném přeposlechu - kdo, kolik poznámek, kolik procent
 * textu. Stejný text používá i zpětné oznámení v seedu (prisma/seed.ts).
 */
export async function oznamDokoncenyPreposlech(caflouProjectId: string, kdo: string | null, klient: boolean) {
  const [stav, poznamek, stop] = await Promise.all([
    prisma.preposlechStav
      .findUnique({ where: { caflouProjectId }, select: { slyseneStrany: true, slyseneStranyZ: true, textStran: true } })
      .catch(() => null),
    prisma.preposlechChyba.count({ where: { caflouProjectId } }).catch(() => 0),
    prisma.preposlechStav
      .findUnique({ where: { caflouProjectId }, select: { pocetStop: true } })
      .then((s) => s?.pocetStop ?? 0)
      .catch(() => 0),
  ]);
  const postup = stav ? spocitejPostup(stav.slyseneStrany ?? [], stav.slyseneStranyZ ?? stav.textStran) : null;

  const kdoText = kdo?.trim() || (klient ? 'Klient' : 'Někdo z týmu');
  const casti = [
    `✅ Přeposlech je dokončený. ${kdoText} ${klient ? '' : '(tým) '}označil(a) nahrávku jako přeposlechnutou.`,
    `Poznámek k opravě: ${poznamek}${stop ? ` · stop: ${stop}` : ''}${postup ? ` · text: ${postup.procent} %` : ''}.`,
    poznamek > 0 ? 'Poznámky jsou v AudioTaggeru v detailu projektu.' : 'Žádná poznámka k opravě.',
  ];
  return brunoNapisDoKanalu(caflouProjectId, casti.join('\n'));
}
