import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/db';
import { zapisDoPortalu } from '@/lib/pozvankaUdaju';
import { sendPozvankaUdajuEmail } from '@/lib/email';

/**
 * CO SE DÁ SE ŽÁDOSTÍ O ÚDAJE DĚLAT (zadání 16. 9. 2026).
 *
 * `poslat`   - odeslat (nebo znovu poslat) odkaz e-mailem,
 * `zapsat`   - propsat odklikaná pole do portálu,
 * DELETE     - zrušit; odkaz tím přestane platit.
 *
 * Zrušení žádost NEMAŽE. Co člověk vyplnil, je doklad o tom, co sám uvedl -
 * mazat se to nesmí jen proto, že se odkaz už nepoužije.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  akce: z.enum(['poslat', 'zapsat']),
  /** U `zapsat`: která pole se mají zapsat. */
  klice: z.array(z.string()).optional(),
  /** U `poslat`: kam, když se adresa doplňuje až teď. */
  email: z.string().trim().email('Zadejte platný e-mail.').optional(),
});

function datCesky(datum: Date): string {
  return `${datum.getDate()}. ${datum.getMonth() + 1}. ${datum.getFullYear()}`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
      { status: 400 },
    );
  }

  const pozvanka = await prisma.pozvankaUdaju.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { name: true, email: true } },
      company: { select: { name: true, contactEmail: true } },
    },
  });
  if (!pozvanka) return NextResponse.json({ error: 'Žádost nenalezena.' }, { status: 404 });

  if (parsed.data.akce === 'zapsat') {
    const ok = await zapisDoPortalu(params.id, parsed.data.klice ?? []);
    if (!ok) return NextResponse.json({ error: 'Zápis se nepodařil.' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // --- poslat odkaz ---
  const komu =
    parsed.data.email ||
    pozvanka.email ||
    pozvanka.user?.email ||
    pozvanka.company?.contactEmail ||
    null;
  if (!komu) {
    return NextResponse.json(
      { error: 'Nevíme, kam to poslat — doplňte e-mail, nebo odkaz zkopírujte.' },
      { status: 400 },
    );
  }
  if (pozvanka.stav === 'ZRUSENA' || pozvanka.platiDo.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Tahle žádost už neplatí.' }, { status: 400 });
  }

  const zaklad = process.env.NEXTAUTH_URL || 'https://www.msportal.cz';
  try {
    const vysledek = await sendPozvankaUdajuEmail({
      to: komu,
      jmeno: pozvanka.user?.name || pozvanka.company?.name || pozvanka.jmeno,
      druh: pozvanka.druh as 'HEREC' | 'FIRMA',
      odkaz: `${zaklad}/udaje/${pozvanka.token}`,
      platiDo: datCesky(pozvanka.platiDo),
      poznamka: pozvanka.poznamka,
    });
    if (!vysledek.sent) {
      return NextResponse.json(
        { error: 'Odeslání selhalo — e-mail portálu není nastavený. Zkopírujte prosím odkaz.' },
        { status: 500 },
      );
    }
    await prisma.pozvankaUdaju.update({
      where: { id: params.id },
      data: { odeslanoAt: new Date(), email: komu },
    });
    return NextResponse.json({ ok: true, komu });
  } catch (err) {
    console.error('Odeslani pozvanky o udaje selhalo:', err);
    return NextResponse.json({ error: 'Odeslání se nepodařilo.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  try {
    await prisma.pozvankaUdaju.update({
      where: { id: params.id },
      data: { stav: 'ZRUSENA' },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Zruseni pozvanky selhalo:', err);
    return NextResponse.json({ error: 'Zrušení se nepodařilo.' }, { status: 500 });
  }
}
