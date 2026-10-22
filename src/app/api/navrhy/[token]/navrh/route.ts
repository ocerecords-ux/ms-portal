import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { projektPodleTokenu } from '@/lib/preposlechOdkaz';
import { notifyMany } from '@/lib/notifications';
import { zapisNotifikaci } from '@/lib/projektLogServer';

/**
 * VLASTNÍ NÁVRH KLIENTA (zadání 22. 10. 2026: „klient by tam měl mít možnost
 * vlastních návrhů").
 *
 * Klient napíše jméno rukou - účet v portálu mít nemusí a často jde o někoho,
 * koho slyšel jinde. Návrh se uloží do téhož seznamu jako naše, jen s
 * příznakem `odKlienta`, takže je v kartě na první pohled poznat, čí je.
 *
 * Zvoní to u nás stejně jako výběr: tohle je věc, na kterou se čeká.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  jmeno: z.string().trim().min(2, 'Napište jméno.').max(160),
  poznamka: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const caflouProjectId = await projektPodleTokenu(params.token);
  if (!caflouProjectId) {
    return NextResponse.json({ error: 'Odkaz už neplatí.' }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
      { status: 400 },
    );
  }

  try {
    // Kdyz uz si klient vybral, je po vyberu - dalsi jmena uz nemaji kam.
    const uzVybrano = await prisma.navrhHerce.findFirst({
      where: { caflouProjectId, vybranoAt: { not: null } },
      select: { id: true },
    });
    if (uzVybrano) {
      return NextResponse.json({ error: 'Výběr je už hotový.' }, { status: 409 });
    }

    const projekt = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: { name: true, klient: { select: { name: true, email: true } } },
    });
    const kdo = projekt?.klient?.name || projekt?.klient?.email || 'klient';

    const posledni = await prisma.navrhHerce.findFirst({
      where: { caflouProjectId },
      orderBy: { poradi: 'desc' },
      select: { poradi: true },
    });

    await prisma.navrhHerce.create({
      data: {
        caflouProjectId,
        poradi: (posledni?.poradi ?? 0) + 1,
        jmeno: parsed.data.jmeno,
        poznamka: parsed.data.poznamka?.trim() || null,
        autorJmeno: kdo,
        odKlienta: true,
        // At ho klient na sve strance vidi hned vedle nasich.
        odeslanoKlientoviAt: new Date(),
      },
    });

    const nasi = await prisma.user
      .findMany({
        where: { active: true, role: { in: ['ADMIN', 'PRODUKCE'] as never } },
        select: { id: true },
      })
      .catch(() => [] as { id: string }[]);

    await notifyMany(
      nasi.map((u) => u.id),
      {
        kind: 'navrh-herce-klient',
        title: 'Klient navrhl herce',
        body: `${projekt?.name ?? 'Projekt'} · ${parsed.data.jmeno} — od ${kdo}`,
        url: `/projekty/${encodeURIComponent(caflouProjectId)}`,
      },
    ).catch(() => undefined);

    await zapisNotifikaci({
      caflouProjectId,
      stav: 'Návrhy herců',
      popis: `Klient navrhl herce: ${parsed.data.jmeno} (${kdo}).`,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/navrhy/[token]/navrh selhalo:', err);
    return NextResponse.json({ error: 'Návrh se nepodařilo uložit.' }, { status: 500 });
  }
}
