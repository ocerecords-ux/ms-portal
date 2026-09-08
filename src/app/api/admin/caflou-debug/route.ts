import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { caflouFetch, caflouConfigured, listCaflouCompanies, listCaflouProjectsForCompany } from '@/lib/caflou';
import { isProjectFinished } from '@/lib/projectTypes';

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
      '/custom_columns?per=100',
      '/project_custom_columns?per=100',
      '/custom_fields?per=100',
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

  // ?sloupce=1 - projde vsechny projekty v uctu a vypise KAZDY vlastni sloupec
  // (custom_column_*), ktery se kde objevil, s poctem vyplnenych hodnot a
  // ukazkou. Presny nazev sloupce se totiz neda uhodnout - Caflou si ke slugu
  // obcas prida cislo ("custom_column_pocet_ns1") a sloupec se v odpovedi
  // objevi jen u projektu, ktere ho maji vyplneny (zadani 8. 9. 2026: overit,
  // jak se jmenuje nas vlastni sloupec "Datum vydani").
  if (req.nextUrl.searchParams.get('sloupce') === '1') {
    try {
      const columns: Record<string, { vyplneno: number; ukazka: unknown }> = {};
      let celkem = 0;
      for (let page = 1; page <= 15; page++) {
        const result = await caflouFetch(`/projects?per=100&page=${page}`);
        const results = (result.body as { results?: unknown } | null)?.results;
        if (!result.ok || !Array.isArray(results) || results.length === 0) break;
        for (const row of results as any[]) {
          celkem += 1;
          for (const key of Object.keys(row ?? {})) {
            if (!key.startsWith('custom_column_')) continue;
            columns[key] ??= { vyplneno: 0, ukazka: null };
            const value = (row as any)[key];
            if (value === null || value === undefined || value === '') continue;
            columns[key].vyplneno += 1;
            if (columns[key].ukazka === null) columns[key].ukazka = value;
          }
        }
        if ((results as any[]).length < 100) break;
      }
      return NextResponse.json({ prohledanoProjektu: celkem, vlastniSloupce: columns });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Dotaz na Caflou selhal.' }, { status: 502 });
    }
  }

  // ?najdi=NAZEV - najde projekty podle nazvu napric vsemi strankami a vypise
  // JEJICH SUROVA DATA. Slouzi k dohledani, proc konkretni projekt spadl do
  // spatne zalozky (zadani 8. 9. 2026: "OODA 7, TRIOLA, ATMOS - EN MUTACE jsou
  // v Caflou ukoncene, na portalu maji byt v Dokoncenych"). Da se zadat vic
  // nazvu oddelenych carkou a hleda se bez ohledu na diakritiku a mezery.
  //
  // ?aktivni=1 - vypise VSECHNY projekty, ktere portal po nove uprave ukaze v
  // zalozce Aktivni (nazev, stav, priznak finished). Kdyz v tom seznamu neco
  // byt nema, je hned videt, na jakem stavu to v Caflou visi.
  const najdi = req.nextUrl.searchParams.get('najdi');
  const vypisAktivni = req.nextUrl.searchParams.get('aktivni') === '1';
  if (najdi || vypisAktivni) {
    try {
      const zjednodus = (v: string) =>
        v
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '');
      const needles = (najdi ?? '')
        .split(',')
        .map((n) => zjednodus(n))
        .filter(Boolean);

      const found: any[] = [];
      const aktivni: any[] = [];
      const statusToFinished: Record<string, { finished: number; unfinished: number }> = {};
      let celkem = 0;
      let stranek = 0;
      for (let page = 1; page <= 15; page++) {
        const result = await caflouFetch(`/projects?per=100&page=${page}`);
        const results = (result.body as { results?: unknown } | null)?.results;
        if (!result.ok || !Array.isArray(results) || results.length === 0) break;
        stranek = page;
        for (const row of results as any[]) {
          celkem += 1;
          const status = String(row?.project_status_name ?? '(prázdné)');
          statusToFinished[status] ??= { finished: 0, unfinished: 0 };
          if (row?.finished) statusToFinished[status].finished += 1;
          else statusToFinished[status].unfinished += 1;

          const nazev = String(row?.name ?? '');
          if (needles.length > 0 && needles.some((n) => zjednodus(nazev).includes(n))) found.push(row);
          if (vypisAktivni && !isProjectFinished(status, row?.finished)) {
            aktivni.push({ id: row?.id, nazev, stav: status, finished: Boolean(row?.finished) });
          }
        }
        if ((results as any[]).length < 100) break;
      }
      return NextResponse.json({
        hledano: najdi ?? null,
        prohledanoProjektu: celkem,
        prohledanoStranek: stranek,
        nalezeno: found.length,
        // Prehled vsech stavu v uctu a jak u nich vypada priznak finished -
        // z toho je videt, podle ceho se ma rozpracovanost poznat.
        stavyAPriznakFinished: statusToFinished,
        ...(vypisAktivni ? { pocetAktivnich: aktivni.length, aktivni } : {}),
        zaznamy: found,
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Dotaz na Caflou selhal.' }, { status: 502 });
    }
  }

  // ?all=1 - prehled toho, co Caflou vraci za CELY ucet (bez filtru na firmu).
  // Slouzi k ladeni internich Projektu: kolik projektu vubec chodi, kolik z
  // nich je oznaceno jako dokoncene a jak se presne jmenuji pole, ze kterych
  // tahame stav, prioritu, normostrany a terminy.
  if (req.nextUrl.searchParams.get('all') === '1') {
    try {
      // ?page=N - vlastni sloupce (herec, pocet normostran, termin vydani)
      // se objevi jen u projektu, ktere je maji vyplnene, a Caflou vraci
      // nejdriv NEJSTARSI projekty - u tech z roku 2023 tam nejsou. Proto jde
      // vybrat stranka a diagnostika vypisuje vsechny nalezene custom_column_*.
      const page = Number(req.nextUrl.searchParams.get('page') || '1') || 1;
      const result = await caflouFetch(`/projects?per=100&page=${page}`);
      const results = (result.body as { results?: unknown } | null)?.results;
      if (!result.ok || !Array.isArray(results)) {
        return NextResponse.json({ status: result.status, ok: result.ok, body: result.body ?? result.raw.slice(0, 2000) });
      }
      const rows = results as any[];
      const statusNames = Array.from(new Set(rows.map((p) => p?.project_status_name).filter(Boolean)));
      // Vsechny vlastni sloupce nalezene na teto strance + ukazkova hodnota,
      // at je videt, jak se presne jmenuji (herec, normostrany, termin vydani).
      const customColumns: Record<string, unknown> = {};
      for (const row of rows) {
        for (const key of Object.keys(row ?? {})) {
          if (!key.startsWith('custom_column_')) continue;
          const value = (row as any)[key];
          if (customColumns[key] === undefined || customColumns[key] === null || customColumns[key] === '') {
            customColumns[key] = value ?? null;
          }
        }
      }
      return NextResponse.json({
        status: result.status,
        stranka: page,
        vlastniSloupce: customColumns,
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
