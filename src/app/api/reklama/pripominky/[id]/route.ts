import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { projektPodleTokenu } from '@/lib/preposlechOdkaz';

/**
 * Úprava jedné připomínky k videu (zadání 18. 9. 2026).
 *
 * KDO SMÍ CO:
 * - my (přihlášený tým Mediaspace) můžeme připomínku odškrtnout jako
 *   vyřízenou a smazat ji kdykoliv;
 * - klient z odkazu smí smazat JEN ČERSTVOU připomínku - do čtvrt hodiny od
 *   zápisu. Je to pojistka na překlep, ne editace cizí zpětné vazby: odkaz
 *   si klient přeposílá dál a kdo ho má, není nutně ten, kdo připomínku psal.
 */
export const dynamic = 'force-dynamic';

const LHUTA_NA_OPRAVU_MS = 15 * 60 * 1000;

const patchSchema = z.object({ vyrizeno: z.boolean() });

async function jsemZTymu(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return Boolean(session?.user?.id && isInternalRole(session.user.role));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await jsemZTymu())) {
    return NextResponse.json({ error: 'Tohle může jen tým Mediaspace.' }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  try {
    await prisma.reklamaPripominka.update({
      where: { id: params.id },
      data: { vyrizeno: parsed.data.vyrizeno },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Zmena pripominky k videu selhala:', err);
    return NextResponse.json({ error: 'Nepodařilo se to uložit.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const zaznam = await prisma.reklamaPripominka.findUnique({
      where: { id: params.id },
      select: { caflouProjectId: true, createdAt: true },
    });
    if (!zaznam) return NextResponse.json({ error: 'Připomínka se nenašla.' }, { status: 404 });

    if (!(await jsemZTymu())) {
      const token = req.nextUrl.searchParams.get('k') ?? '';
      const projekt = token ? await projektPodleTokenu(token) : null;
      if (!projekt || projekt !== zaznam.caflouProjectId) {
        return NextResponse.json({ error: 'Odkaz sem nepustí.' }, { status: 403 });
      }
      if (Date.now() - zaznam.createdAt.getTime() > LHUTA_NA_OPRAVU_MS) {
        return NextResponse.json(
          { error: 'Starší připomínku už smazat nejde — napište nám a zařídíme to.' },
          { status: 403 },
        );
      }
    }

    await prisma.reklamaPripominka.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Mazani pripominky k videu selhalo:', err);
    return NextResponse.json({ error: 'Smazání se nezdařilo.' }, { status: 500 });
  }
}
