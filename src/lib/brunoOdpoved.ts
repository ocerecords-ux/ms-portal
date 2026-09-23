import { anthropicHlavicky } from '@/lib/anthropic';
import { NASTROJE, spustNastroj, type KdoSePta } from '@/lib/brunoNastroje';
import { utcParts } from '@/lib/calendar';

/**
 * BRUNO, KTERÝ PŘEMÝŠLÍ (zadání 23. 9. 2026: „on by měl normálně mít mozek
 * a vnímat všechno, na co se ptám").
 *
 * Tohle je Brunova odpověď, když ho někdo osloví mimo kanál projektu -
 * v soukromé zprávě nebo ve skupině. Na rozdíl od hlídání stran (viz
 * brunoServer.ts) tu nevzniká žádné rozhodnutí k zapsání; Bruno si jen
 * sežene, co potřebuje, a odpoví.
 *
 * SMYČKA S NÁSTROJI. Model dostane otázku a seznam nástrojů (kalendář,
 * projekty, úkoly, návody). Když si o některý řekne, portál mu ho spustí
 * PRÁVY TOHO, KDO SE PTÁ, vrátí výsledek a model pokračuje. Kolo se opakuje
 * nejvýš KOL_MAX-krát, ať se nezacyklí a ať odpověď nepřijde za minutu.
 *
 * NIKDY NEVYHAZUJE. Když API mlčí nebo dojdou kola, vrátí se null a Bruno
 * prostě neodpoví - chat tím nesmí trpět.
 */

const MODEL = process.env.BRUNO_MODEL || 'claude-sonnet-4-5';
const ADRESA = 'https://api.anthropic.com/v1/messages';
const KOL_MAX = 5;
/** Kolik znaků smí mít odpověď - delší text chat stejně nepobere. */
const DELKA_MAX = 6000;
const PASMO = 'Europe/Prague';

type Blok =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

type Zprava = { role: 'user' | 'assistant'; content: string | Blok[] };

export type ZadaniOdpovedi = {
  kdo: KdoSePta;
  /** Jméno pisatele - ať ho Bruno osloví. */
  jmeno: string;
  /** „Jak to u nás chodí" z administrace. */
  prirucka: string;
  /** Mapa portálu a návody podle práv - viz lib/brunoNapoveda.ts. */
  napoveda: string;
  /** Poslední zprávy konverzace, nejstarší první. */
  zpravy: { kdo: string; text: string; jeBruno: boolean }[];
  /** Název skupiny, když to není konverzace mezi dvěma. */
  nazevKonverzace: string | null;
};

