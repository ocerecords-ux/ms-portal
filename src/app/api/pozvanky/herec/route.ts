import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { kdoJe } from '@/lib/kdoJe';
import { pozviHerce } from '@/lib/pozvankaHerce';

/**
 * POZVÁNKA NOVÉHO HERCE (zadání 16. 9. 2026).
 *
 * SCHVÁLNĚ MIMO /api/admin: zve i Produkce (zadání téhož dne: „tohle tlačítko
 * musí mít zapnuté Zuzo-labuzo i Helča — produkce"), a všechno pod /api/admin
 * je vyhrazené Zuzo-labuzo.
 */
export const dynamic = 'force-dynamic';

/** Kdo smí zvát herce. */
const SMI_ZVAT = ['ADMIN', 'PRODUKCE'];

const schema = z.object({ email: z.string().trim().min(3).max(200) });

export async function POST(req: NextRequest) {
  const ja = await kdoJe(req);
  if (!ja) {
    return NextResponse.json(
      { error: 'Přihlášení vypršelo. Načtěte prosím stránku znovu.' },
      { status: 401 },
    );
  }
  if (!SMI_ZVAT.includes(ja.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění zvát herce.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Zadejte e-mail.' }, { status: 400 });
  }

  const vysledek = await pozviHerce(parsed.data.email);
  if (!vysledek.ok) {
    return NextResponse.json(
      { error: vysledek.chyba, userId: vysledek.userId, odkaz: vysledek.odkaz },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, userId: vysledek.userId, email: vysledek.email });
}
