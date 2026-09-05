// Napojeni na Caflou (nase ucetni/projektove nastroje).
//
// 1) CTENI - sekce "Projekty" v portalu ukazuje klientovi projekty tak, jak
//    jsou vedene primo v Caflou (stav, herec, terminy). Portal do nich
//    nezasahuje - "projekty se menezuji hlavne v Caflou".
// 2) ZAKLADANI (puvodni, jiz drive pripravena funkce createCaflouProject) -
//    pri odeslani objednavky se best-effort zkusi zalozit odpovidajici
//    projekt v Caflou; vysledek se zaznamena k objednavce
//    (caflouProjectId/caflouSyncStatus/caflouSyncError). Dokud neni presne
//    overena struktura POST /projects, zustava toto zalozeni vypnute
//    (CAFLOU_NOT_CONFIGURED) i pri vyplnenych env promennych, aby se do
//    Caflou neposilaly neoverene/spatne pozadavky - viz TODO nize.
//
// DULEZITE - tenant izolace: projekty tahame VZDY podle caflouCompanyId
// konkretni firmy (nikdy neuvazujeme cely ucet Caflou najednou), stejne jako
// je tomu u Google Disku.
//
// POZNAMKA: presny tvar odpovedi Caflou API (nazvy poli u projektu) jeste
// nemame overeny na zivo - viz /api/admin/caflou-debug, ktery vraci syrovou
// odpoved pro rychle testovani z adminu, nez se podle skutecnych dat dolad'
// mapovani v pripadne funkci pro klientske zobrazeni.

const CAFLOU_BASE = 'https://app.caflou.com/api/v1';

export function caflouConfigured(): boolean {
  return Boolean(process.env.CAFLOU_API_KEY && process.env.CAFLOU_ACCOUNT_ID);
}

export type CaflouResult = { ok: boolean; status: number; body: unknown; raw: string };

export async function caflouFetch(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<CaflouResult> {
  const apiKey = process.env.CAFLOU_API_KEY;
  const accountId = process.env.CAFLOU_ACCOUNT_ID;
  if (!apiKey || !accountId) {
    throw new Error('Caflou API zatím není nastavené (chybí CAFLOU_API_KEY / CAFLOU_ACCOUNT_ID).');
  }
  const url = `${CAFLOU_BASE}/${accountId}${path}`;

  // Caflou API obcas kratkodobe odmitne soubezny pozadavek na stejnou cestu
  // hláškou 429 "Rate limit exceeded - same request is processing already" -
  // typicky kdyz Next.js prefetchne z hlavniho menu vic odkazu naraz a
  // /projekty se "srazi" s jinym souvisejicim pozadavkem (zprava uzivatele
  // 5. 9. 2026: "Projekty se nepodařilo načíst z Caflou"). Kratky retry (max
  // 3 pokusy, rostouci odstup) tohle ve vetsine pripadu vyresi driv, nez se
  // to vubec ukaze klientovi jako chyba.
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
    const raw = await res.text();
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      console.error('Caflou API chyba:', res.status, raw.slice(0, 2000));
    }
    const isRetryableRateLimit = res.status === 429 && attempt < MAX_ATTEMPTS;
    if (!isRetryableRateLimit) {
      return { ok: res.ok, status: res.status, body, raw };
    }
    await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
  }
  // Nedosazitelne (smycka vzdy vrati na poslednim pokusu), jen aby TS vedel,
  // ze funkce vzdy neco vraci.
  throw new Error('Caflou API: nedosazeno vysledku po opakovanych pokusech.');
}

/**
 * Nazev firmy primo z Caflou (GET /companies/{id}) - Caflou je zdroj pravdy
 * pro presny/plny obchodni nazev vc. pripony (s.r.o., a.s., LTD...), zatimco
 * Company.name v portalu byval jen orientacni nazev zadany rucne v adminu.
 * Pouziva se pro klientske zobrazeni (napr. sekce Nahravky); pri chybe se
 * volajici strana vraci k Company.name jako zalozni hodnote.
 */