function pokyn(z: ZadaniOdpovedi): string {
  const d = utcParts(new Date(), PASMO);
  const dnes = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;

  return `Jsi Bruno, kolega z nahrávacího studia Mediaspace (audioknihy a reklamní spoty).
Bavíš se s člověkem v chatu portálu. Mluvíš česky, normálně, bez patosu a bez omluv.

JSI JAZYKOVÝ MODEL, NE FORMULÁŘ (upřesnění 23. 9. 2026: „chtěl bych si s Brunem povídat
jako s normálním jazykovým modelem"). Bav se o čemkoliv: napiš text nebo mail, přelož,
vymysli názvy, vysvětli, spočítej, oponuj, poraď - i o věcech, které s portálem nemají nic
společného. Studio je tvoje doma, ne tvoje hranice. Neodbíhej k „na tohle jsem tu nebyl
udělaný" a neposílej člověka jinam, když mu můžeš odpovědět rovnou.

DRŽÍŠ NIT. Čteš celou konverzaci, ne jen poslední větu: „a co zítra" navazuje na to, co
bylo předtím. Odpovídáš tak dlouze, jak věc potřebuje - na krátkou otázku krátce, na
rozepsání textu klidně na odstavce.

PÍŠE TI ${z.jmeno}${z.nazevKonverzace ? ` ve skupině „${z.nazevKonverzace}" (u každé repliky je napsané, kdo mluví)` : ' mezi čtyřma očima'}.

DNES JE ${dnes} (Praha). Z toho počítej „zítra", „v pátek" i „za týden".

PTÁŠ SE PORTÁLU SÁM. Máš nástroje na kalendář, projekty, úkoly a návody. Když odpověď
závisí na datech, vezmi si je nástrojem - nehádej a neodkazuj člověka jinam, když si to
můžeš zjistit. Nástroje běží s PRÁVY toho, kdo se ptá, takže co vrátí, smí vidět.

OSOBNÍ versus CELÝ PROVOZ. Nástroj program_dne je „co mám já", nástroj provoz_dne je
celý den ve všech studiích. Když se někdo ptá, co se natáčí, kdo kde je nebo jak vypadá
den ve studiích, ber provoz_dne - a klidně obojí. NIKDY neodpovídej „to nevidím", dokud
sis to nezkusil vytáhnout.

CO NEVÍŠ, ŘEKNI. U věcí z portálu si nevymýšlej termíny, jména ani odkazy - ty ber jen
ze zadání nebo z nástroje (třeba /projekty/123 nebo /napoveda/neco). Jinde platí, co u
každého rozumného kolegy: když si nejsi jistý, řekni to a odhad označ za odhad.

ODPOVÍDÁŠ TEXTEM, ne JSONem. Žádné uvozovky kolem celé odpovědi, žádné vysvětlování, co
sis kde zjistil - prostě odpověz, jako bys to věděl.

JAK TO U NÁS CHODÍ (napsali lidi z Mediaspace):
${z.prirucka}

${z.napoveda}`;
}

/**
 * Historie chatu jako OPRAVDOVÁ KONVERZACE (23. 9. 2026: „chtěl bych si
 * s Brunem povídat jako s normálním jazykovým modelem").
 *
 * Do teď šly všechny zprávy do jednoho bloku textu, na který se Bruno díval
 * jako na zadání k vyřízení. Teď jsou to střídavě repliky: co napsal on, je
 * jeho řeč, co napsali lidi, je řeč druhé strany. Odtud navazování - „a co
 * zítra" dává smysl jen tomu, kdo si pamatuje, o čem byla řeč.
 *
 * Ve skupině se před každou replikou píše, kdo mluví; v soukromé konverzaci
 * to je zbytečné, jsou tam dva.
 */
function konverzace(z: ZadaniOdpovedi): Zprava[] {
  const vysledek: Zprava[] = [];

  for (const m of z.zpravy) {
    const role = m.jeBruno ? 'assistant' : 'user';
    const text = m.jeBruno || !z.nazevKonverzace ? m.text : `${m.kdo}: ${m.text}`;
    const posledni = vysledek[vysledek.length - 1];
    // Dvě zprávy za sebou od téhož musí do jedné repliky - API střídání hlídá.
    if (posledni && posledni.role === role && typeof posledni.content === 'string') {
      posledni.content = `${posledni.content}\n${text}`;
    } else {
      vysledek.push({ role, content: text });
    }
  }

  // Konverzace musí začínat člověkem a končit jím taky - jinak by Bruno
  // odpovídal sám sobě.
  while (vysledek.length > 0 && vysledek[0].role === 'assistant') vysledek.shift();
  if (vysledek.length === 0 || vysledek[vysledek.length - 1].role !== 'user') {
    vysledek.push({ role: 'user', content: '(pokračuj)' });
  }
  return vysledek;
}

/** Brunova odpověď, nebo null, když nemá co říct (nebo se to nepovedlo). */
export async function brunoOdpoved(z: ZadaniOdpovedi): Promise<string | null> {
  const klic = process.env.ANTHROPIC_API_KEY;
  if (!klic) return null;

  const zpravy: Zprava[] = konverzace(z);

  for (let kolo = 0; kolo < KOL_MAX; kolo += 1) {
    const odpoved = await fetch(ADRESA, {
      method: 'POST',
      headers: anthropicHlavicky(klic),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: pokyn(z),
        tools: NASTROJE,
        messages: zpravy,
      }),
    }).catch((err) => {
      console.error('Bruno: API nedosažitelné:', err);
      return null;
    });

    if (!odpoved) return null;
    if (!odpoved.ok) {
      const proc = await odpoved.text().catch(() => '');
      console.error('Bruno: API odpovědělo', odpoved.status, proc.slice(0, 300));
      return null;
    }

    const telo = (await odpoved.json().catch(() => null)) as
      | { content?: Blok[]; stop_reason?: string }
      | null;
    const bloky = telo?.content ?? [];

    const nastroje = bloky.filter((b): b is Extract<Blok, { type: 'tool_use' }> => b.type === 'tool_use');

    if (nastroje.length === 0) {
      const text = bloky
        .filter((b): b is Extract<Blok, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text.trim())
        .join('\n')
        .trim();
      return text ? text.slice(0, DELKA_MAX) : null;
    }

    // Model si řekl o data. Spustíme, co chtěl, a pokračujeme dalším kolem.
    const vysledky: Blok[] = [];
    for (const n of nastroje) {
      const vysledek = await spustNastroj(n.name, n.input ?? {}, z.kdo);
      vysledky.push({ type: 'tool_result', tool_use_id: n.id, content: vysledek.slice(0, 6000) });
    }

    zpravy.push({ role: 'assistant', content: bloky });
    zpravy.push({ role: 'user', content: vysledky });
  }

  // Došla kola - radši nic než polovičatá odpověď.
  console.error('Bruno: nástroje se zacyklily, odpověď nevznikla');
  return null;
}
