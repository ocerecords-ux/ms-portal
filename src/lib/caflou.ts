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

import type { ProjectPriority } from '@prisma/client';

import { isActiveProjectStatus } from '@/lib/projectTypes';

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
  const MAX_ATTEMPTS = 4;
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
    // Exponencialni odstup (0,4 s / 0,9 s / 1,8 s) - Caflou hlaskou 429 rika
    // taky "same request is processing already", takze kratke cekani casto staci.
    await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
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
  /**
   * Dokonceny projekt. POZOR: neni to primo priznak `finished` z Caflou - ten
   * maji v uctu nastaveny uplne vsechny projekty, i ty se stavem "Natáčíme"
   * (overeno 5. 9. 2026). Rozhoduje proto stav projektu, viz
   * lib/projectTypes.ts (ACTIVE_PROJECT_STATUSES); `finished` z Caflou slouzi
   * uz jen jako zaloha u projektu bez stavu.
   */
  finished: boolean;
  statusName: string;
  /** Priorita z Caflou (zadani 5. 9. 2026: prioritu cerpat z Caflou, ne z portalu). */
  priority: ProjectPriority | null;
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

/**
 * Priorita z Caflou. Overeno na zivo 5. 9. 2026: Caflou u projektu vraci
 * project_priority_name ("Vysoká"/"Střední"/"Nízká") a zaroven strojove
 * priority ("high"/"middle"/"low"). Mapujeme tolerantne obojI; co nepoznáme,
 * bereme jako "neuvedeno" a v portalu se pak pouzije rucne nastavena priorita
 * (ProjectMeta) jako zaloha.
 */
function toPriority(v: unknown): ProjectPriority | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (['1', 'low', 'nízká', 'nizka', 'nízká priorita', 'malá', 'mala'].includes(s)) return 'LOW';
  if (['2', 'medium', 'middle', 'normal', 'normální', 'normalni', 'střední', 'stredni'].includes(s)) return 'MEDIUM';
  if (['3', 'high', 'urgent', 'vysoká', 'vysoka', 'kritická', 'kriticka'].includes(s)) return 'HIGH';
  return null;
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
  return results.filter((p: any) => Boolean(p?.project_type_id)).map(mapOneCaflouProject);
}

/**
 * Prevede jeden syrovy zaznam projektu z Caflou na DisplayProject. Vytazeno
 * z mapCaflouProjects, aby se stejne mapovani dalo pouzit i pro detail
 * projektu a pro interni prehled napric vsemi firmami.
 */
