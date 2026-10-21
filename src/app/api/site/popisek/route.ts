import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { odpovedChyby } from '@/lib/chybyApi';
import { authOptions } from '@/lib/auth';
import { anthropicHlavicky } from '@/lib/anthropic';
import { smiSite } from '@/lib/socialniServer';

/**
 * POPISEK OD BRUNA (zadání 27. 9. 2026: „napíšu, o čem příspěvek je, a portál
 * nabídne popisek a hashtagy — dopíšu si to po svém").
 *
 * Návrh, ne hotová věc: vrací se do políčka, kde se dá přepsat. Nic se
 * neukládá samo a nikam se neodesílá.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADRESA = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.BRUNO_MODEL || 'claude-sonnet-4-5';

const schema = z.object({
  sit: z.enum(['INSTAGRAM', 'LINKEDIN']),
  oCem: z.string().trim().min(3).max(2000),
  /** Co je na obrázku - texty z plátna, ať popisek nevaří z vody. */
  textyNaPlatne: z.string().max(2000).optional(),
});

const POKYN = `Píšeš příspěvky na sociální sítě pro české nahrávací studio MEDIA SPACE (Mediaspace).
Studio dělá dabing, audioknihy, rozhlasové a online reklamní spoty, voiceovery a zvukovou postprodukci. Sídlí v Brně, má vlastní studia a stálý okruh herců.

Jak psát:
- Česky, lidsky, bez korporátních frází a bez superlativů. Žádné „jsme hrdí, že…" a „posouváme hranice".
- Krátké věty. Jedna myšlenka na jeden příspěvek.
- Nepoužívej emoji, pokud si je autor sám nevyžádá.
- Nevymýšlej si fakta, jména ani čísla, která nedostaneš. Když něco chybí, napiš to obecněji.
- Instagram: kratší, osobnější, klidně první osoba. 2-5 vět.
- LinkedIn: věcnější, může být delší (4-8 vět), ale pořád bez frází. Hashtagy střídmě.

Odpovídej VÝHRADNĚ JSONem ve tvaru:
{"popisek": "text příspěvku", "hashtagy": "#jeden #druhy #treti"}
Hashtagů dej na Instagram 5-10, na LinkedIn 3-5, všechny malými písmeny a bez diakritiky.`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(await smiSite(session.user.id))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return odpovedChyby('chybaApi.popisekBezVety', 400);
  }

  const klic = process.env.ANTHROPIC_API_KEY;
  if (!klic) {
    return odpovedChyby('chybaApi.brunoNeniNastaveny', 503);
  }

  const { sit, oCem, textyNaPlatne } = parsed.data;
  const dotaz = [
    `SÍŤ: ${sit === 'INSTAGRAM' ? 'Instagram' : 'LinkedIn'}`,
    `O ČEM PŘÍSPĚVEK JE:\n${oCem}`,
    textyNaPlatne?.trim() ? `TEXTY NA OBRÁZKU:\n${textyNaPlatne.trim()}` : '',
    'Napiš popisek a hashtagy.',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const odpoved = await fetch(ADRESA, {
      method: 'POST',
      headers: anthropicHlavicky(klic),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        system: POKYN,
        messages: [{ role: 'user', content: dotaz }],
      }),
    });

    if (!odpoved.ok) {
      const proc = await odpoved.text().catch(() => '');
      console.error('Sítě: popisek od Bruna selhal', odpoved.status, proc.slice(0, 300));
      return odpovedChyby('chybaApi.brunoNeodpovida', 502);
    }

    const telo = (await odpoved.json()) as { content?: { type: string; text?: string }[] };
    const napsal = telo.content?.find((c) => c.type === 'text')?.text ?? '';
    const zacatek = napsal.indexOf('{');
    const konec = napsal.lastIndexOf('}');
    if (zacatek < 0 || konec < zacatek) {
      return odpovedChyby('chybaApi.odpovedNeprectena', 502);
    }
    const json = JSON.parse(napsal.slice(zacatek, konec + 1)) as {
      popisek?: string;
      hashtagy?: string;
    };
    return NextResponse.json({
      popisek: String(json.popisek ?? '').trim(),
      hashtagy: String(json.hashtagy ?? '').trim(),
    });
  } catch (err) {
    console.error('Sítě: popisek od Bruna selhal:', err);
    return odpovedChyby('chybaApi.popisekNevyroben', 500);
  }
}
