import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canEditProjectMeta } from '@/lib/roles';
import { POVOLENE_ZDROJE, jePovolenyZdroj, vytahniHudbu } from '@/lib/hudbaZOdkazu';

/**
 * Načtení skladby z odkazu (zadání 10. 9. 2026) - portál stránku stáhne
 * a přečte z ní název a autora.
 *
 * DVĚ POJISTKY, protože stahuje SERVER, ne prohlížeč:
 *  1) jen povolené hudební knihovny (viz POVOLENE_ZDROJE). Bez seznamu by
 *     se přes tohle pole dalo poslat na jakoukoliv adresu, i na vnitřní
 *     službu, která zvenčí není vidět.
 *  2) krátký časový limit a strop na velikost - stránka, která se stahuje
 *     minutu, by držela funkci a nakonec stejně nic nepřinesla.
 *
 * Nic se neukládá; vrácené hodnoty si člověk ve formuláři může přepsat.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ url: z.string().trim().min(1) });

/** Kolik nejvýš přečteme. Meta značky jsou v hlavičce, dál lézt netřeba. */
const STROP_ZNAKU = 400_000;
const LIMIT_MS = 8000;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Chybí odkaz.' }, { status: 400 });

  const url = parsed.data.url;
  if (!jePovolenyZdroj(url)) {
    return NextResponse.json(
      {
        error: `Z tohohle odkazu údaje načíst neumím. Umím: ${POVOLENE_ZDROJE.slice(0, 6).join(', ')} a další hudební knihovny. Název a autora ale můžete vyplnit ručně.`,
      },
      { status: 400 },
    );
  }

  const prerus = new AbortController();
  const casovac = setTimeout(() => prerus.abort(), LIMIT_MS);
  try {
    const odpoved = await fetch(url, {
      signal: prerus.signal,
      redirect: 'follow',
      headers: {
        // Bez rozumne hlavicky vraci cast webu jinou stranku nez prohlizeci.
        'User-Agent': 'Mozilla/5.0 (compatible; MSPortal/1.0; +https://www.msportal.cz)',
        'Accept-Language': 'en',
      },
    });
    if (!odpoved.ok) {
      return NextResponse.json(
        { error: `Stránka odpověděla ${odpoved.status}. Zkuste odkaz otevřít v prohlížeči, nebo údaje vyplňte ručně.` },
        { status: 502 },
      );
    }

    const html = (await odpoved.text()).slice(0, STROP_ZNAKU);
    const hudba = vytahniHudbu(html);
    if (!hudba.nazev && !hudba.autor) {
      return NextResponse.json(
        { error: 'Na stránce jsem název ani autora nenašel. Vyplňte je prosím ručně.' },
        { status: 422 },
      );
    }
    return NextResponse.json(hudba);
  } catch (err) {
    // Chybu ze site nevypisujeme cloveku doslova - nese v sobe adresy a
    // podrobnosti, se kterymi stejne nic neudela.
    console.error('POST /api/hudba/nacti selhalo:', err);
    const vyprselo = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json(
      {
        error: vyprselo
          ? 'Stránka se nenačetla včas. Zkuste to znovu, nebo údaje vyplňte ručně.'
          : 'Stránku se nepodařilo stáhnout. Údaje můžete vyplnit ručně.',
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(casovac);
  }
}
