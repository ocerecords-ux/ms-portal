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
  return { posluchac, jmeno: pristup.jmeno ?? 'Klient', interni: Boolean(pristup.interni) };
}

/**
 * Kdo z okna neodesel dele nez minutu, uz nejspis neposloucha - zapisuje se
 * po deseti vterinach, takze minuta je i pri zadrhnute lince s rezervou.
 */
const ZIVY_MS = 60_000;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const kdoJe = await kdo(req, params.id);
  if ('chyba' in kdoJe) return kdoJe.chyba;
  if (!kdoJe.posluchac) return NextResponse.json({ pozice: null });

  const pozice = await prisma.preposlechPozice.findUnique({
    where: { caflouProjectId_posluchac: { caflouProjectId: params.id, posluchac: kdoJe.posluchac } },
    select: { trackIndex: true, localTime: true, updatedAt: true },
  });

  /**
   * Kdo zrovna poslouchá (zadání 11. 9. 2026: „bylo by dobré mít nějakou
   * signalizaci, že někdo poslouchá, myslím, že by tam svítilo něco u nás
   * interně").
   *
   * Posílá se JEN TÝMU. Klient nemá co vědět, kdo si jeho nahrávku zrovna
   * pouští — a sám sebe v tom seznamu vidět nepotřebuje.
   */
  let posluchaci: { jmeno: string; trackIndex: number; localTime: number }[] = [];
  if (kdoJe.interni) {
    const ziji = await prisma.preposlechPozice.findMany({
      where: {
        caflouProjectId: params.id,
        hraje: true,
        updatedAt: { gt: new Date(Date.now() - ZIVY_MS) },
        posluchac: { not: kdoJe.posluchac },
      },
      select: { jmeno: true, trackIndex: true, localTime: true },
      take: 10,
    });
    posluchaci = ziji.map((p) => ({
      jmeno: p.jmeno || 'Někdo',
      trackIndex: p.trackIndex,
      localTime: p.localTime,
    }));
  }

  return NextResponse.json({
    pozice: pozice ? { ...pozice, updatedAt: pozice.updatedAt.toISOString() } : null,
    posluchaci,
  });
}

const schema = z.object({
  trackIndex: z.number().int().min(1).max(999),
  localTime: z.number().min(0).max(24 * 3600),
  hraje: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const kdoJe = await kdo(req, params.id);
  if ('chyba' in kdoJe) return kdoJe.chyba;
  if (!kdoJe.posluchac) return NextResponse.json({ ulozeno: false });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const spolecne = {
    trackIndex: parsed.data.trackIndex,
    localTime: parsed.data.localTime,
    hraje: parsed.data.hraje ?? false,
    jmeno: kdoJe.jmeno,
  };
  await prisma.preposlechPozice.upsert({
    where: { caflouProjectId_posluchac: { caflouProjectId: params.id, posluchac: kdoJe.posluchac } },
    create: { ...spolecne, caflouProjectId: params.id, posluchac: kdoJe.posluchac },
    // updatedAt se prepisuje i pri stejnych hodnotach - prave z nej se pozna,
    // ze u toho nekdo porad sedi.
    update: spolecne,
  });

  return NextResponse.json({ ulozeno: true });
}
