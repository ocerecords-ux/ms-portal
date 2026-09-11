import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { pristupKPreposlechu } from '@/lib/preposlechPristup';

/**
 * Záložka v přeposlechu (zadání 11. 9. 2026: „aby si nějak jednoduše
 * pamatoval, kde se skončilo v přeposlechu, když si chce dát člověk pauzu").
 *
 * Klíč je PROJEKT + POSLUCHAČ, ne jen projekt. Nahrávku poslouchá víc lidí
 * naráz — zvukař, produkce, klient z odkazu — a skočit doprostřed cizího
 * poslechu je horší než nemít záložku vůbec. Kdo je přihlášený, má ji u účtu;
 * kdo přijde odkazem z mailu, má ji u toho odkazu, protože jiné jméno o něm
 * nevíme.
 */
export const dynamic = 'force-dynamic';

async function kdo(req: NextRequest, caflouProjectId: string) {
  const token = req.nextUrl.searchParams.get('k');
  const pristup = await pristupKPreposlechu(caflouProjectId, token);
  if (!pristup.ok) {
    return { chyba: NextResponse.json({ error: pristup.message }, { status: pristup.status }) };
  }
  // Prihlaseny ucet ma prednost - stejny clovek muze prijit i pres odkaz
  // a zalozku chceme mit jednu.
  const posluchac = pristup.userId ? `u:${pristup.userId}` : token ? `t:${token}` : null;
  return { posluchac };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const kdoJe = await kdo(req, params.id);
  if ('chyba' in kdoJe) return kdoJe.chyba;
  if (!kdoJe.posluchac) return NextResponse.json({ pozice: null });

  const pozice = await prisma.preposlechPozice.findUnique({
    where: { caflouProjectId_posluchac: { caflouProjectId: params.id, posluchac: kdoJe.posluchac } },
    select: { trackIndex: true, localTime: true, updatedAt: true },
  });

  return NextResponse.json({
    pozice: pozice ? { ...pozice, updatedAt: pozice.updatedAt.toISOString() } : null,
  });
}

const schema = z.object({
  trackIndex: z.number().int().min(1).max(999),
  localTime: z.number().min(0).max(24 * 3600),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const kdoJe = await kdo(req, params.id);
  if ('chyba' in kdoJe) return kdoJe.chyba;
  if (!kdoJe.posluchac) return NextResponse.json({ ulozeno: false });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const data = { ...parsed.data, caflouProjectId: params.id, posluchac: kdoJe.posluchac };
  await prisma.preposlechPozice.upsert({
    where: { caflouProjectId_posluchac: { caflouProjectId: params.id, posluchac: kdoJe.posluchac } },
    create: data,
    update: { trackIndex: parsed.data.trackIndex, localTime: parsed.data.localTime },
  });

  return NextResponse.json({ ulozeno: true });
}
