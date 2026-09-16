/**
 * Údaje firmy z registru ARES podle IČ (zadání 6. 9. 2026: „bylo by dobré,
 * kdyby šlo údaje načíst z registru podle IČ").
 *
 * Vytaženo ze samotné routy 16. 9. 2026, protože se do registru ptají dvě
 * místa: administrace (přihlášený člověk) a veřejný formulář, kde firma
 * vyplňuje své údaje z odkazu. Samotné dotazování je stejné, liší se jen to,
 * kdo se smí ptát.
 *
 * Používá se veřejné REST API ARESu — bez klíče, jen s rozumným časovým
 * stropem, aby čekání na registr nezdrželo odpověď portálu.
 */

const ARES_URL = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';

export type UdajeZAresu = {
  name: string | null;
  ic: string;
  dic: string | null;
  vatPayer: boolean;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  addressCountry: string;
};

export type VysledekAresu =
  | { ok: true; udaje: UdajeZAresu }
  | { ok: false; chyba: string; status: number };

/** Osm číslic, nic jiného — mezery a lomítka z kopírování se vyhodí. */
export function ocistiIco(vstup: string | null | undefined): string {
  return (vstup || '').replace(/\D/g, '');
}

export async function najdiVAresu(vstup: string | null | undefined): Promise<VysledekAresu> {
  const ico = ocistiIco(vstup);
  if (ico.length !== 8) {
    return { ok: false, chyba: 'IČ musí mít 8 číslic.', status: 400 };
  }

  try {
    const res = await fetch(`${ARES_URL}/${ico}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      return { ok: false, chyba: 'Firma s tímto IČ v registru není.', status: 404 };
    }
    if (!res.ok) {
      return { ok: false, chyba: `Registr odpověděl chybou ${res.status}.`, status: 502 };
    }

    const data = (await res.json()) as any;
    const sidlo = data?.sidlo ?? {};
    // ARES vraci adresu po castech; slozime z nich ulici s cislem popisnym tak,
    // jak se bezne pise na faktury.
    const streetParts = [
      sidlo.nazevUlice || sidlo.nazevCastiObce || null,
      [sidlo.cisloDomovni, sidlo.cisloOrientacni].filter(Boolean).join('/') || null,
    ].filter(Boolean);

    return {
      ok: true,
      udaje: {
        name: data?.obchodniJmeno ?? null,
        ic: data?.ico ?? ico,
        dic: data?.dic ?? null,
        vatPayer: Boolean(data?.dic),
        addressStreet: streetParts.length ? streetParts.join(' ') : sidlo.textovaAdresa ?? null,
        addressCity: sidlo.nazevObce ?? null,
        addressZip: sidlo.psc ? String(sidlo.psc).replace(/(\d{3})(\d{2})/, '$1 $2') : null,
        addressCountry: sidlo.kodStatu === 'CZ' || !sidlo.kodStatu ? 'CZ' : sidlo.kodStatu,
      },
    };
  } catch (err) {
    console.error('ARES lookup selhal:', err);
    return { ok: false, chyba: 'Registr se nepodařilo zeptat. Zkuste to prosím znovu.', status: 502 };
  }
}
