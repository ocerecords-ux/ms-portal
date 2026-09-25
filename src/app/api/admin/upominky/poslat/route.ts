import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { userLabel } from '@/lib/chatServer';
import { fakturyPoSplatnosti, posliUpominku } from '@/lib/upominkyServer';

/**
 * RUČNÍ ODESLÁNÍ UPOMÍNKY (25. 9. 2026). Nečeká se na denní úlohu ani na to,
 * kolikátý je den po splatnosti - kdo klikne, ten posílá. Dvakrát tutéž
 * upomínku to ale nepošle: pořadí se bere z toho, co už odešlo.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ invoiceId: z.string().trim().min(1) });

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const faktury = await fakturyPoSplatnosti();
  const faktura = faktury.find((f) => f.id === parsed.data.invoiceId);
  if (!faktura) {
    return NextResponse.json({ error: 'Faktura není po splatnosti (nebo už je zaplacená).' }, { status: 404 });
  }

  const vysledek = await posliUpominku(faktura, {
    vynutit: true,
    kdo: userLabel({ name: session.user?.name ?? null, email: session.user?.email ?? '' }),
  });

  if (vysledek.stav === 'odeslano') {
    return NextResponse.json({ ok: true, komu: vysledek.komu, poradi: vysledek.poradi });
  }
  if (vysledek.stav === 'chybi-prijemce') {
    return NextResponse.json({ error: 'Faktura nemá komu poslat — firma nemá kontaktní e-mail a projekt klienta.' }, { status: 400 });
  }
  return NextResponse.json(
    { error: vysledek.stav === 'chyba' ? vysledek.zprava : 'Upomínku se nepodařilo poslat.' },
    { status: 500 },
  );
}
