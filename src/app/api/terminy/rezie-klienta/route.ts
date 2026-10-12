import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { nactiReziseryKlientu } from '@/lib/rezieKlientaServer';

/**
 * „PŘIJDU REŽÍROVAT" V NATÁČECÍM PLÁNU (zadání 12. 10. 2026: „tu první
 * frekvenci bych ji tam dal vždy automaticky a pak aby si mohla v natáčecím
 * plánu v portálu zaškrtnout, na které chce ještě přijít").
 *
 * Zaškrtnutí se ukládá jako VÝJIMKA u té jedné frekvence (`rezieKlienta`
 * true / false) - první frekvenci portál pozná sám, tohle je odpověď na
 * „a na tuhle přijdu taky" nebo „tuhle první vynechám".
 *
 * KDO SMÍ: člověk, kterého má firma na kartě vedeného jako svého režiséra,
 * a kdokoliv z nás. Ostatní lidé z klientovy firmy plán jen čtou - jinak by
 * si termíny přehazovali navzájem.
 */

const Vstup = z.object({
  /** Id termínu tak, jak ho vydává natáčecí plán: „slot-…" nebo „blok-…". */
  id: z.string().trim().min(1).max(120),
  prijde: z.boolean(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const telo = Vstup.safeParse(await req.json().catch(() => null));
  if (!telo.success) {
    return NextResponse.json({ error: 'Chybné zadání.' }, { status: 400 });
  }
  const { id, prijde } = telo.data;

  const jeSlot = id.startsWith('slot-');
  const jeBlok = id.startsWith('blok-');
  if (!jeSlot && !jeBlok) {
    return NextResponse.json({ error: 'Neznámý termín.' }, { status: 400 });
  }
  const rawId = id.slice(5);

  /** Ke kterému projektu termín patří - podle něj se hledá firma a její režisér. */
  const projekt = jeSlot
    ? (
        await prisma.recordingSlot
          .findUnique({ where: { id: rawId }, select: { request: { select: { caflouProjectId: true } } } })
          .catch(() => null)
      )?.request?.caflouProjectId ?? null
    : (
        await prisma.studioBlock
          .findUnique({ where: { id: rawId }, select: { caflouProjectId: true } })
          .catch(() => null)
      )?.caflouProjectId ?? null;

  if (!projekt) {
    return NextResponse.json({ error: 'Termín nenalezen.' }, { status: 404 });
  }

  const reziser = (await nactiReziseryKlientu([projekt])).get(projekt);
  if (!reziser) {
    return NextResponse.json({ error: 'Tahle firma režii klienta nemá.' }, { status: 400 });
  }

  const smi = isInternalRole(session.user.role) || session.user.id === reziser.userId;
  if (!smi) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  try {
    if (jeSlot) {
      await prisma.recordingSlot.update({ where: { id: rawId }, data: { rezieKlienta: prijde } });
    } else {
      await prisma.studioBlock.update({ where: { id: rawId }, data: { rezieKlienta: prijde } });
    }
  } catch (err) {
    console.error('Uložení režie klienta selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nepovedlo.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, prijde });
}
