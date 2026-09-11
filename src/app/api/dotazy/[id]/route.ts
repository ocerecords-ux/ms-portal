import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiDotaz, posliDotaz, projektPatriFirme } from '@/lib/dotazyServer';

/**
 * Dotazy klienta k projektu (zadání 11. 9. 2026). Vlastní endpoint, ne
 * uvolnění MS chatu: klient se sem dostane jen ke kanálu svého projektu
 * a nikam jinam.
 *
 * `[id]` je ID projektu (caflouProjectId), ne ID konverzace - klient ID
 * konverzace nezná a znát nepotřebuje.
 */
export const dynamic = 'force-dynamic';

async function overPristup(caflouProjectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { chyba: NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 }) };
  }
  const companyId = session.user.companyId;
  if (!companyId) {
    return { chyba: NextResponse.json({ error: 'Účet není napojený na firmu.' }, { status: 403 }) };
  }
  // ID projektu chodi z prohlizece - overuje se pokazde, ne jen pri zalozeni.
  if (!(await projektPatriFirme(caflouProjectId, companyId))) {
    return { chyba: NextResponse.json({ error: 'K tomuto projektu nemáte přístup.' }, { status: 403 }) };
  }
  return { userId: session.user.id, companyId };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await overPristup(params.id);
  if ('chyba' in pristup) return pristup.chyba;

  const data = await nactiDotaz(params.id, pristup.companyId, pristup.userId);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await overPristup(params.id);
  if ('chyba' in pristup) return pristup.chyba;

  let telo: { text?: string; projectName?: string };
  try {
    telo = (await req.json()) as { text?: string; projectName?: string };
  } catch {
    return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });
  }

  const vysledek = await posliDotaz(
    params.id,
    (telo.projectName || '').trim() || `Projekt ${params.id}`,
    pristup.companyId,
    pristup.userId,
    telo.text ?? '',
  );
  if (!vysledek.ok) return NextResponse.json({ error: vysledek.message }, { status: 400 });

  const data = await nactiDotaz(params.id, pristup.companyId, pristup.userId);
  return NextResponse.json(data);
}
