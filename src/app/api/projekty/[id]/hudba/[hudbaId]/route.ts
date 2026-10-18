import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { isInternalRole } from '@/lib/roles';
import {
  kdeSkladbaLezi,
  odkazNaSkladbu,
  odpojSkladbu,
  upravSkladbu,
} from '@/lib/hudbaProjektuServer';
import { odeberZeSerie, rozesliUpravuDoSerie } from '@/lib/hudbaSerieServer';

/**
 * JEDNA SKLADBA (zadání 16. 10. 2026).
 *
 * GET    - adresa na přehrání, platí čtyři hodiny (vyrábí se až při kliknutí)
 * PATCH  - POZNÁMKA A OZNAČENÝ ÚSEK. Název a autor se čtou z metadat souboru
 *          a přepsat je by znamenalo, že v kartě svítí něco jiného než
 *          v souboru (zadání 17. 10. 2026: „ten název autor by neměl jít
 *          měnit"). Úsek je poznámka pro střih, soubor zůstává celý.
 * DELETE - ODPOJÍ skladbu od projektu. Soubor v Dropboxu zůstává; hudební
 *          knihovna je společná a jedno kliknutí nesmí vzít soubor projektům,
 *          které ho používají taky.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  poznamka: z.string().trim().max(500).nullable().optional(),
  usekOd: z.number().int().min(0).max(24 * 3600).nullable().optional(),
  usekDo: z.number().int().min(0).max(24 * 3600).nullable().optional(),
});

async function straz() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) return null;
  return session;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ hudbaId: string }> }) {
  if (!(await straz())) return odpovedChyby('chybaApi.bezOpravneni', 403);
  const { hudbaId } = await params;
  const odkaz = await odkazNaSkladbu(hudbaId);
  if (!odkaz) return odpovedChyby('chybaApi.souborNejdeOtevrit', 502);
  return NextResponse.json({ odkaz });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ hudbaId: string }> }) {
  if (!(await straz())) return odpovedChyby('chybaApi.bezOpravneni', 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);
  const { hudbaId } = await params;
  const ok = await upravSkladbu(hudbaId, parsed.data);
  /**
   * ÚPRAVA PLATÍ PRO CELOU SÉRII (17. 10. 2026: „I upravy"). Poznámka a úsek
   * patří ke skladbě, ne k jednomu dílu - u sérií se proto přepíšou všude.
   */
  const vSerii = ok ? await rozesliUpravuDoSerie({ hudbaId }) : 0;
  return NextResponse.json({ ok, vSerii }, { status: ok ? 200 : 500 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ hudbaId: string }> }) {
  if (!(await straz())) return odpovedChyby('chybaApi.bezOpravneni', 403);
  const { hudbaId } = await params;
  /**
   * ODEBRÁNÍ PLATÍ PRO CELOU SÉRII (17. 10. 2026). Kde se skladba nachází se
   * musí přečíst DŘÍV, než řádek zmizí - potom už není odkud vzít cestu
   * souboru. Maže se jen záznam, soubor v Dropboxu zůstává.
   */
  const kde = await kdeSkladbaLezi(hudbaId);
  const ok = await odpojSkladbu(hudbaId);
  const vSerii = ok && kde ? await odeberZeSerie(kde) : 0;
  return NextResponse.json({ ok, vSerii }, { status: ok ? 200 : 500 });
}
