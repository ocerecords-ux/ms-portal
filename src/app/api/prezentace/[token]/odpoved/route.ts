import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { SEKCE } from '@/lib/prezentaceNabidky';

/**
 * ODPOVĚĎ KLIENTA Z PREZENTACE (zadání 11. 10. 2026 - klient smí nabídku
 * schválit a rovnou vybrat herce).
 *
 * ZÁMĚRNĚ BEZ PŘIHLÁŠENÍ. Klient přijde jedním odkazem; token je jediná věc,
 * která sem pouští - prezentace se hledá výhradně podle něj a žádné ID
 * z požadavku se nikam nepropisuje.
 *
 * SCHVÁLENÍ SE PROPÍŠE I DO DOKLADU. Kdyby zůstalo jen tady, musela by
 * produkce stav hlídat na dvou místech a dřív nebo později by se rozešly.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  akce: z.enum(['schvalit', 'odmitnout', 'herec']),
  jmeno: z.string().trim().max(120).optional(),
  herecId: z.string().trim().max(64).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });

    const prez = await prisma.prezentaceNabidky.findUnique({
      where: { token: params.token },
      select: {
        id: true,
        zverejneno: true,
        lzeSchvalit: true,
        nadpis: true,
        projectName: true,
        klientNazev: true,
        caflouProjectId: true,
        offerId: true,
        vytvorilId: true,
        schvalenoAt: true,
        ukazky: { where: { sekce: SEKCE.herec }, select: { ukazkaId: true } },
      },
    });
    if (!prez || !prez.zverejneno) {
      return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
    }
    if (!prez.lzeSchvalit) {
      return NextResponse.json({ error: 'Tahle nabídka se odsud neschvaluje.' }, { status: 403 });
    }

    const ted = new Date();

    if (parsed.data.akce === 'herec') {
      /**
       * Vybrat se dá jen herec, který v TÉHLE prezentaci opravdu je - jinak
       * by se dalo odkazem podstrčit cokoli z knihovny.
       */
      const nabizeni = new Set(prez.ukazky.map((u) => u.ukazkaId));
      const vybrany = parsed.data.herecId ?? '';
      if (vybrany && !nabizeni.has(vybrany)) {
        return NextResponse.json({ error: 'Tenhle hlas v nabídce není.' }, { status: 400 });
      }
      await prisma.prezentaceNabidky.update({
        where: { id: prez.id },
        data: { vybranyHerecId: vybrany || null, vybranoAt: vybrany ? ted : null },
      });
      if (vybrany) {
        const ukazka = await prisma.ukazkaNabidky
          .findUnique({ where: { id: vybrany }, select: { nazev: true } })
          .catch(() => null);
        void zvonek(prez, `Klient vybral hlas: ${ukazka?.nazev ?? ''}`.trim(), null);
      }
      return NextResponse.json({ ok: true });
    }

    const schvaluje = parsed.data.akce === 'schvalit';
    if (schvaluje && prez.schvalenoAt) {
      return NextResponse.json({ error: 'Tahle nabídka už je schválená.' }, { status: 409 });
    }

    await prisma.prezentaceNabidky.update({
      where: { id: prez.id },
      data: schvaluje
        ? { schvalenoAt: ted, schvalilJmeno: parsed.data.jmeno || null, odmitnutoAt: null }
        : { odmitnutoAt: ted, schvalilJmeno: parsed.data.jmeno || null, schvalenoAt: null },
    });

    /** Stav se propíše i do dokladu, ať se obojí nerozejde. */
    if (prez.offerId) {
      await prisma.offer
        .update({
          where: { id: prez.offerId },
          data: schvaluje
            ? {
                status: 'APPROVED',
                approvedAt: ted,
                approvedByName: parsed.data.jmeno || null,
                rejectedAt: null,
              }
            : { status: 'REJECTED', rejectedAt: ted, approvedAt: null },
        })
        .catch((err) => console.error('Stav dokladu se nepodařilo srovnat:', err));
    }

    void zvonek(
      prez,
      schvaluje ? 'Schválená nabídka' : 'Odmítnutá nabídka',
      parsed.data.jmeno || null,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/prezentace/[token]/odpoved selhalo:', err);
    return NextResponse.json({ error: 'Akci se nepodařilo uložit.' }, { status: 500 });
  }
}

/**
 * ZVONEČEK MANAŽEROVI. Odpověď klienta je pokyn k práci - bez toho by se na
 * ni přišlo jen tím, že si někdo otevře projekt. Nikdy nevyhazuje: zvoneček
 * nesmí shodit schválení, na které klient právě klepl.
 */
async function zvonek(
  prez: {
    id: string;
    nadpis: string | null;
    projectName: string;
    klientNazev: string;
    caflouProjectId: string;
    vytvorilId: string | null;
  },
  co: string,
  kdo: string | null,
): Promise<void> {
  try {
    const meta = await prisma.projectMeta
      .findUnique({
        where: { caflouProjectId: prez.caflouProjectId },
        select: { managerUserId: true },
      })
      .catch(() => null);
    const prijemce = meta?.managerUserId || prez.vytvorilId;
    if (!prijemce) return;

    await notify({
      userId: prijemce,
      kind: 'prezentace-odpoved',
      title: `${co}: ${prez.nadpis?.trim() || prez.projectName}`,
      body: [prez.klientNazev || null, kdo].filter(Boolean).join(' · '),
      url: `/projekty/${prez.caflouProjectId}?zalozka=prezentace`,
    });
  } catch (err) {
    console.error('Zvoneček o odpovědi na prezentaci selhal:', err);
  }
}
