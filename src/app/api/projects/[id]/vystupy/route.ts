import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canEditProjectMeta } from '@/lib/roles';
import { nazevDowncutu } from '@/lib/vystupy';
import { nactiVystupy, zalozVystup } from '@/lib/vystupyServer';

/**
 * VÝSTUPY PROJEKTU (zadání 26. 9. 2026) - seznam a zakládání.
 *
 * Kdo smí zakládat: stejný kruh jako u ostatních interních atributů projektu
 * (`canEditProjectMeta`) - produkce a Žůžo-labůžo. Zvukař ani klient sem
 * nezapisuje; návrhy z objednávky zakládá server sám, ne tahle cesta.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().max(200).optional(),
  typKlic: z.string().trim().max(200).nullable().optional(),
  delkaSekund: z.number().int().positive().max(36000).nullable().optional(),
  /** Vyplněné = zakládá se downcut pod tímhle výstupem. */
  odvozenoZId: z.string().trim().min(1).nullable().optional(),
  sluzby: z.array(z.string().trim().min(1)).max(10).optional(),
  herciIds: z.array(z.string().trim().min(1)).max(20).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  // ZÁMĚRNĚ JEN ČTENÍ. Převod staršího projektu na výstupy dělá stránka
  // projektu, která zná jeho skutečný název - kdyby ho zakládala tahle cesta,
  // jmenoval by se výstup podle toho, co kdo pošle v adrese.
  const { id } = await params;
  return NextResponse.json({ vystupy: await nactiVystupy(id) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id } = await params;
  const telo = await req.json().catch(() => null);
  const data = schema.safeParse(telo);
  if (!data.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  // Downcut se zakládá jen délkou - název se z ní složí sám („Downcut 30s")
  // a zbytek podědí po hlavním výstupu (viz sDedenim v lib/vystupy.ts).
  const nazev =
    data.data.nazev?.trim() ||
    (data.data.odvozenoZId && data.data.delkaSekund ? nazevDowncutu(data.data.delkaSekund) : 'Výstup');

  const vystup = await zalozVystup(id, { ...data.data, nazev });
  if (!vystup) return NextResponse.json({ error: 'Výstup se nepodařilo založit.' }, { status: 500 });

  return NextResponse.json({ vystup });
}
