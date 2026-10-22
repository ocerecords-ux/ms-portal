import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { projektPodleTokenu } from '@/lib/preposlechOdkaz';
import { notifyMany } from '@/lib/notifications';
import { zapisNotifikaci } from '@/lib/projektLogServer';

/**
 * KLIENT VYBRAL HERCE (zadání 22. 10. 2026: „když vybere, tak nám to zahlásí
 * zvonek (já, Karolína, Helča) a zůstane tam jen ten návrh v okně návrhu
 * a bude u něj nějak označeno, že klient vybral herce a my si ho pak ručně
 * přidáme").
 *
 * NIC SE NEOBSAZUJE SAMO. Výběr je vzkaz, ne zápis do obsazení - herce
 * přidáme ručně, až si ověříme, že má čas. Proto se tu nesahá na
 * `ProjectMeta.actorUserIds`.
 *
 * OSTATNÍ NÁVRHY SE SMAŽOU. V kartě má zůstat jen ten vybraný, ať je na první
 * pohled jasné, na čem jsme - zadání výš.
 *
 * Vstupenkou je token projektu, žádné přihlášení. Kdo má odkaz, je klient;
 * jméno se bere z projektu, ne z toho, co kdo napíše do formuláře.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ navrhId: z.string().trim().min(1).max(64) });

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const caflouProjectId = await projektPodleTokenu(params.token);
  if (!caflouProjectId) {
    return NextResponse.json({ error: 'Odkaz už neplatí.' }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  try {
    const navrh = await prisma.navrhHerce.findFirst({
      where: {
        id: parsed.data.navrhId,
        caflouProjectId,
        odeslanoKlientoviAt: { not: null },
      },
      select: { id: true, jmeno: true, user: { select: { name: true, email: true } } },
    });
    if (!navrh) return NextResponse.json({ error: 'Tenhle návrh tu není.' }, { status: 404 });

    const projekt = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: { name: true, klient: { select: { name: true, email: true } } },
    });

    const kdoVybral = projekt?.klient?.name || projekt?.klient?.email || 'klient';
    const jmenoHerce = navrh.user ? navrh.user.name || navrh.user.email : navrh.jmeno || '—';

    await prisma.$transaction([
      prisma.navrhHerce.update({
        where: { id: navrh.id },
        data: { vybranoAt: new Date(), vybralKdo: kdoVybral },
      }),
      // V karte zustane jen vybrany navrh - viz komentar nahore.
      prisma.navrhHerce.deleteMany({
        where: { caflouProjectId, id: { not: navrh.id } },
      }),
    ]);

    /**
     * ZVONEK NÁM (zadání 22. 10. 2026). Jde na admina a produkci - tedy na ty,
     * kdo návrhy vůbec vidí; kdo to má na starosti, se časem mění, takže se to
     * nebere podle jmen, ale podle role.
     */
    const nasi = await prisma.user
      .findMany({
        where: { active: true, role: { in: ['ADMIN', 'PRODUKCE'] as never } },
        select: { id: true },
      })
      .catch(() => [] as { id: string }[]);

    await notifyMany(
      nasi.map((u) => u.id),
      {
        kind: 'navrh-herce-vybran',
        title: 'Klient vybral herce',
        body: `${projekt?.name ?? 'Projekt'} · ${jmenoHerce} — vybral ${kdoVybral}`,
        url: `/projekty/${encodeURIComponent(caflouProjectId)}`,
      },
    ).catch(() => undefined);

    await zapisNotifikaci({
      caflouProjectId,
      stav: 'Návrhy herců',
      popis: `Klient vybral herce: ${jmenoHerce} (${kdoVybral}).`,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/navrhy/[token]/vybrat selhalo:', err);
    return NextResponse.json({ error: 'Výběr se nepodařilo uložit.' }, { status: 500 });
  }
}
