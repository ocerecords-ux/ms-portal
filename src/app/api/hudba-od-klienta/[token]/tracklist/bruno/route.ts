import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { brunoUpravTracklist, jeBrunoNastaveny } from '@/lib/brunoTracklist';
import { odpovedChyby } from '@/lib/chybyApi';
import { generovaniZTextuPovoleno } from '@/lib/tracklistServer';
import { projektPodleTokenu } from '@/lib/vyzvaHudbaServer';

/**
 * BRUNO U TRACKLISTU PRO KLIENTA (zadání 19. 11. 2026).
 *
 * Totéž okno, jaké máme my na kartě projektu, jen bez přihlašování - klient
 * sem přišel odkazem z výzvy. Token vede na jeden jediný projekt a nic jiného
 * se přes něj dělat nedá.
 *
 * NAŠE PŘÍRUČKA „jak to u nás chodí" se do zadání NEPOSÍLÁ: jsou to interní
 * poznámky pro tým, ne něco, co má zaznívat ven.
 *
 * Bruno neukládá, jen vrací návrh - uložení je o patro výš (PUT tracklistu).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  zprava: z.string().trim().min(1).max(2000),
  tracky: z
    .array(
      z.object({
        nazevTracku: z.string().max(300),
        nazevKapitoly: z.string().max(300),
      }),
    )
    .max(500),
  historie: z
    .array(z.object({ odBruna: z.boolean(), text: z.string().max(4000) }))
    .max(40)
    .default([]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const projekt = await projektPodleTokenu(token);
  if (!projekt) return odpovedChyby('chybaApi.odkazNeplati', 404);
  if (!projekt.tracklist) return odpovedChyby('chybaApi.bezOpravneni', 403);
  if (!jeBrunoNastaveny()) {
    return NextResponse.json({ error: 'Bruno teď není k dispozici.' }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);

  const odpoved = await brunoUpravTracklist({
    jmeno: 'kolega',
    nazevProjektu: projekt.nazevProjektu,
    prirucka: '',
    tracky: parsed.data.tracky,
    zpravy: [...parsed.data.historie, { odBruna: false, text: parsed.data.zprava }],
    sMezerami: await generovaniZTextuPovoleno(projekt.caflouProjectId),
  });

  return NextResponse.json(odpoved);
}
