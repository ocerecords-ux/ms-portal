import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { smiNaStranku } from '@/lib/pristupyServer';
import { nactiKapacituRoku } from '@/lib/kapacitaServer';
import { csvKapacity } from '@/lib/kapacitaAnalyzy';

/**
 * OBSAZENOST STUDIÍ KE STAŽENÍ (zadání 20. 9. 2026: „ať si můžu kdyžtak
 * udělat nějaké analýzy a grafy z obsazenosti studia").
 *
 * Jeden řádek = den × studio × frekvence, takže si v Excelu jde udělat
 * cokoli: kontingenční tabulka po měsících, srovnání studií, jen víkendy…
 *
 * Středník a desetinná čárka schválně - Excel v češtině si to otevře rovnou
 * do sloupců, čárka by mu rozsypala čísla. Na začátku je BOM, jinak v něm
 * háčky a čárky vypadají jako klikyháky.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // Stejná kontrola jako na stránce Kapacity - podle zaškrtávátek z karty,
  // ne jen podle role (6. 10. 2026).
  if (
    !session?.user?.id ||
    !(await smiNaStranku({ id: session.user.id, role: session.user.role }, '/prehledy/kapacita'))
  ) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const zadany = Number(new URL(req.url).searchParams.get('rok'));
  const rok = zadany >= 2000 && zadany <= 2100 ? zadany : new Date().getUTCFullYear();

  try {
    const prehled = await nactiKapacituRoku(rok);
    const csv = `﻿${csvKapacity(prehled)}`;
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="obsazenost-studii-${rok}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('GET /api/prehledy/kapacita-csv selhalo:', err);
    return NextResponse.json({ error: 'Data se nepodařilo připravit.' }, { status: 500 });
  }
}
