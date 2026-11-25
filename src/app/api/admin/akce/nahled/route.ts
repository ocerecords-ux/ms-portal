import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { smiSpravovatAkce } from '@/lib/akceServer';
import { buildPozvankaAkceHtml } from '@/lib/email';
import { odpovedChyby } from '@/lib/chybyApi';

/**
 * NÁHLED POZVÁNKY (zadání 25. 11. 2026: „chci vidět rovnou grafický náhled
 * toho mailu").
 *
 * Skládá ho TATÁŽ funkce, která mail opravdu posílá (`buildPozvankaAkceHtml`).
 * Kdyby si náhled kreslil vlastní cestou, dřív nebo později by ukazoval něco
 * jiného, než co doopravdy odejde - stejné pravidlo jako u Rodného listu.
 *
 * Nic se neukládá a nikomu nic neodchází; proto se ptá na rozepsané hodnoty
 * z formuláře, ne na to, co je v databázi.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().max(200).optional(),
  kdy: z.string().trim().max(40).nullable().optional(),
  misto: z.string().trim().max(300).nullable().optional(),
  text: z.string().trim().max(8000).nullable().optional(),
  odpovedDo: z.string().trim().max(40).nullable().optional(),
  /** Komu je náhled adresovaný - jen do oslovení. */
  jmeno: z.string().trim().max(200).nullable().optional(),
});

function naDatum(hodnota: string | null | undefined): Date | null {
  if (!hodnota) return null;
  const d = new Date(hodnota.length <= 10 ? `${hodnota}T00:00:00` : hodnota);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !(await smiSpravovatAkce(session.user.id))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);
  const d = parsed.data;

  const html = buildPozvankaAkceHtml({
    to: '',
    jmenoPrijemce: d.jmeno || session.user.name || null,
    nazevAkce: d.nazev?.trim() || 'Název akce',
    kdy: naDatum(d.kdy),
    misto: d.misto || null,
    text: d.text || null,
    odpovedDo: naDatum(d.odpovedDo),
    // V náhledu tlačítko nikam nevede - ať se z něj nedá omylem odpovídat
    // za někoho jiného.
    odkaz: '#',
  });

  return NextResponse.json({ html });
}
