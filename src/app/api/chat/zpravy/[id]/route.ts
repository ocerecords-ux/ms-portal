import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { MAX_MESSAGE_LENGTH } from '@/lib/chat';
import { canUseChat } from '@/lib/chatServer';

/**
 * Uprava vlastni odeslane zpravy (zadani 9. 9. 2026: "bylo by super upravovat
 * me odeslane zpravy, kdyz se treba spletu").
 *
 * Upravit smi vyhradne autor - ani spravce ne. Cizi zprava se tvari, ze
 * neexistuje (404 misto 403), aby se z odpovedi nedalo vycist, co je
 * v konverzaci, do ktere clovek nevidi.
 *
 * Uklada se jen cas posledni upravy, ne historie verzi: v pracovnim chatu by
 * k nicemu nebyla a byl by to citlivy udaj navic. U zpravy se pak vypisuje
 * "upraveno", at je poznat, ze zneni uz neni puvodni.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Zpráva je prázdná.')
    .max(MAX_MESSAGE_LENGTH, 'Zpráva je moc dlouhá.'),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const me = session.user.id;

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    // Podminka na userId je primo ve where, takze cizi zpravu nejde upravit
    // ani zavodem mezi kontrolou a zapisem.
    const zprava = await prisma.message.findFirst({
      where: { id: params.id, userId: me },
      select: { id: true, body: true, editedAt: true },
    });
    if (!zprava) return NextResponse.json({ error: 'Zpráva nenalezena.' }, { status: 404 });

    // Kdyz se text nezmenil, nema smysl zpravu znacit jako upravenou -
    // a hlavne se nesmi zahodit priznak z drivejsi upravy.
    if (zprava.body === parsed.data.body) {
      return NextResponse.json({
        body: zprava.body,
        editedAt: zprava.editedAt ? zprava.editedAt.toISOString() : null,
      });
    }

    const upravena = await prisma.message.update({
      where: { id: zprava.id },
      data: { body: parsed.data.body, editedAt: new Date() },
      select: { body: true, editedAt: true },
    });

    return NextResponse.json({
      body: upravena.body,
      editedAt: upravena.editedAt ? upravena.editedAt.toISOString() : null,
    });
  } catch (err) {
    console.error('PATCH /api/chat/zpravy/[id] selhalo:', err);
    return NextResponse.json({ error: 'Zprávu se nepodařilo upravit.' }, { status: 500 });
  }
}
