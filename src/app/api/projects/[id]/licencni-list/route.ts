import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canEditProjectMeta } from '@/lib/roles';
import { vystavLicencniList } from '@/lib/licencniListServer';

/** Vystavení licenčního listu k reklamě (zadání 22. 9. 2026). */
const pole = (max = 300) => z.string().trim().max(max);
const schema = z.object({
  actorUserId: z.string().trim().max(60).nullable().optional(),
  nazevSpotu: pole().min(1, 'Vyplňte název spotu.'),
  klient: pole().min(1, 'Vyplňte klienta.'),
  objednatel: pole().min(1, 'Vyplňte objednatele.'),
  dodavatel: pole().min(1, 'Vyplňte dodavatele.'),
  interpret: pole().min(1, 'Vyberte nebo napište interpreta.'),
  typDila: pole().min(1, 'Vyplňte typ díla.'),
  uzemi: pole().min(1, 'Vyplňte území.'),
  media: pole().min(1, 'Vyplňte média.'),
  delkaLicence: pole().min(1, 'Vyplňte délku licence.'),
  typLicence: pole().min(1),
  datumVyroby: pole(20),
  podminky: pole(4000),
  misto: pole(100),
  podepisuje: pole(100).min(1),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění licenční list vystavit.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  try {
    const vysledek = await vystavLicencniList(
      params.id,
      { ...parsed.data, actorUserId: parsed.data.actorUserId || null },
      session.user.id,
    );
    if (!vysledek.ok) return NextResponse.json({ error: vysledek.chyba }, { status: 400 });
    return NextResponse.json({ id: vysledek.id });
  } catch (err) {
    console.error('POST /api/projects/[id]/licencni-list selhalo:', err);
    return NextResponse.json({ error: 'Licenční list se nepodařilo vystavit.' }, { status: 500 });
  }
}
