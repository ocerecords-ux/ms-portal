import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { kodZeme } from '@/lib/countries';
import { notifyMany } from '@/lib/notifications';
import { prijemciUdaju } from '@/lib/pozvankaUdaju';

/**
 * ULOŽENÍ ÚDAJŮ, KTERÉ HEREC DOPLNIL SÁM (zadání 16. 9. 2026).
 *
 * MĚNÍ JEN VLASTNÍ ÚČET přihlášeného člověka — id se bere ze session, nikdy
 * z těla požadavku. Jinak by si tímhle formulářem šlo přepsat číslo účtu
 * komukoliv jinému.
 *
 * Zapisuje se rovnou. Je to první vyplnění prázdné karty, takže není co
 * přepsat; hlídání přepisů řeší žádosti o údaje odkazem (lib/pozvankaUdaju).
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(1, 'Vyplňte prosím jméno.').max(200),
  addressStreet: z.string().trim().max(200).optional().default(''),
  addressCity: z.string().trim().max(120).optional().default(''),
  addressZip: z.string().trim().max(20).optional().default(''),
  addressCountry: z.string().trim().max(120).optional().default(''),
  bankAccount: z.string().trim().max(60).optional().default(''),
  birthNumber: z.string().trim().max(40).optional().default(''),
  ic: z.string().trim().max(20).optional().default(''),
  dic: z.string().trim().max(30).optional().default(''),
  studioLocations: z.array(z.string().max(120)).max(20).optional().default([]),
  vatPayer: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
      { status: 400 },
    );
  }
  const d = parsed.data;

  try {
    const ucet = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: d.name,
        addressStreet: d.addressStreet || null,
        addressCity: d.addressCity || null,
        addressZip: d.addressZip || null,
        addressCountry: kodZeme(d.addressCountry) || null,
        bankAccount: d.bankAccount || null,
        birthNumber: d.birthNumber || null,
        ic: d.ic || null,
        dic: d.dic || null,
        studioLocations: d.studioLocations,
        vatPayer: d.vatPayer,
        udajeDoplneny: true,
      },
      select: { id: true, name: true, email: true },
    });

    void oznam(ucet).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/doplnit-udaje selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nepodařilo.' }, { status: 500 });
  }
}

/**
 * Zpráva těm, kdo to u sebe mají zapnuté (zadání 16. 9. 2026: „zahlásí
 * Karolíně — tohle bych chtěl mít ale taky možnost měnit do budoucna, komu to
 * bude hlásit"). Když to nemá zapnuté nikdo, jen se nic nepošle.
 */
async function oznam(ucet: { id: string; name: string | null; email: string }) {
  const prijemci = await prijemciUdaju();
  if (prijemci.length === 0) return;
  const kdo = ucet.name || ucet.email;

  await notifyMany(prijemci.map((p) => p.id), {
    kind: 'udaje-vyplneny',
    title: `${kdo} doplnil údaje`,
    body: 'Nový herec vyplnil své údaje po přijetí pozvánky.',
    url: `/admin/users/${ucet.id}`,
  });

  const { sendVyplneneUdajeEmail } = await import('@/lib/email');
  const zaklad = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
  for (const prijemce of prijemci) {
    if (!prijemce.email) continue;
    await sendVyplneneUdajeEmail({
      to: prijemce.email,
      jmenoPrijemce: prijemce.name,
      kdo,
      hotovo: true,
      kolikCeka: 0,
      odkaz: `${zaklad}/admin/users/${ucet.id}`,
    });
  }
}
