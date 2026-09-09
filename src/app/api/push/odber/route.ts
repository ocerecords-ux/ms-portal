import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Přihlášení a odhlášení odběru upozornění na nové zprávy (zadání 9. 9. 2026).
 *
 * Jeden řádek = jedno zařízení. Endpoint je unikátní, takže opakované
 * povolení na tomtéž zařízení řádek jen přepíše - a přepíše i vlastníka,
 * kdyby se na jednom mobilu přihlásil někdo jiný. Jinak by mu chodila
 * upozornění na cizí zprávy.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  endpoint: z.string().trim().url().max(600),
  p256dh: z.string().trim().min(1).max(400),
  auth: z.string().trim().min(1).max(400),
  zarizeni: z.string().trim().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neplatný odběr.' }, { status: 400 });
    }
    const { endpoint, p256dh, auth, zarizeni } = parsed.data;

    await prisma.pushOdber.upsert({
      where: { endpoint },
      create: { endpoint, p256dh, auth, zarizeni: zarizeni ?? null, userId: session.user.id },
      update: { p256dh, auth, zarizeni: zarizeni ?? null, userId: session.user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/push/odber selhalo:', err);
    return NextResponse.json({ error: 'Odběr se nepodařilo uložit.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });
  }

  try {
    const endpoint = String((await req.json())?.endpoint ?? '');
    if (!endpoint) return NextResponse.json({ error: 'Chybí odběr.' }, { status: 400 });

    // Podminka na userId primo ve where - cizi odber nejde odhlasit.
    await prisma.pushOdber.deleteMany({ where: { endpoint, userId: session.user.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/push/odber selhalo:', err);
    return NextResponse.json({ error: 'Odběr se nepodařilo zrušit.' }, { status: 500 });
  }
}
