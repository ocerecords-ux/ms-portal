import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';
import { sendNavrhyHercuEmail } from '@/lib/email';
import { zajistiOdkaz, zakladPortalu } from '@/lib/preposlechOdkaz';
import { zapisNotifikaci } from '@/lib/projektLogServer';
import { jazykUzivatele } from '@/lib/jazykPrijemce';

/**
 * ODESLÁNÍ NÁVRHŮ HERCŮ KLIENTOVI (zadání 22. 10. 2026: „uděláme tlačítko
 * odeslat návrhy na klienta a může kliknout na vybrat").
 *
 * Klient dostane mail jen se JMÉNY a odkazem na stránku /navrhy/<token>;
 * naše poznámky u návrhů jsou interní a do mailu nejdou.
 *
 * ODKAZ JE TÝŽ TOKEN PROJEKTU jako u nahrávek a připomínkování - „Vygenerovat
 * nový" u projektu tím zavře i tenhle, což je správně: je to jeden klíč ke
 * všemu, co o zakázce klientovi posíláme.
 */
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  try {
    const projekt = await prisma.projectMeta.findUnique({
      where: { caflouProjectId: params.id },
      select: {
        name: true,
        klient: { select: { id: true, name: true, email: true } },
      },
    });
    if (!projekt) return NextResponse.json({ error: 'Projekt nenalezen.' }, { status: 404 });
    if (!projekt.klient?.email) {
      return NextResponse.json(
        { error: 'U projektu není klient s e-mailem — doplňte ho v Přehledu.' },
        { status: 400 },
      );
    }

    const navrhy = await prisma.navrhHerce.findMany({
      where: { caflouProjectId: params.id, vybranoAt: null },
      orderBy: [{ poradi: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, jmeno: true, user: { select: { name: true, email: true } } },
    });
    if (navrhy.length === 0) {
      return NextResponse.json({ error: 'Nejsou tu žádné návrhy k odeslání.' }, { status: 400 });
    }

    const token = await zajistiOdkaz(params.id, null);
    if (!token) {
      return NextResponse.json({ error: 'Nepodařilo se vyrobit odkaz pro klienta.' }, { status: 500 });
    }

    const jmena = navrhy.map((n) => (n.user ? n.user.name || n.user.email : n.jmeno || '—'));
    const vysledek = await sendNavrhyHercuEmail({
      prijemci: [projekt.klient.email],
      jmenoKlienta: projekt.klient.name ?? null,
      nazevProjektu: projekt.name ?? 'Projekt',
      jmena,
      odkaz: `${zakladPortalu()}/navrhy/${encodeURIComponent(token)}`,
      jazyk: await jazykUzivatele(projekt.klient.id).catch(() => 'cs' as const),
    });

    if (!vysledek.sent) {
      return NextResponse.json({ error: 'E-mail se nepodařilo odeslat.' }, { status: 503 });
    }

    await prisma.navrhHerce.updateMany({
      where: { id: { in: navrhy.map((n) => n.id) } },
      data: { odeslanoKlientoviAt: new Date() },
    });

    // Do historie projektu, ať je po měsíci vidět, kdy a komu to šlo.
    await zapisNotifikaci({
      caflouProjectId: params.id,
      stav: 'Návrhy herců',
      popis: `Návrhy herců (${jmena.length}) — odesláno na ${projekt.klient.email}.`,
      prijemci: [projekt.klient.email],
      zpravaPredmet: 'predmet' in vysledek ? vysledek.predmet : null,
      zpravaHtml: 'telo' in vysledek ? vysledek.telo : null,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, pocet: jmena.length, komu: projekt.klient.email });
  } catch (err) {
    console.error('POST navrhy-hercu/odeslat selhalo:', err);
    return NextResponse.json({ error: 'Odeslání se nepodařilo.' }, { status: 500 });
  }
}
