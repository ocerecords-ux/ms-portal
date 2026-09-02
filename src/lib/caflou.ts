/**
 * Adapter pro napojeni na Caflou API.
 *
 * DULEZITE: Presne tvary endpointu a autentizace jeste nejsou potvrzene
 * (cekame na API klic + specifikaci poli z vaseho Caflou uctu - viz ukol
 * v README). Volani je proto zabalene tak, aby:
 *  - selhani Caflou NIKDY nezablokovalo ulozeni objednavky klientovi,
 *  - vysledek (uspech/chyba) sel dohledat u objednavky v adminu
 *    (Order.caflouSyncStatus / caflouSyncError).
 *
 * Az budete mit API klic, staci upravit CAFLOU_API_BASE_URL / hlavicky
 * a tvar payloadu v teto jedine funkci - zbytek aplikace se nemeni.
 */

type CreateCaflouProjectInput = {
  projectName: string;
  clientTag: string; // Company.caflouTag - stitek, kterym je klient v Caflou oznacen
  pageCount: number | null;
};

type CaflouResult =
  | { ok: true; caflouProjectId: string }
  | { ok: false; error: string };

export async function createCaflouProject(input: CreateCaflouProjectInput): Promise<CaflouResult> {
  const baseUrl = process.env.CAFLOU_API_BASE_URL;
  const apiKey = process.env.CAFLOU_API_KEY;

  if (!baseUrl || !apiKey) {
    // Caflou zatim neni nakonfigurovane - objednavka se ulozi normalne,
    // jen se nezalozi projekt automaticky (bude potreba rucne).
    return { ok: false, error: 'CAFLOU_NOT_CONFIGURED' };
  }

  try {
    // TODO: az bude znama presna specifikace, nahradit skutecnym endpointem/poli.
    const res = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: input.projectName,
        tags: [input.clientTag],
        custom_attributes: {
          pocet_normostran: input.pageCount,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Caflou API ${res.status}: ${text.slice(0, 300)}` };
    }

    const data = await res.json();
    const caflouProjectId = data?.id ?? data?.project?.id;
    if (!caflouProjectId) {
      return { ok: false, error: 'Caflou API nevratilo ID projektu.' };
    }
    return { ok: true, caflouProjectId: String(caflouProjectId) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Neznama chyba pri volani Caflou API' };
  }
}
