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
  return { ok: res.ok, status: res.status, body, raw };
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
