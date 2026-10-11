import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ZPRAVA_PLATNOST_MS, type ZpravaPultu } from '@/lib/pultNataceni';

/**
 * POŠTOVNÍ SCHRÁNKA NAŠEHO HOVORU (zadání 11. 10. 2026).
 *
 * Než se dva prohlížeče najdou, musí si vyměnit popis spojení. Obvykle se na
 * to drží otevřený WebSocket - jenže Vercel dlouhé spojení neudrží a další
 * placenou službu kvůli tomu zavádět nechceme. Tady si tedy zprávy jen
 * odkládají do databáze a jednou za chvíli se pro ně chodí.
 *
 * Je to pomalejší, ale JEN při navazování. Jakmile spojení stojí, obraz
 * a zvuk jdou přímo mezi lidmi a tudy už nechodí nic.
 *
 * VEŘEJNÉ BEZ PŘIHLÁŠENÍ - chrání to náhodný token místnosti, stejně jako
 * čekárnu. Kdo token nemá, nedostane ani seznam účastníků.
 *
 * GET  = vyzvedni, co je pro mě (a hned to zahoď)
 * POST = polož zprávu pro někoho / pro všechny
 */
export const dynamic = 'force-dynamic';

async function najdiMistnost(token: string) {
  return prisma.studioBlock
    .findUnique({ where: { pultToken: token }, select: { id: true } })
    .catch(() => null);
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const mistnost = await najdiMistnost(params.token);
  if (!mistnost) return NextResponse.json({ chyba: 'Místnost neexistuje.' }, { status: 404 });

  const ja = new URL(req.url).searchParams.get('ja') || '';
  if (!ja) return NextResponse.json({ chyba: 'Chybí id účastníka.' }, { status: 400 });

  const od = new Date(Date.now() - ZPRAVA_PLATNOST_MS);

  /**
   * Vyzvednu zprávy adresované mně i ohlášení určená všem - ale NE svoje
   * vlastní, jinak bych si odpovídal sám sobě.
   */
  const radky = await prisma.pultZprava
    .findMany({
      where: {
        blockId: mistnost.id,
        createdAt: { gte: od },
        odKoho: { not: ja },
        OR: [{ komu: ja }, { komu: null }],
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { id: true, odKoho: true, komu: true, druh: true, telo: true, jmeno: true },
    })
    .catch(() => []);

  /**
   * ZPRÁVY URČENÉ MNĚ SE MAŽOU HNED PO PŘEČTENÍ, ohlášení „ahoj"/„odchod"
   * pro všechny se nechávají dožít - potřebuje je i ten, kdo přijde o chvíli
   * později. Uklidí je mazání starých záznamů níž.
   */
  const mojeIds = radky.filter((r) => r.komu === ja).map((r) => r.id);
  if (mojeIds.length > 0) {
    await prisma.pultZprava.deleteMany({ where: { id: { in: mojeIds } } }).catch(() => null);
  }

  /** Úklid staré pošty. Běží mimochodem při dotazu, žádný cron na to není. */
  prisma.pultZprava
    .deleteMany({ where: { blockId: mistnost.id, createdAt: { lt: od } } })
    .catch(() => null);

  const zpravy: ZpravaPultu[] = radky.map((r) => ({
    id: r.id,
    odKoho: r.odKoho,
    komu: r.komu,
    druh: r.druh as ZpravaPultu['druh'],
    telo: bezpecnyJson(r.telo),
    jmeno: r.jmeno,
  }));

  return NextResponse.json({ zpravy });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const mistnost = await najdiMistnost(params.token);
  if (!mistnost) return NextResponse.json({ chyba: 'Místnost neexistuje.' }, { status: 404 });

  const telo = (await req.json().catch(() => null)) as {
    odKoho?: string;
    komu?: string | null;
    druh?: string;
    telo?: unknown;
    jmeno?: string | null;
  } | null;

  if (!telo?.odKoho || !telo.druh) {
    return NextResponse.json({ chyba: 'Chybí odesílatel nebo druh zprávy.' }, { status: 400 });
  }

  await prisma.pultZprava
    .create({
      data: {
        blockId: mistnost.id,
        odKoho: telo.odKoho,
        komu: telo.komu || null,
        druh: telo.druh,
        telo: JSON.stringify(telo.telo ?? null),
        jmeno: (telo.jmeno || '').slice(0, 120) || null,
      },
    })
    .catch((err) => {
      console.error('Zprávu pultu se nepodařilo uložit:', err);
      return null;
    });

  return NextResponse.json({ ok: true });
}

/** Tělo se ukládá jako text; rozbité JSON nesmí shodit celý dotaz. */
function bezpecnyJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
