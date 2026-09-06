import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';

// Nacteni udaju firmy z ARES podle ICO (zadani 6. 9. 2026: "bylo by dobré,
// kdyby šlo údaje načíst z registru podle IČ"). Pouziva verejne REST API
// ARES (ekonomicke subjekty) - bez klice, jen rozumny timeout.
export const dynamic = 'force-dynamic';

const ARES_URL = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const ico = (req.nextUrl.searchParams.get('ico') || '').replace(/\D/g, '');
  if (ico.length !== 8) {
    return NextResponse.json({ error: 'IČ musí mít 8 číslic.' }, { status: 400 });
  }

  try {
    const res = await fetch(`${ARES_URL}/${ico}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      return NextResponse.json({ error: 'Firma s tímto IČ v registru není.' }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Registr odpověděl chybou ${res.status}.` }, { status: 502 });
    }

    const data = (await res.json()) as any;
    const sidlo = data?.sidlo ?? {};
    // ARES vraci adresu po castech; slozime z nich ulici s cislem popisnym tak,
    // jak se bezne pise na faktury.
    const streetParts = [
      sidlo.nazevUlice || sidlo.nazevCastiObce || null,
      [sidlo.cisloDomovni, sidlo.cisloOrientacni].filter(Boolean).join('/') || null,
    ].filter(Boolean);

    return NextResponse.json({
      name: data?.obchodniJmeno ?? null,
      ic: data?.ico ?? ico,
      dic: data?.dic ?? null,
      vatPayer: Boolean(data?.dic),
      addressStreet: streetParts.length ? streetParts.join(' ') : sidlo.textovaAdresa ?? null,
      addressCity: sidlo.nazevObce ?? null,
      addressZip: sidlo.psc ? String(sidlo.psc).replace(/(\d{3})(\d{2})/, '$1 $2') : null,
      addressCountry: sidlo.kodStatu === 'CZ' || !sidlo.kodStatu ? 'CZ' : sidlo.kodStatu,
    });
  } catch (err) {
    console.error('ARES lookup selhal:', err);
    return NextResponse.json({ error: 'Registr se nepodařilo zeptat. Zkuste to prosím znovu.' }, { status: 502 });
  }
}
