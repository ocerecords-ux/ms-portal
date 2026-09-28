import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import {
  nactiProgramSPoznamkami,
  presunTema,
  pridejTema,
  smazTema,
  upravTema,
  zacniNovouPoradu,
} from '@/lib/poradaServer';

/**
 * Program technické porady (zadání 28. 9. 2026).
 *
 * Stejná práva jako přehled Knihy a rozpočty - jsou to poznámky vedoucího
 * k práci celého týmu. Poznámky odsud chodí jen do režie, na plátno nikdy
 * (viz lib/poradaServer.ts).
 */
export const dynamic = 'force-dynamic';

const novy = z.object({ nadpis: z.string().trim().min(1).max(200) });

const uprava = z.object({
  id: z.string().trim().min(1),
  nadpis: z.string().trim().min(1).max(200).optional(),
  poznamka: z.string().trim().max(10_000).optional(),
  hotovo: z.boolean().optional(),
  presun: z.enum(['nahoru', 'dolu']).optional(),
});

async function jeAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'ADMIN';
}

export async function GET() {
  if (!(await jeAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  return NextResponse.json({ temata: await nactiProgramSPoznamkami() });
}

export async function POST(req: NextRequest) {
  if (!(await jeAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const telo = await req.json().catch(() => ({}));

  // Nová porada - jen odškrtne hotová témata, seznam nechá být.
  if (telo?.akce === 'novaPorada') {
    await zacniNovouPoradu();
    return NextResponse.json({ ok: true, temata: await nactiProgramSPoznamkami() });
  }

  const parsed = novy.safeParse(telo);
  if (!parsed.success) return NextResponse.json({ error: 'Napište název tématu.' }, { status: 400 });
  try {
    await pridejTema(parsed.data.nadpis);
    return NextResponse.json({ ok: true, temata: await nactiProgramSPoznamkami() });
  } catch (err) {
    console.error('POST /api/porada/temata selhalo:', err);
    return NextResponse.json({ error: 'Téma se nepodařilo přidat.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await jeAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const parsed = uprava.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const { id, presun, ...zmena } = parsed.data;
  try {
    if (presun) await presunTema(id, presun);
    else await upravTema(id, zmena);
    return NextResponse.json({ ok: true, temata: await nactiProgramSPoznamkami() });
  } catch (err) {
    console.error('PATCH /api/porada/temata selhalo:', err);
    return NextResponse.json({ error: 'Změnu se nepodařilo uložit.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await jeAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const id = req.nextUrl.searchParams.get('id')?.trim();
  if (!id) return NextResponse.json({ error: 'Chybí téma.' }, { status: 400 });
  try {
    await smazTema(id);
    return NextResponse.json({ ok: true, temata: await nactiProgramSPoznamkami() });
  } catch (err) {
    console.error('DELETE /api/porada/temata selhalo:', err);
    return NextResponse.json({ error: 'Téma se nepodařilo smazat.' }, { status: 500 });
  }
}
