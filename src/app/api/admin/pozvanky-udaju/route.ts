import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { vytvorPozvanku } from '@/lib/pozvankaUdaju';

/**
 * ZALOŽENÍ ŽÁDOSTI O ÚDAJE (zadání 16. 9. 2026).
 *
 * Žádost se dá vyrobit dvěma způsoby: pro někoho, kdo v portálu už je (doplní
 * se mu karta), nebo pro někoho úplně nového — tomu stačí napsat jméno
 * a e-mail a záznam vznikne až z toho, co vyplní.
 */
export const dynamic = 'force-dynamic';

const schema = z
  .object({
    druh: z.enum(['HEREC', 'FIRMA']),
    userId: z.string().optional().nullable(),
    companyId: z.string().optional().nullable(),
    jmeno: z.string().trim().max(200).optional().nullable(),
    email: z.string().trim().email('Zadejte platný e-mail.').optional().nullable().or(z.literal('')),
    poznamka: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((d) => d.userId || d.companyId || d.jmeno, {
    message: 'Vyberte člověka nebo firmu, nebo napište jméno.',
  });

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
      { status: 400 },
    );
  }
  const d = parsed.data;

  try {
    const pozvanka = await vytvorPozvanku({
      druh: d.druh,
      userId: d.druh === 'HEREC' ? d.userId || null : null,
      companyId: d.druh === 'FIRMA' ? d.companyId || null : null,
      jmeno: d.jmeno || null,
      email: d.email || null,
      poznamka: d.poznamka || null,
      vytvorilId: session.user.id,
    });
    return NextResponse.json({ id: pozvanka.id, token: pozvanka.token }, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/pozvanky-udaju selhalo:', err);
    return NextResponse.json({ error: 'Žádost se nepodařilo založit.' }, { status: 500 });
  }
}
