import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';
import { sendHerecDotocenEmail } from '@/lib/email';
import { zakladPortalu } from '@/lib/preposlechOdkaz';
import { zapisNotifikaci } from '@/lib/projektLogServer';

/**
 * Dotočený herec na projektu (zadání 11. 9. 2026: „u herců v projektech
 * v detailu vložit vedle jeho jména tlačítko Dotočeno… fajfku prosím
 * v přehledu i v detailu" + „info o dotočeno s hercem jde notifikací mailem
 * na Helenu Rychlík").
 *
 * Je to vlastnost DVOJICE projekt + herec: na audioknize bývá herců víc a
 * každý končí jindy. Stav projektu se tím sám nepřehazuje — podle dotočení
 * herců se produkce teprve rozhoduje, kdy projekt překlopit do
 * „Dotočeno/stříháme".
 *
 * ZPRÁVA ODCHÁZÍ JEN PŘI ZAŠKRTNUTÍ, ne při odškrtnutí: odškrtnutí je v praxi
 * oprava překlepu a mail o tom by byl jen šum. Neodeslaná zpráva nesmí shodit
 * samotné odškrtnutí — to je ta důležitější věc.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().trim().min(1),
  dotoceno: z.boolean(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const { userId, dotoceno } = parsed.data;

  const [projekt, herec] = await Promise.all([
    prisma.projectMeta.findUnique({
      where: { caflouProjectId: params.id },
      select: { name: true, companyName: true, company: { select: { name: true } } },
    }),
    prisma.user.findFirst({ where: { id: userId, role: 'HEREC' }, select: { id: true, name: true, email: true } }),
  ]);
  if (!projekt) return NextResponse.json({ error: 'Projekt nenalezen.' }, { status: 404 });
  if (!herec) return NextResponse.json({ error: 'Herec nenalezen.' }, { status: 404 });

  const kdo = session.user.name || session.user.email || null;

  if (!dotoceno) {
    await prisma.herecDotocen.deleteMany({ where: { caflouProjectId: params.id, userId } });
    return NextResponse.json({ dotoceno: false });
  }

  const zaznam = await prisma.herecDotocen.upsert({
    where: { caflouProjectId_userId: { caflouProjectId: params.id, userId } },
    create: {
      caflouProjectId: params.id,
      userId,
      potvrdilUserId: session.user.id,
      potvrdilJmeno: kdo,
    },
    update: { dotocenoAt: new Date(), potvrdilUserId: session.user.id, potvrdilJmeno: kdo },
  });

  const jmenoHerce = herec.name || herec.email;
  const nazevProjektu = projekt.name || `Projekt ${params.id}`;

  // Zprava je best effort - odskrtnuti uz je v databazi a nesmi na ni cekat.
  void (async () => {
    try {
      const prijemci = (
        await prisma.user.findMany({
          where: { active: true, dostavaDotoceno: true },
          select: { email: true },
        })
      ).map((u) => u.email);

      if (prijemci.length === 0) {
        console.warn(
          `Dotoceno (${jmenoHerce}, ${nazevProjektu}): zpravu nema komu poslat - nikdo nema zaskrtnute "Dostava zpravy o dotoceni".`,
        );
        return;
      }

      const vysledek = await sendHerecDotocenEmail({
        prijemci,
        jmenoHerce,
        nazevProjektu,
        nazevFirmy: projekt.company?.name ?? projekt.companyName ?? null,
        potvrdil: kdo,
        odkazNaProjekt: `${zakladPortalu()}/projekty/${encodeURIComponent(params.id)}`,
      });

      await zapisNotifikaci({
        caflouProjectId: params.id,
        stav: 'Dotočeno',
        popis: vysledek.sent
          ? `${jmenoHerce} má dotočeno — zpráva odešla.`
          : `${jmenoHerce} má dotočeno — zprávu se nepodařilo odeslat (${vysledek.reason ?? 'neznámý důvod'}).`,
        prijemci,
      });
    } catch (err) {
      console.error('Zprava o dotocenem herci selhala:', err);
    }
  })();

  return NextResponse.json({ dotoceno: true, dotocenoAt: zaznam.dotocenoAt.toISOString() });
}
