import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canEditProjectMeta } from '@/lib/roles';
import { nahledLicencnihoListu } from '@/lib/licencniListServer';

/**
 * NÁHLED LICENČNÍHO LISTU (zadání 27. 9. 2026: „a takhle s tím náhledem").
 *
 * Vrací rovnou PDF z rozepsaných hodnot formuláře - stejné, jaké pak vznikne
 * při vystavení. NIC SE NEUKLÁDÁ: žádný záznam v portálu, nic na Disk,
 * klientovi se neozýváme. Podívat se dá kolikrát kdo chce.
 */
export const dynamic = 'force-dynamic';

const pole = (max = 300) => z.string().trim().max(max).optional();
const schema = z.object({
  nazevSpotu: pole(),
  klient: pole(),
  objednatel: pole(),
  dodavatel: pole(),
  interpret: pole(),
  typDila: pole(),
  uzemi: pole(),
  media: pole(),
  delkaLicence: pole(),
  typLicence: pole(),
  datumVyroby: pole(20),
  podminky: pole(4000),
  misto: pole(100),
  podepisuje: pole(100),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  }

  try {
    // Prázdné políčko v náhledu nevadí - list se ukáže tak, jak je rozepsaný.
    const d = parsed.data;
    const pdf = nahledLicencnihoListu({
      nazevSpotu: d.nazevSpotu || '',
      klient: d.klient || '',
      objednatel: d.objednatel || '',
      dodavatel: d.dodavatel || '',
      interpret: d.interpret || '',
      typDila: d.typDila || '',
      uzemi: d.uzemi || '',
      media: d.media || '',
      delkaLicence: d.delkaLicence || '',
      typLicence: d.typLicence || 'výhradní',
      datumVyroby: d.datumVyroby || '',
      podminky: d.podminky || '',
      misto: d.misto || '',
      podepisuje: d.podepisuje || '',
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="licencni-list-nahled.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error(`Náhled licenčního listu k projektu ${params.id} selhal:`, err);
    return NextResponse.json({ error: 'Náhled se nepodařilo vyrobit.' }, { status: 500 });
  }
}
