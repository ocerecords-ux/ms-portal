import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';
import { STAVY_PROJEKTU } from '@/lib/stavyProjektu';
import { zapisZmenyProjektu } from '@/lib/projektLogServer';
import { uzavriDotazyProjektu } from '@/lib/dotazyServer';

/**
 * UKONČIT PROJEKT RUČNĚ (zadání 16. 9. 2026: „dejme někde možnost ukončit
 * projekt ručně. Děje se to ve chvíli, kdy už máme poslanou fakturu na klienta
 * ještě předtím, než se překlopí stav na Schváleno - k fakturaci").
 *
 * Projekt normálně zhasíná sám, když se z portálu odešle faktura (viz
 * /api/admin/invoices/[id]/send). Jenže faktura občas odejde jinudy nebo dřív,
 * než projekt došel na konec cesty - a pak zakázka zůstane viset mezi
 * aktivními, i když je hotová. Tohle je ta ruční cesta.
 *
 * DĚLÁ TO TOTÉŽ, CO ODESLANÁ FAKTURA: stav „Vyfakturováno" a příznak
 * `finished`. Schválně ne nový stav „Ukončeno" - dvě jména pro jeden konec by
 * znamenala, že se všude musí hlídat obojí.
 *
 * ZPRÁVA KLIENTOVI ODSUD NEODCHÁZÍ. Přehození stavu ve formuláři posílá
 * klientovi zprávu podle vzoru; tady se projekt zavírá POTÉ, co už mu něco
 * odešlo (faktura), takže druhá zpráva by byla navíc.
 */
export const dynamic = 'force-dynamic';

/** Konec cesty projektu - poslední stav v seznamu, ne napsaný řetězec. */
const STAV_KONEC = STAVY_PROJEKTU[STAVY_PROJEKTU.length - 1].nazev;
/** Krok před koncem - sem se projekt vrátí, když se ukončení bere zpět. */
const STAV_PRED_KONCEM = STAVY_PROJEKTU[STAVY_PROJEKTU.length - 2]?.nazev ?? null;

const schema = z.object({
  /** false = vrátit mezi aktivní (oprava omylu). */
  ukoncit: z.boolean(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  }
  const { ukoncit } = parsed.data;

  try {
    const pred = await prisma.projectMeta.findUnique({
      where: { caflouProjectId: params.id },
      select: { statusName: true, finished: true },
    });
    if (!pred) return NextResponse.json({ error: 'Projekt nenalezen.' }, { status: 404 });

    /**
     * Při vracení mezi aktivní se stav NEHÁDÁ zpátky - odkud projekt přišel,
     * portál neví. Zůstane, jak je, a člověk ho přehodí sám; jen přestane
     * platit, že je hotový.
     *
     * Výjimka je „Vyfakturováno": ten stav sám o sobě znamená konec, takže
     * po vrácení mezi aktivní by si odporoval sám se sebou.
     */
    const stav = ukoncit
      ? STAV_KONEC
      : pred.statusName === STAV_KONEC
        ? STAV_PRED_KONCEM
        : pred.statusName;

    await prisma.projectMeta.update({
      where: { caflouProjectId: params.id },
      data: { finished: ukoncit, statusName: stav },
    });

    await zapisZmenyProjektu({
      caflouProjectId: params.id,
      pred: { statusName: pred.statusName, finished: pred.finished },
      ulozeno: { statusName: stav, finished: ukoncit },
      puvodce: { id: session.user.id, jmeno: session.user.name || session.user.email || null },
    });

    // Dokoncenym projektem se uzavira i kanal dotazu klienta - stejne jako
    // kdyz se stav prehodi ve formulari (zadani 11. 9. 2026).
    if (ukoncit) void uzavriDotazyProjektu(params.id).catch(() => undefined);

    return NextResponse.json({ ok: true, finished: ukoncit, statusName: stav });
  } catch (err) {
    console.error('POST /api/projekty/[id]/ukonceni selhalo:', err);
    return NextResponse.json({ error: 'Nepodařilo se to uložit.' }, { status: 500 });
  }
}
