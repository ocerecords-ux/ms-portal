import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
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
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Napište aspoň větu o tom, o čem příspěvek je.' }, { status: 400 });
  }

  const klic = process.env.ANTHROPIC_API_KEY;
  if (!klic) {
    return NextResponse.json({ error: 'Bruno není nastavený (chybí ANTHROPIC_API_KEY).' }, { status: 503 });
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
      return NextResponse.json({ error: 'Bruno teď neodpovídá, zkuste to za chvíli.' }, { status: 502 });
    }

    const telo = (await odpoved.json()) as { content?: { type: string; text?: string }[] };
    const napsal = telo.content?.find((c) => c.type === 'text')?.text ?? '';
    const zacatek = napsal.indexOf('{');
    const konec = napsal.lastIndexOf('}');
    if (zacatek < 0 || konec < zacatek) {
      return NextResponse.json({ error: 'Odpověď se nepodařilo přečíst.' }, { status: 502 });
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
    return NextResponse.json({ error: 'Popisek se nepodařilo vyrobit.' }, { status: 500 });
  }
}
