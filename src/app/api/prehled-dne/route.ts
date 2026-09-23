import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { prehledNaDen } from '@/lib/ranniPrehledServer';
import { utcParts } from '@/lib/calendar';

/**
 * PŘEHLED DNE DO OKNA V PORTÁLU (zadání 23. 9. 2026: „ať se mi v portálu
 * otevře průhledné vyskakovací okno a tam to bude").
 *
 * GET řekne, jestli se má okno otevřít, a rovnou pošle text. POST si
 * poznamená, že ho člověk viděl - do dalšího rána se pak neukáže.
 *
 * KDY SE UKAZUJE: komu je přehled zapnutý (Můj účet), po sedmé hodině ranní
 * a jen jednou za den. Ráno před sedmou nic - to ještě není „dnešek",
 * kterému by se dalo věřit, protože se do něj ještě zapisuje.
 */
export const dynamic = 'force-dynamic';

const PASMO = 'Europe/Prague';

function den(d: Date): string {
  const p = utcParts(d, PASMO);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ukazat: false });

  try {
    const ja = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ranniPrehled: true, prehledZobrazenAt: true },
    });
    if (!ja?.ranniPrehled) return NextResponse.json({ ukazat: false });

    const ted = new Date();
    const dnes = den(ted);
    if (utcParts(ted, PASMO).hour < 7) return NextResponse.json({ ukazat: false });
    if (ja.prehledZobrazenAt && den(ja.prehledZobrazenAt) === dnes) {
      return NextResponse.json({ ukazat: false });
    }

    const text = await prehledNaDen(session.user.id, ted);
    return NextResponse.json({ ukazat: true, text, den: dnes });
  } catch (err) {
    console.error('GET /api/prehled-dne selhalo:', err);
    return NextResponse.json({ ukazat: false });
  }
}

/** „Viděl jsem ho." Další přijde zítra. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });
  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { prehledZobrazenAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/prehled-dne selhalo:', err);
    return NextResponse.json({ error: 'Nepovedlo se uložit.' }, { status: 500 });
  }
}
