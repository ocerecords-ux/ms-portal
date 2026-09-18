import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { pristupKVideu } from '@/lib/reklamaPripominky';

/**
 * ODESLÁNÍ PŘIPOMÍNEK (upřesnění 18. 9. 2026: „na pravé straně se budou
 * zapisovat ty chyby, bez jména, a pak tam bude jen tlačítko odeslat
 * připomínky").
 *
 * Zapsané jsou hned - o to, aby se nic neztratilo, se klient starat nemá.
 * Tohle je ten okamžik, kdy řekne „hotovo, kouknětě se na to": připomínky se
 * orazítkují jako odeslané a nám cinkne zvonek. Jednou za dávku, ne u každé
 * věty.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  k: z.string().trim().min(10),
  soubor: z.string().trim().min(5),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const pristup = await pristupKVideu(parsed.data.k, parsed.data.soubor);
  if ('chyba' in pristup) {
    return NextResponse.json({ error: pristup.chyba }, { status: pristup.status });
  }

  try {
    const ted = new Date();
    const davka = await prisma.reklamaPripominka.updateMany({
      where: {
        caflouProjectId: pristup.caflouProjectId,
        driveFileId: pristup.fileId,
        odeslanoAt: null,
      },
      data: { odeslanoAt: ted },
    });

    if (davka.count === 0) {
      return NextResponse.json({ ok: true, odeslano: 0, odeslanoAt: null });
    }

    const [meta, dotazy] = await Promise.all([
      prisma.projectMeta.findUnique({
        where: { caflouProjectId: pristup.caflouProjectId },
        select: { name: true, managerUserId: true },
      }),
      prisma.user.findMany({
        where: { active: true, prijimaDotazyKlientu: true },
        select: { id: true },
      }),
    ]);

    /**
     * Zvonek dostane manažer projektu a ti, kdo mají na kartě „Dostává dotazy
     * klientů" - je to tentýž druh práce. Čeká se na to schválně: na Vercelu
     * po odeslané odpovědi funkce končí a upozornění by nemuselo vzniknout.
     */
    await notifyMany([meta?.managerUserId ?? null, ...dotazy.map((u) => u.id)], {
      kind: 'reklama-pripominka',
      title: `Připomínky k nahrávce: ${meta?.name?.trim() || pristup.nazev}`,
      body: `Klient odeslal ${davka.count} ${davka.count === 1 ? 'připomínku' : davka.count < 5 ? 'připomínky' : 'připomínek'}.`,
      url: `/pripominkovat/${encodeURIComponent(parsed.data.k)}?soubor=${encodeURIComponent(
        pristup.fileId,
      )}`,
    });

    return NextResponse.json({ ok: true, odeslano: davka.count, odeslanoAt: ted.toISOString() });
  } catch (err) {
    console.error('Odeslani pripominek k videu selhalo:', err);
    return NextResponse.json({ error: 'Odeslání se nezdařilo.' }, { status: 500 });
  }
}
