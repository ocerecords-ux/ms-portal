import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { caflouFetch, caflouConfigured, listCaflouCompanies, listCaflouProjectsForCompany } from '@/lib/caflou';

// Diagnosticky endpoint - admin si tu muze overit napojeni na Caflou pro
// konkretni firmu a hned videt syrovou odpoved (kvuli doladeni mapovani
// poli, dokud neni presne overena struktura dat z Caflou API). Rezim
// ?list=companies navic vypise vsechny firmy z Caflou (nazev + ID), aby
// admin nemusel ID hledat rucne primo v Caflou.
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  if (!caflouConfigured()) {
    return NextResponse.json({ error: 'Caflou API zatím není nastavené (chybí CAFLOU_API_KEY / CAFLOU_ACCOUNT_ID).' }, { status: 503 });
  }

  if (req.nextUrl.searchParams.get('list') === 'companies') {
    const search = req.nextUrl.searchParams.get('q') || undefined;
    try {
      const result = await listCaflouCompanies(search);
      return NextResponse.json({ status: result.status, ok: result.ok, body: result.body ?? result.raw });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Dotaz na Caflou selhal.' }, { status: 502 });
    }
  }

  // ?probe=1 - co vsechno nam Caflou API nabizi. Potrebujeme z nej dostat
  // firmy, herce a projekty do vlastni databaze (zadani 5. 9. 2026), a nez
  // napiseme import, musime vedet, ktere zdroje existuji a jak vypadaji.
  if (req.nextUrl.searchParams.get('probe') === '1') {
    const endpoints = [
      '/companies?per=3',
      '/contacts?per=3',
      '/people?per=3',
      '/users?per=3',
      '/project_types?per=50',
      '/project_statuses?per=50',
      '/tags?per=50',
    ];
    const out: Record<string, unknown> = {};
    for (const endpoint of endpoints) {
      try {
        const result = await caflouFetch(endpoint);
        const body = result.body as any;
        const rows = Array.isArray(body?.results) ? body.results : Array.isArray(body) ? body : null;
        out[endpoint] = {
          status: result.status,
          pocet: rows ? rows.length : null,
          klice: rows && rows[0] ? Object.keys(rows[0]) : null,
          prvni: rows ? rows[0] ?? null : String(result.raw).slice(0, 300),
        };
      } catch (err) {
        out[endpoint] = { chyba: err instanceof Error ? err.message : 'selhalo' };
      }
    }
    return NextResponse.json(out);
  }

  // ?all=1 - prehled toho, co Caflou vraci za CELY ucet (bez filtru na firmu).
  // Slouzi k ladeni internich Projektu: kolik projektu vubec chodi, kolik z
  // nich je oznaceno jako dokoncene a jak se presne jmenuji pole, ze kterych
  // tahame stav, prioritu, normostrany a terminy.
  if (req.nextUrl.searchParams.get('all') === '1') {
    try {
      const result = await caflouFetch('/projects?per=200&page=1');
      const results = (result.body as { results?: unknown } | null)?.results;
      if (!result.ok || !Array.isArray(results)) {
        return NextResponse.json({ status: result.status, ok: result.ok, body: result.body ?? result.raw.slice(0, 2000) });
      }
      const rows = results as any[];
      const statusNames = Array.from(new Set(rows.map((p) => p?.project_status_name).filter(Boolean)));
      return NextResponse.json({
        status: result.status,
        pocetProjektu: rows.length,
        dokoncenych: rows.filter((p) => Boolean(p?.finished)).length,
        nedokoncenych: rows.filter((p) => !p?.finished).length,
        bezTypuProjektu: rows.filter((p) => !p?.project_type_id).length,
        stavy: statusNames,
        klicePrvnihoZaznamu: rows[0] ? Object.keys(rows[0]) : [],
        prvniDvaZaznamy: rows.slice(0, 2),
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Dotaz na Caflou selhal.' }, { status: 502 });
    }
  }

  const companyId = req.nextUrl.searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ error: 'Chybí companyId.' }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: 'Firma nenalezena.' }, { status: 404 });
  }
  if (!company.caflouCompanyId) {
    return NextResponse.json({ error: 'Tato firma nemá vyplněné ID firmy v Caflou.' }, { status: 400 });
  }

  try {
    const result = await listCaflouProjectsForCompany(company.caflouCompanyId);
    return NextResponse.json({ status: result.status, ok: result.ok, body: result.body ?? result.raw });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Dotaz na Caflou selhal.' }, { status: 502 });
  }
}
