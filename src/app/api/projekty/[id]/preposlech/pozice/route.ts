import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { pristupKPreposlechu } from '@/lib/preposlechPristup';
import { pridejStrany, spocitejPostup } from '@/lib/preposlechPostup';

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
  // Predstaveny posluchac odkazu (21. 9. 2026) ma zalozku svoji - dva lide
  // s jednim odkazem si ji neprepisuji.
  const posluchac = pristup.userId
    ? `u:${pristup.userId}`
    : pristup.posluchacId
      ? `p:${pristup.posluchacId}`
      : token
        ? `t:${token}`
        : null;
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
    postup: await nactiPostup(params.id),
  });
}

/** Procento přeposlechu podle stran PDF - viz lib/preposlechPostup.ts. */
async function nactiPostup(caflouProjectId: string) {
  const stav = await prisma.preposlechStav
    .findUnique({ where: { caflouProjectId }, select: { slyseneStrany: true, slyseneStranyZ: true, textStran: true } })
    .catch(() => null);
  if (!stav) return null;
  return spocitejPostup(stav.slyseneStrany ?? [], stav.slyseneStranyZ ?? stav.textStran);
}

const schema = z.object({
  trackIndex: z.number().int().min(1).max(999),
  localTime: z.number().min(0).max(24 * 3600),
  hraje: z.boolean().optional(),
  /** Strana PDF, kterou má posluchač zrovna před očima (21. 9. 2026). */
  strana: z.number().int().min(1).max(10000).optional(),
  /** Kolik stran PDF má. */
  stran: z.number().int().min(1).max(10000).optional(),
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
  const { strana, stran } = parsed.data;
  const klic = { caflouProjectId_posluchac: { caflouProjectId: params.id, posluchac: kdoJe.posluchac } };
  const predchozi = strana
    ? await prisma.preposlechPozice.findUnique({ where: klic, select: { strana: true } }).catch(() => null)
    : null;
  await prisma.preposlechPozice.upsert({
    where: klic,
    create: { ...spolecne, strana: strana ?? null, caflouProjectId: params.id, posluchac: kdoJe.posluchac },
    // updatedAt se prepisuje i pri stejnych hodnotach - prave z nej se pozna,
    // ze u toho nekdo porad sedi.
    update: { ...spolecne, ...(strana ? { strana } : {}) },
  });

  /**
   * PROCENTO PŘEPOSLECHU (zadání 21. 9. 2026). Počítá se jen poslech
   * KLIENTA a jen když nahrávka hraje - naše kontrola uvnitř knihy ani
   * listování textem bez zvuku klientovi procenta nepřidá.
   */
  if (!kdoJe.interni && spolecne.hraje && strana && stran) {
    try {
      const stav = await prisma.preposlechStav.findUnique({
        where: { caflouProjectId: params.id },
        select: { slyseneStrany: true, slyseneStranyZ: true },
      });
      const dosud = stav?.slyseneStrany ?? [];
      const nove = pridejStrany(dosud, strana, predchozi?.strana ?? null, stran);
      if (nove.length !== dosud.length || stav?.slyseneStranyZ !== stran) {
        await prisma.preposlechStav.upsert({
          where: { caflouProjectId: params.id },
          create: { caflouProjectId: params.id, slyseneStrany: nove, slyseneStranyZ: stran },
          update: { slyseneStrany: nove, slyseneStranyZ: stran },
        });
      }
    } catch (err) {
      // Procento je navic - zalozka se kvuli nemu ztratit nesmi.
      console.error('Zapis slysenych stran selhal:', err);
    }
  }

  return NextResponse.json({ ulozeno: true, postup: await nactiPostup(params.id) });
}