export function mapOneCaflouProject(p: any): DisplayProject {
  const statusName: string = p.project_status_name || (p.finished ? 'Hotovo' : 'V realizaci');
  return {
    id: p.id,
    name: p.name || 'Bez názvu',
    finished: p.project_status_name ? !isActiveProjectStatus(statusName) : Boolean(p.finished),
    statusName,
    priority: toPriority(p.project_priority_name ?? p.priority ?? p.custom_column_priorita),
    narrator: p.custom_column_herec || null,
    // Overeno na zivo 5. 9. 2026: vlastni sloupec s normostranami se v uctu
    // jmenuje "custom_column_pocet_ns1" (drive jsme hadali
    // "custom_column_pocet_normostran", proto byl sloupec vzdy prazdny).
    // Sloupce se navic objevi jen u projektu, ktere je maji vyplnene.
    pageCount:
      toIntOrNull(p.custom_column_pocet_ns1) ??
      toIntOrNull(p.custom_column_pocet_normostran) ??
      toIntOrNull(String(p.custom_column_pocet_ns1_decorated ?? '').trim()),
    finishedAt: toDate(p.finished_at),
    releaseDate: toDate(p.custom_column_termin_vydani),
    startDate: toDate(p.start_date),
    endDate: toDate(p.end_date),
  };
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

// ---------------------------------------------------------------------------
// Interni prehled VSECH projektu (zadani 5. 9. 2026)
// ---------------------------------------------------------------------------
// listActiveCaflouProjectsForCompanies vyse se pta Caflou zvlast za kazdou
// firmu (N pozadavku naraz) - to se pri vice firmach zacalo srazet o rate
// limit Caflou a v adminu koncilo hlaskou "Nepodařilo se načíst projekty z
// Caflou u: ...". Pro interni prehled proto stahujeme rovnou CELY seznam
// projektu uctu jednim (strankovanym) dotazem a nazev firmy k projektu
// doplnujeme az u nas.

/** Vytahne ID firmy z projektu v Caflou - nazev pole neni v API dokumentaci jednoznacny, zkousime znama mista. */
function caflouCompanyIdOf(p: any): string | null {
  const candidate =
    p?.company_id ?? p?.companyId ?? p?.company?.id ?? p?.client_id ?? p?.customer_id ?? null;
  if (candidate === null || candidate === undefined || candidate === '') return null;
  return String(candidate);
}

/** Nazev firmy, pokud ho Caflou u projektu rovnou posila (jinak si ho doplnime z nasi databaze). */
function caflouCompanyNameOf(p: any): string | null {
  const candidate = p?.company_name ?? p?.company?.name ?? p?.client_name ?? null;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

/**
 * Nacte vsechny projekty uctu z Caflou (strankovane po 200) a doplni k nim
 * nazev firmy - primo z Caflou, jinak podle caflouCompanyId firem v portalu.
 *
 * Na rozdil od klientskeho zobrazeni se tu projekty NEFILTRUJI podle
 * project_type_id - interni tym ma videt uplne vsechno, co v Caflou je.
 */
// Cely seznam projektu uctu je pro Caflou drahy dotaz - pri kazdem zobrazeni
// stranky by se poslal znovu a Caflou zacne vracet 429 ("Rate limit exceeded -
// same request is processing already"), coz uzivatel vidi jako "Projekty se
// nepodarilo nacist z Caflou" (hlaseno 5. 9. 2026). Proto:
//  - vysledek si na pet minut drzime v pameti instance,
//  - soubezne pozadavky sdili jeden probihajici dotaz (dedupe),
//  - kdyz Caflou odmitne, radeji ukazeme i starsi data z cache nez prazdnou
//    stranku s chybou.
type InternalProjectsResult = { projects: AdminDisplayProject[]; error: string | null };

const PROJECTS_CACHE_MS = 5 * 60 * 1000;
const PROJECTS_STALE_MS = 30 * 60 * 1000;
let projectsCache: { at: number; projects: AdminDisplayProject[] } | null = null;
let projectsInFlight: Promise<InternalProjectsResult> | null = null;

export async function listAllCaflouProjectsForInternal(
  knownCompanies: { name: string; caflouCompanyId: string }[],
): Promise<InternalProjectsResult> {
  const now = Date.now();
  if (projectsCache && now - projectsCache.at < PROJECTS_CACHE_MS) {
    return { projects: projectsCache.projects, error: null };
  }
  if (projectsInFlight) return projectsInFlight;

  projectsInFlight = fetchAllCaflouProjects(knownCompanies)
    .then((result) => {
      if (!result.error) {
        projectsCache = { at: Date.now(), projects: result.projects };
        return result;
      }
      // Dotaz selhal - kdyz mame necim starsi, ale jeste pouzitelna data, ukazeme je.
      if (projectsCache && Date.now() - projectsCache.at < PROJECTS_STALE_MS) {
        return {
          projects: projectsCache.projects,
          error: null,
        };
      }
      return result;
    })
    .finally(() => {
      projectsInFlight = null;
    });

  return projectsInFlight;
}

/** Jedna stranka projektu z Caflou; pri chybe vraci HTTP status jako cislo. */
async function fetchProjectsPage(page: number, per: number): Promise<any[] | number> {
  const result = await caflouFetch(`/projects?per=${per}&page=${page}`);
  if (!result.ok) return result.status;
  const results = (result.body as { results?: unknown } | null)?.results;
  return Array.isArray(results) ? (results as any[]) : [];
}

async function fetchAllCaflouProjects(
  knownCompanies: { name: string; caflouCompanyId: string }[],
): Promise<InternalProjectsResult> {
  const nameById = new Map(knownCompanies.map((c): [string, string] => [String(c.caflouCompanyId), c.name]));

  // Caflou strop je 100 zaznamu na stranku (overeno 5. 9. 2026: na per=200
  // vratilo presne 100) a radi od nejstarsich. Ucet ma radove sedm stovek
  // projektu, takze cely seznam je 7-8 dotazu - proto se drzi v cache (viz
  // listAllCaflouProjectsForInternal) a nestahuje se pri kazdem zobrazeni.
  //
  // Filtr "jen nerozpracovane" tu zamerne nezkousime: priznak `finished` maji
  // v uctu nastaveny vsechny projekty, takze by nevratil nic. Rozpracovanost
  // se pozna az u nas podle stavu projektu (viz mapOneCaflouProject).
  const PER = 100;
  const MAX_PAGES = 15;
  const TIME_BUDGET_MS = 20000;
  const startedAt = Date.now();

  const rawProjects: any[] = [];
  const seenIds = new Set<string>();

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      const rows = await fetchProjectsPage(page, PER);

      if (typeof rows === 'number') {
        // Prvni stranka selhala = nemame nic. U dalsich vratime aspon to, co uz mame.
        if (page === 1) {
          return {
            projects: [],
            error:
              rows === 429
                ? 'Caflou nás teď odmítá kvůli limitu dotazů (429). Za chvíli to zkuste znovu.'
                : `Caflou API odpovědělo chybou ${rows}.`,
          };
        }
        break;
      }

      if (rows.length === 0) break;

      // Pojistka pro pripad, ze by Caflou parametr "page" ignorovalo a vracelo
      // porad tu samou stranku - bez toho by se projekty zopakovaly.
      const before = seenIds.size;
      for (const row of rows) {
        const key = String(row?.id ?? '');
        if (!key || seenIds.has(key)) continue;
        seenIds.add(key);
        rawProjects.push(row);
      }
      if (seenIds.size === before) break;
      if (rows.length < PER) break;
    }
  } catch (err) {
    return { projects: [], error: err instanceof Error ? err.message : 'Dotaz na Caflou selhal.' };
  }

  const projects: AdminDisplayProject[] = rawProjects.map((p: any) => {
    const caflouCompanyId = caflouCompanyIdOf(p);
    const companyName =
      caflouCompanyNameOf(p) ?? (caflouCompanyId ? nameById.get(caflouCompanyId) ?? null : null) ?? '—';
    return { ...mapOneCaflouProject(p), companyName };
  });

  return { projects, error: null };
}

