import { anthropicHlavicky } from '@/lib/anthropic';
import type { UdajeOsoby } from '@/lib/wikipedieUdaje';

/**
 * CHAT NAD ČLÁNKEM (zadání 22. 9. 2026: „vytvořil bych tam nějaký chat, se
 * kterým budu vzpomínat na minulost a věci, které by tam na wiki mohly být,
 * a on to bude formulovat a vkládat").
 *
 * Povídá si s vámi o tom, co jste zažil, ptá se na chybějící podrobnosti
 * a hlavně na ZDROJE - bez nich Wikipedie tvrzení nepustí. Když je látky
 * dost, napíše hotový kus wikitextu; vložit ho do konceptu je pak na jedno
 * kliknutí a rozhoduje o tom člověk, portál nic nevkládá sám.
 *
 * Používá stejný klíč jako Bruno (ANTHROPIC_API_KEY).
 */

const ADRESA = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.WIKI_CHAT_MODEL || 'claude-sonnet-4-5';

export type ZpravaChatu = { role: 'ja' | 'bot'; text: string };

export function jeChatNastaveny(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function pokyn(jmeno: string, udaje: UdajeOsoby | null, wikitext: string): string {
  const znameUdaje = udaje
    ? [
        udaje.cimJe && `čím je: ${udaje.cimJe}`,
        udaje.datumNarozeni && `narozen: ${udaje.datumNarozeni}`,
        udaje.mistoNarozeni && `místo narození: ${udaje.mistoNarozeni}`,
        udaje.povolani && `povolání: ${udaje.povolani}`,
        udaje.milniky.length ? `milníky: ${udaje.milniky.map((m) => `${m.rok} ${m.text}`).join('; ')}` : '',
        udaje.dila.length ? `tvorba: ${udaje.dila.map((d) => `${d.nazev} (${d.rok})`).join('; ')}` : '',
        udaje.zdroje.length ? `zdroje: ${udaje.zdroje.map((z) => `${z.klic} = ${z.titul}`).join('; ')}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '(zatím nic)';

  return `Pomáháš člověku jménem ${jmeno} sepsat o sobě článek na českou Wikipedii. Mluví s tebou česky a vzpomíná na svou minulost; tvoje práce je z toho vytáhnout to, co na Wikipedii patří, a napsat to jejím jazykem.

JAK MLUVIT
- Česky, krátce, věcně. Ptej se po jedné věci - co přesně, kdy, s kým, jak to skončilo.
- Nejdůležitější otázka je VŽDY na zdroj: kde to vyšlo, kdo o tom psal, kde se to dá ověřit. Bez nezávislého zdroje se tvrzení do článku nedostane; řekni to rovnou a nabídni, že to zatím necháte stranou.
- Nic si nevymýšlej a nedomýšlej. Co ti neřekl, do textu nepatří. Nikdy nevymýšlej citace ani odkazy.
- Hlídej encyklopedický tón: žádná chvála, žádná reklama, žádné „úspěšný" a „oblíbený". Fakta, roky, čísla.
- Připomeň, že článek o sobě je střet zájmů a text posoudí ostatní wikipedisté.

KDYŽ JE LÁTKY DOST
Napiš hotový kus wikitextu a dej ho do bloku:
\`\`\`wikitext
== Nadpis ==
Text s referencemi ve tvaru <ref name="klic">…</ref>.
\`\`\`
Používej jen zdroje, které zmínil; klíč reference volíš podle zdroje. Piš rovnou tak, jak to má v článku stát - žádné komentáře uvnitř bloku. Mimo blok krátce řekni, co jsi napsal a co ještě chybí.

CO UŽ O NĚM VÍŠ (z formuláře Údaje)
${znameUdaje}

SOUČASNÝ KONCEPT ČLÁNKU (může být prázdný)
${wikitext.slice(0, 6000) || '(prázdný)'}`;
}

export async function odpovezVeChatu(vstup: {
  jmeno: string;
  udaje: UdajeOsoby | null;
  wikitext: string;
  historie: ZpravaChatu[];
  zprava: string;
}): Promise<{ ok: true; text: string } | { ok: false; chyba: string }> {
  const klic = process.env.ANTHROPIC_API_KEY;
  if (!klic) return { ok: false, chyba: 'Na Vercelu chybí ANTHROPIC_API_KEY.' };

  const zpravy = [...vstup.historie.slice(-20), { role: 'ja' as const, text: vstup.zprava }].map((z) => ({
    role: z.role === 'ja' ? ('user' as const) : ('assistant' as const),
    content: z.text,
  }));

  try {
    const odpoved = await fetch(ADRESA, {
      method: 'POST',
      headers: anthropicHlavicky(klic),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: pokyn(vstup.jmeno, vstup.udaje, vstup.wikitext),
        messages: zpravy,
      }),
      cache: 'no-store',
    });
    if (!odpoved.ok) {
      const proc = await odpoved.text().catch(() => '');
      console.error('[wikipedie-chat] API', odpoved.status, proc.slice(0, 300));
      return { ok: false, chyba: `Model neodpověděl (${odpoved.status}).` };
    }
    const telo = (await odpoved.json()) as { content?: { type: string; text?: string }[] };
    const text = telo.content?.find((c) => c.type === 'text')?.text?.trim() ?? '';
    if (!text) return { ok: false, chyba: 'Model vrátil prázdnou odpověď.' };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, chyba: (err as Error).message || 'Model se nepodařilo zavolat.' };
  }
}

/** Vytáhne z odpovědi návrh wikitextu (blok ```wikitext … ```). */
export function navrhZOdpovedi(text: string): string | null {
  const m = text.match(/```(?:wikitext|wiki)?\s*\n([\s\S]*?)```/);
  return m ? m[1].trim() : null;
}