export async function getCaflouCompanyName(caflouCompanyId: string): Promise<string | null> {
  try {
    const result = await caflouFetch(`/companies/${encodeURIComponent(caflouCompanyId)}`);
    if (!result.ok || !result.body || typeof result.body !== 'object') return null;
    const name = (result.body as { name?: unknown }).name;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

/** Syrovy seznam projektu dane firmy z Caflou - pro admin diagnostiku i pro pozdejsi mapovani. */
export async function listCaflouProjectsForCompany(caflouCompanyId: string): Promise<CaflouResult> {
  const params = new URLSearchParams();
  params.set('per', '200');
  params.append('filter[company_ids][]', caflouCompanyId);
  return caflouFetch(`/projects?${params.toString()}`);
}

/** Syrovy seznam firem/kontaktu v Caflou (volitelne vyfiltrovany podle nazvu) - pomocny nastroj, aby admin nemusel ID hledat rucne primo v Caflou. */
export async function listCaflouCompanies(search?: string): Promise<CaflouResult> {
  const params = new URLSearchParams();
  params.set('per', '1000'); // maximum povolene Caflou API - staci na vsechny firmy najednou
  if (search) params.set('filter[search]', search);
  return caflouFetch(`/companies?${params.toString()}`);
}

/** Projekt v podobe pripravene pro klientske zobrazeni (sekce "Projekty" v portalu). */
export type DisplayProject = {
  id: number;
  name: string;
  finished: boolean;
  statusName: string;
  narrator: string | null;
  pageCount: number | null;
  finishedAt: Date | null;
  releaseDate: Date | null;
  startDate: Date | null;
  endDate: Date | null;
};

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function toDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Prevede syrovou odpoved GET /projects (viz /api/admin/caflou-debug) na
 * pole projektu pro klientske zobrazeni. Zaznamy bez project_type_id
 * (interni testovaci/nepotvrzene zapisy v Caflou, napr. "Test") jsou
 * zamerne vyrazeny - klient je nema videt.
 *
 * Overeno na zivo z Caflou (viz custom_column_herec = jmeno herce/vypravece,
 * custom_column_termin_vydani = datum vydani - u obou dostupne jen u casti
 * projektu, proto se pocita s null).
 *
 * custom_column_pocet_normostran (zadani 12. 9. 2026 - "U projektů by měl
 * být vidět počet normostran") NENI jeste overeno naživo stejnym zpusobem
 * jako predchozi dva sloupce - odhadnuto dle stejne konvence pojmenovani
 * vlastnich sloupcu v Caflou. Pokud se v UI vsude ukazuje jen "—", je
 * potreba nazev sloupce overit pres /api/admin/caflou-debug?companyId=...
 * (syrova odpoved) a upravit klic nize.
 */
export function mapCaflouProjects(raw: unknown): DisplayProject[] {
  if (!raw || typeof raw !== 'object') return [];
  const results = (raw as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((p: any) => Boolean(p?.project_type_id))
    .map((p: any) => ({
      id: p.id,
      name: p.name || 'Bez názvu',
      finished: Boolean(p.finished),
      statusName: p.project_status_name || (p.finished ? 'Hotovo' : 'V realizaci'),
      narrator: p.custom_column_herec || null,
      pageCount: toIntOrNull(p.custom_column_pocet_normostran),
      finishedAt: toDate(p.finished_at),
      releaseDate: toDate(p.custom_column_termin_vydani),
      startDate: toDate(p.start_date),
      endDate: toDate(p.end_date),
    }));
}

export type AdminDisplayProject = DisplayProject & { companyName: string };

/**
 * Nacte aktivni + dokoncene projekty napric VICE firmami najednou (pro admin
 * prehled vsech projektu, na rozdil od listCaflouProjectsForCompany, ktera
 * je scoped na jednu firmu pro klientske zobrazeni). Kazda firma se dotazuje
 * samostatne a nezavisle - pokud se u jedne firmy nacteni nepovede, ostatni
 * to neovlivni, jen se jeji nazev vrati v failedCompanies.
 */
export async function listActiveCaflouProjectsForCompanies(
  companies: { name: string; caflouCompanyId: string }[],
): Promise<{ projects: AdminDisplayProject[]; failedCompanies: string[] }> {
  const results = await Promise.all(
    companies.map(async (c) => {
      try {
        const result = await listCaflouProjectsForCompany(c.caflouCompanyId);
        if (!result.ok) return { companyName: c.name, ok: false as const };
        const projects = mapCaflouProjects(result.body).map((p) => ({ ...p, companyName: c.name }));
        return { companyName: c.name, ok: true as const, projects };
      } catch {
        return { companyName: c.name, ok: false as const };
      }
    }),
  );

  const projects: AdminDisplayProject[] = [];
  const failedCompanies: string[] = [];
  for (const r of results) {
    if (r.ok) projects.push(...r.projects);
    else failedCompanies.push(r.companyName);
  }
  return { projects, failedCompanies };
}

/**
 * Zalozeni projektu v Caflou pri odeslani objednavky - best-effort, pouziva
 * se v /api/orders. Objednavka v portalu vznikne vzdy, i kdyz se toto
 * nepovede; vysledek se jen zaznamena (Order.caflouSyncStatus/caflouSyncError).
 *
 * TODO: presny format POST /projects (povinna pole, jak se predava
 * company_id/pocet stran) jeste neni overeny na zivo, takze zatim vraci
 * CAFLOU_NOT_CONFIGURED i po vyplneni klice - az bude overeno pres
 * /api/admin/caflou-debug, doplnit skutecne volani.
 */
export async function createCaflouProject(input: {
  projectName: string;
  clientTag: string;
  pageCount?: number | null;
}): Promise<{ ok: true; caflouProjectId: string } | { ok: false; error: string }> {
  if (!caflouConfigured()) {
    return { ok: false, error: 'CAFLOU_NOT_CONFIGURED' };
  }
  // Zatim zamerne nezakladame - viz TODO v komentari funkce.
  return { ok: false, error: 'CAFLOU_NOT_CONFIGURED' };
}
