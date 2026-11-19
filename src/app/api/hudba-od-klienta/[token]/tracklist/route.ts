import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { odpovedChyby } from '@/lib/chybyApi';
import { nactiTracklist, ulozTracklist } from '@/lib/tracklistServer';
import { oznacTracklist, projektPodleTokenu } from '@/lib/vyzvaHudbaServer';

/**
 * TRACKLIST, KTERÝ VYPLNIL KLIENT (zadání 19. 11. 2026: „v rámci toho
 * tracklistu by se měli dostat do samého rozhraní projektu jako my a v něm ho
 * vytvářet").
 *
 * VEŘEJNÉ, ALE JEN NA JEDEN PROJEKT - stejně jako vkládání hudby vedle.
 * Přihlášení tu není: tracklist u klienta často řeší někdo, kdo v portálu účet
 * nemá. Token je jediný klíč a vede vždycky na jednu zakázku.
 *
 * Seznam se ukládá do TÉŽE tabulky jako ten náš (TrackProjektu) - je to jeden
 * tracklist, ne klientská kopie. Kdo ho naposledy uložil, se poznamená do
 * výzvy (VyzvaHudba.tracklistAt), ať je u projektu vidět, odkud přišel.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  tracky: z
    .array(
      z.object({
        nazevTracku: z.string().trim().max(300),
        nazevKapitoly: z.string().trim().max(300),
      }),
    )
    .max(500),
  jmeno: z.string().trim().max(120).nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const projekt = await projektPodleTokenu(token);
  if (!projekt) return odpovedChyby('chybaApi.odkazNeplati', 404);
  if (!projekt.tracklist) return odpovedChyby('chybaApi.bezOpravneni', 403);

  return NextResponse.json({ tracky: await nactiTracklist(projekt.caflouProjectId) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const projekt = await projektPodleTokenu(token);
  if (!projekt) return odpovedChyby('chybaApi.odkazNeplati', 404);
  if (!projekt.tracklist) return odpovedChyby('chybaApi.bezOpravneni', 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);

  /**
   * Jméno chodí V ADRESE, ne v těle: tělo skládá sdílený editor tracklistu
   * a ten o jménu nic neví. V těle se bere taky, kdyby se jednou hodilo.
   */
  const jmeno =
    parsed.data.jmeno?.trim() || req.nextUrl.searchParams.get('jmeno')?.trim() || null;

  try {
    // Zvonek nám, až tracklist u projektu vznikne - viz lib/tracklistServer.ts.
    const tracky = await ulozTracklist(projekt.caflouProjectId, parsed.data.tracky, { jmeno });
    await oznacTracklist(token, jmeno);
    return NextResponse.json({ tracky });
  } catch (err) {
    console.error('Tracklist od klienta: ulozeni selhalo:', err);
    return odpovedChyby('chybaApi.ulohaNepodarila', 500);
  }
}
