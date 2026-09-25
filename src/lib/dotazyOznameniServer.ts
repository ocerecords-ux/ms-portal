import { prisma } from '@/lib/db';
import { sendNovaOdpovedKlientoviEmail } from '@/lib/email';
import { userLabel } from '@/lib/chatServer';

/**
 * MAIL KLIENTOVI, KDYŽ MU V DOTAZECH NĚKDO ODPOVÍ (zadání 25. 9. 2026:
 * „kdyby klient dostal notifikace, když mu v jeho profilu odpoví někdo
 * v chatu, že tam má nepřečtenou zprávu. Ale pak jak už se přihlásí na portál,
 * tak by mu neměla chodit každá nová zpráva").
 *
 * DVĚ POJISTKY, ABY TO NEBYL SPAM:
 *  1. Kdo si zprávy přečetl v posledních patnácti minutách, sedí v portálu -
 *     tomu se nic neposílá, odpověď vidí sám.
 *  2. Jeden mail na jedno nepřečtení: další odejde, teprve až si klient
 *     zprávy přečte (`oznamenoAt` je pak starší než `lastReadAt`). Tým si
 *     může napsat pět zpráv za sebou a klientovi cinkne jednou.
 *
 * Mail nesmí shodit odeslání zprávy - všechno je v try/catch a chyba se jen
 * zapíše do logu.
 */

/** Kdo tu byl před chvílí, je tu nejspíš pořád - tomu mail nechodí. */
const V_PORTALU_MS = 15 * 60_000;

function zaklad(): string {
  return (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
}

export async function oznamKlientoviOdpoved(
  conversationId: string,
  autorId: string,
  telo: string | null,
): Promise<void> {
  try {
    const konverzace = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        kind: true,
        name: true,
        caflouProjectId: true,
        members: {
          select: {
            id: true,
            userId: true,
            lastReadAt: true,
            oznamenoAt: true,
            user: { select: { id: true, role: true, name: true, email: true, active: true } },
          },
        },
      },
    });
    // Jen dotazy klientů; v našich kanálech nemá kdo dostat mail.
    if (!konverzace || konverzace.kind !== 'DOTAZ') return;

    const autor = await prisma.user.findUnique({
      where: { id: autorId },
      select: { name: true, email: true },
    });
    const odKoho = autor ? userLabel(autor) : 'Mediaspace';

    const ted = Date.now();
    const nazevProjektu = konverzace.name || `Projekt ${konverzace.caflouProjectId ?? ''}`.trim();
    // Ukázka bez našich smajlíků a bez roztažení na půl stránky.
    const nahled = telo ? telo.replace(/:ms-[a-z-]+:/g, '').trim().slice(0, 200) : null;
    const odkaz = konverzace.caflouProjectId
      ? `${zaklad()}/projekty?dotaz=${encodeURIComponent(konverzace.caflouProjectId)}`
      : `${zaklad()}/projekty`;

    for (const clen of konverzace.members) {
      if (clen.userId === autorId) continue;
      const u = clen.user;
      if (!u || !u.active || u.role !== 'CLIENT' || !u.email) continue;
      // Sedí v portálu - odpověď uvidí sám.
      if (ted - clen.lastReadAt.getTime() < V_PORTALU_MS) continue;
      // Už jsme psali a od té doby si to nepřečetl.
      if (clen.oznamenoAt && clen.oznamenoAt > clen.lastReadAt) continue;

      const vysledek = await sendNovaOdpovedKlientoviEmail({
        to: u.email,
        jmeno: u.name,
        nazevProjektu,
        odKoho,
        nahled,
        odkaz,
      }).catch((err) => {
        console.error('Mail klientovi o nove zprave selhal:', err);
        return { sent: false as const };
      });

      if (vysledek.sent) {
        await prisma.conversationMember
          .update({ where: { id: clen.id }, data: { oznamenoAt: new Date() } })
          .catch(() => undefined);
      }
    }
  } catch (err) {
    console.error('Oznameni klientovi o nove zprave selhalo:', err);
  }
}
