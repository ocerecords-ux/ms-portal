import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import {
  smazPribeh,
  smiSchvalovatPribehy,
  vyridPribeh,
  vyvesPribehNaInstagram,
} from '@/lib/pribehyServer';

/**
 * VYŘÍZENÍ PŘÍBĚHU (zadání 6. 10. 2026).
 *
 * PATCH vyvěsí nebo zamítne - smí jen ten, kdo má zaškrtnuté Schvaluje
 * a vyvěšuje příběhy. DELETE je stažení z fronty: autor může, dokud se nikdo
 * nerozhodl; schvalovatel kdykoli.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/**
 * Vyvěšení videa není hned hotové - Meta ho nejdřív zpracuje a portál na to
 * čeká (viz pockejNaZpracovani). Výchozích deset sekund na to nestačí.
 */
export const maxDuration = 60;

const schema = z.object({
  stav: z.enum(['VYVESENO', 'ZAMITNUTO']),
  vzkaz: z.string().max(2000).optional(),
  /**
   * `pres: 'API'` znamená „vyvěs to ty" - portál příběh pošle na Instagram
   * sám. Bez toho je to jen poznámka, že to někdo vyvěsil rukou.
   */
  pres: z.enum(['API']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const kdo = { id: session.user.id, role: session.user.role };
  if (!(await smiSchvalovatPribehy(kdo))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatná volba.' }, { status: 400 });
  }

  if (parsed.data.pres === 'API' && parsed.data.stav === 'VYVESENO') {
    const vysledek = await vyvesPribehNaInstagram(kdo, params.id);
    if (!vysledek.ok) return NextResponse.json({ error: vysledek.chyba }, { status: 502 });
    return NextResponse.json({ pribeh: vysledek.pribeh });
  }

  const pribeh = await vyridPribeh(kdo, params.id, parsed.data.stav, parsed.data.vzkaz ?? null);
  if (!pribeh) {
    return NextResponse.json({ error: 'Tenhle příběh už někdo vyřídil.' }, { status: 409 });
  }
  return NextResponse.json({ pribeh });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const ok = await smazPribeh({ id: session.user.id, role: session.user.role }, params.id);
  if (!ok) return NextResponse.json({ error: 'Příběh už stáhnout nejde.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