/**
 * Jeden projekt z Caflou podle ID - pro detail projektu v interni sekci.
 * Vraci null, kdyz projekt neexistuje nebo se ho nepodarilo nacist.
 */
export async function getCaflouProject(
  caflouProjectId: string,
): Promise<{ project: DisplayProject; caflouCompanyId: string | null } | null> {
  try {
    const result = await caflouFetch(`/projects/${encodeURIComponent(caflouProjectId)}`);
    if (!result.ok || !result.body || typeof result.body !== 'object') return null;
    // Caflou u detailu vraci bud rovnou objekt projektu, nebo ho zabaleny v "result"/"results".
    const body = result.body as any;
    const p = body?.result ?? (Array.isArray(body?.results) ? body.results[0] : null) ?? body;
    if (!p || typeof p !== 'object' || (!p.id && !p.name)) return null;
    return { project: mapOneCaflouProject(p), caflouCompanyId: caflouCompanyIdOf(p) };
  } catch {
    return null;
  }
}

/**
 * Zaloha pro detail projektu: kdyz Caflou nepodporuje/nevrati GET
 * /projects/{id}, dohledame projekt v celem seznamu projektu uctu.
 */
export async function findCaflouProjectInList(
  caflouProjectId: string,
): Promise<{ project: DisplayProject; caflouCompanyId: string | null } | null> {
  try {
    const params = new URLSearchParams();
    params.set('per', '200');
    const result = await caflouFetch(`/projects?${params.toString()}`);
    if (!result.ok) return null;
    const results = (result.body as { results?: unknown } | null)?.results;
    if (!Array.isArray(results)) return null;
    const found = (results as any[]).find((p) => String(p?.id ?? '') === String(caflouProjectId));
    if (!found) return null;
    return { project: mapOneCaflouProject(found), caflouCompanyId: caflouCompanyIdOf(found) };
  } catch {
    return null;
  }
}
