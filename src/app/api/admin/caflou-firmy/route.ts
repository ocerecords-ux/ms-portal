import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { caflouConfigured, caflouFetch } from '@/lib/caflou';
import { guessContactKind, mapCaflouCompany } from '@/lib/caflouCompanies';

// Import firem z Caflou (zadani 8. 9. 2026). Bere se VZDY jedna stranka -
// prohlizec si rekne o dalsi, dokud neni hotovo. Jeden pozadavek pres cely
// ucet by na Vercelu vyprsel, stejne jako u projektu.
//
// Opakovany import nic nezduplikuje: klicem je ID z Caflou, takze uz znamou
// firmu jen aktualizuje a NEPREPISUJE roztrideni (sloupec kind), aby rucni
// praci neprepsal dalsi import.
const schema = z.object({
  page: z.number().int().min(1).max(200).default(1),
  /** Rovnou odhadnout, kdo je klient a kdo herec (zadani 8. 9. 2026). */
  autoKind: z.boolean().optional(),
});

const PER = 100;

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  if (!caflouConfigured()) {
    return NextResponse.json(
      { error: 'Caflou API zatím není nastavené (chybí CAFLOU_API_KEY / CAFLOU_ACCOUNT_ID).' },
      { status: 503 },
    );
  }

  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    const page = parsed.success ? parsed.data.page : 1;
    const autoKind = parsed.success ? parsed.data.autoKind === true : false;

    const result = await caflouFetch(`/companies?per=${PER}&page=${page}`);
    const results = (result.body as { results?: unknown } | null)?.results;
    if (!result.ok || !Array.isArray(results)) {
      return NextResponse.json(
        {
          error:
            result.status === 429
              ? 'Caflou nás teď odmítá kvůli limitu dotazů (429). Zkuste to za chvíli znovu.'
              : `Caflou API odpovědělo chybou ${result.status}.`,
        },
        { status: 502 },
      );
    }

    const rows = results as any[];
    let ulozeno = 0;
    let odhadnuto = 0;
    for (const row of rows) {
      const mapped = mapCaflouCompany(row);
      if (!mapped) continue;
      const { id, ...fields } = mapped;

      // Odhad se pouzije jen tam, kde jeste nic vybraneho neni - rucni
      // rozhodnuti uz nikdy neprepiseme (ani opakovanym importem).
      const stavajici = await prisma.caflouCompany.findUnique({ where: { id }, select: { kind: true } });
      const odhad = autoKind && (!stavajici || stavajici.kind === 'NEZARAZENO') ? guessContactKind(mapped, row) : null;
      if (odhad && odhad.kind !== 'NEZARAZENO') odhadnuto += 1;

      await prisma.caflouCompany.upsert({
        where: { id },
        update: {
          ...fields,
          raw: row,
          ...(odhad ? { kind: odhad.kind, kindReason: odhad.reason } : {}),
        },
        create: {
          id,
          ...fields,
          raw: row,
          ...(odhad ? { kind: odhad.kind, kindReason: odhad.reason } : {}),
        },
      });
      ulozeno += 1;
    }

    return NextResponse.json({
      ok: true,
      stranka: page,
      nacteno: rows.length,
      ulozeno,
      odhadnuto,
      dalsiStranka: rows.length === PER ? page + 1 : null,
    });
  } catch (err) {
    console.error('POST /api/admin/caflou-firmy selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Import se nezdařil (${message}).` }, { status: 500 });
  }
}
