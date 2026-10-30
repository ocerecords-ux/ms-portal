import { anthropicHlavicky } from '@/lib/anthropic';
import { precislujTracky, upravNazevTracku } from '@/lib/tracklist';

/**
 * BRUNO U TRACKLISTU (zadání 30. 10. 2026: „u těch tracklistů by mohl být
 * Bruno, kterého bychom si vycvičili na to, když tam budeme chtít hromadnou
 * změnu nebo to udělat podle nějakého vzoru. Normálně chatovací okno").
 *
 * PROČ CHAT A NE DALŠÍ TLAČÍTKA. Hromadných úprav tracklistu je nekonečně
 * mnoho druhů - přečíslovat, přepsat podle vzoru, doplnit část knihy, uřezat
 * tečky, posunout kapitoly o jedna, přeložit názvy kapitol. Každá by chtěla
 * vlastní tlačítko a vlastní políčko; po deseti takových by obrazovka byla
 * nepoužitelná. Napsat větou, co se má stát, je rychlejší a nic se tím
 * nezamyká.
 *
 * BRUNO NEUKLÁDÁ, BRUNO NAVRHUJE (rozhodnutí 30. 10. 2026). Vrátí CELÝ nový
 * seznam, ten spadne do tabulky a uloží ho až člověk tlačítkem Uložit -
 * stejně jako u generování z textu. Hromadná změna se dá splést jedním
 * slovem a přepsaná hotová práce se nedá vrátit; proto je mezi Brunem
 * a databází pořád jeden lidský krok.
 *
 * ŽÁDNÉ NÁSTROJE. Na rozdíl od Bruna v chatu (lib/brunoNastroje.ts) se tenhle
 * nikam nedívá: celý tracklist dostane v zadání a celý ho vrátí. Nemá se tedy
 * kam doptat a nemůže sáhnout na nic jiného než na ten seznam.
 *
 * Nevyhazuje: když API mlčí nebo odpoví nesmysl, vrátí se hláška a tabulka
 * zůstane, jak byla.
 */

export type RadekTracklistu = { nazevTracku: string; nazevKapitoly: string };

export type ZadaniBruna = {
  /** Jméno toho, kdo píše - ať ho Bruno osloví. */
  jmeno: string;
  nazevProjektu: string;
  /** „Jak to u nás chodí" z administrace - ať Bruno zná naše pojmy. */
  prirucka: string;
  /** Tracklist, jak je teď v tabulce (ještě neuložený stav). */
  tracky: RadekTracklistu[];
  /** Celá konverzace v tomhle okně, nejstarší první. */
  zpravy: { odBruna: boolean; text: string }[];
  /** Firma má model, který v názvech nechává mezery (Audiotéka). */
  sMezerami: boolean;
};

export type OdpovedBruna = {
  text: string;
  /** Nový seznam, když ho Bruno přepsal; null = jen odpověděl. */
  tracky: RadekTracklistu[] | null;
};

const MODEL = process.env.BRUNO_MODEL || 'claude-sonnet-4-5';
const ADRESA = 'https://api.anthropic.com/v1/messages';
/** Delší odpověď než tohle se do okna u tabulky stejně nevejde. */
const DELKA_MAX = 2000;
/** Stejný strop jako má ukládání tracklistu - viz api/projekty/[id]/tracklist. */
const RADKU_MAX = 500;

export function jeBrunoNastaveny(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function pokyn(z: ZadaniBruna): string {
  const pravidla = z.sMezerami
    ? 'Tahle firma má vlastní model: v názvu tracku MEZERY ZŮSTÁVAJÍ (např. „02_1938 - KAPITOLA 1.").'
    : 'Název tracku nemá mezery - místo nich jsou pomlčky (např. „01_KUCHARI-SMRTI").';

  return `Jsi Bruno, kolega z nahrávacího studia Mediaspace. Pomáháš s TRACKLISTEM audioknihy
„${z.nazevProjektu}" v portálu. Píše ti ${z.jmeno}. Mluvíš česky, stručně, bez omluv.

CO JE TRACKLIST: předpis, podle kterého se teprve pojmenují hotové stopy. Má dva sloupce:
- NÁZEV TRACKU - z něj se stává název souboru. Začíná dvojmístným pořadovým číslem
  a podtržítkem (01_, 02_, …), je BEZ DIAKRITIKY. ${pravidla}
- NÁZEV KAPITOLY - text pro člověka, jde do tagu. Diakritiku i mezery mít má.

CO UMÍŠ: hromadné úpravy celého seznamu - přepsat podle vzoru, přečíslovat, doplnit nebo
uklidit názvy kapitol, něco přidat, odebrat, prohodit, přeložit. Když si nejsi jistý, co
přesně se má stát, NEHÁDEJ a zeptej se.

JAK ODPOVÍDÁŠ: vždycky jedním JSON objektem a ničím jiným, bez uvozovek kolem, bez
vysvětlování okolo:
{"odpoved": "jedna dvě věty, co jsi udělal nebo na co se ptáš",
 "tracky": [{"nazevTracku": "01_…", "nazevKapitoly": "…"}] }
„tracky" vynech (nebo dej null), když jsi nic neměnil - třeba když se jen ptáš nebo
odpovídáš na dotaz. Když měníš, vrať VŽDYCKY CELÝ seznam od prvního po poslední track,
i řádky, kterých ses nedotkl. Nikdy nevracej jen ty změněné.

Neukládáš. Co vrátíš, se ukáže v tabulce a uloží to až člověk - tak to napiš i v odpovědi,
když se hodí.

JAK TO U NÁS CHODÍ:
${z.prirucka}`;
}

/** Tracklist do zadání - očíslovaný, ať se Bruno má čeho chytit. */
function seznamDoTextu(tracky: RadekTracklistu[]): string {
  if (tracky.length === 0) return '(tracklist je zatím prázdný)';
  return tracky
    .map((t, i) => `${i + 1}. ${t.nazevTracku || '(bez názvu)'} | ${t.nazevKapitoly || ''}`)
    .join('\n');
}

/**
 * Vytáhne JSON z odpovědi. Model ho občas zabalí do ``` nebo kolem něj něco
 * napíše; bereme proto první složenou závorku a poslední uzavírací.
 */
function vytahniJson(text: string): { odpoved?: unknown; tracky?: unknown } | null {
  const zac = text.indexOf('{');
  const kon = text.lastIndexOf('}');
  if (zac < 0 || kon <= zac) return null;
  try {
    const x: unknown = JSON.parse(text.slice(zac, kon + 1));
    return x && typeof x === 'object' ? (x as { odpoved?: unknown; tracky?: unknown }) : null;
  } catch {
    return null;
  }
}

/** Co přišlo z modelu, se nebere, jak je - tvar názvu hlídáme my. */
function srovnejTracky(co: unknown, sMezerami: boolean): RadekTracklistu[] | null {
  if (!Array.isArray(co)) return null;
  const radky = co
    .slice(0, RADKU_MAX)
    .map((r) => {
      const x = (r ?? {}) as { nazevTracku?: unknown; nazevKapitoly?: unknown };
      return {
        nazevTracku: upravNazevTracku(String(x.nazevTracku ?? '').slice(0, 300), sMezerami),
        nazevKapitoly: String(x.nazevKapitoly ?? '')
          .slice(0, 300)
          .trim(),
      };
    })
    .filter((r) => r.nazevTracku || r.nazevKapitoly);
  return precislujTracky(radky);
}

export async function brunoUpravTracklist(z: ZadaniBruna): Promise<OdpovedBruna> {
  const klic = process.env.ANTHROPIC_API_KEY;
  if (!klic) return { text: 'Bruno teď není k dispozici.', tracky: null };

  // Konverzace musí střídat role a začínat člověkem - stejně jako v chatu.
  const zpravy: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of z.zpravy) {
    const role = m.odBruna ? 'assistant' : 'user';
    const posledni = zpravy[zpravy.length - 1];
    if (posledni && posledni.role === role) posledni.content += `\n${m.text}`;
    else zpravy.push({ role, content: m.text });
  }
  while (zpravy.length > 0 && zpravy[0].role === 'assistant') zpravy.shift();
  if (zpravy.length === 0 || zpravy[zpravy.length - 1].role !== 'user') {
    return { text: 'Nevím, co mám udělat - napiš mi to.', tracky: null };
  }

  // Tracklist jde do POSLEDNÍ zprávy, ne do zadání: je to stav, který se mezi
  // replikami mění, a Bruno musí pracovat s tím, co je v tabulce teď.
  zpravy[zpravy.length - 1].content +=
    `\n\n--- TRACKLIST, JAK JE TEĎ V TABULCE (${z.tracky.length}) ---\n${seznamDoTextu(z.tracky)}`;

  const odpoved = await fetch(ADRESA, {
    method: 'POST',
    headers: anthropicHlavicky(klic),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: pokyn(z),
      messages: zpravy,
    }),
  }).catch((err) => {
    console.error('Bruno u tracklistu: API nedosažitelné:', err);
    return null;
  });

  if (!odpoved) return { text: 'Nepovedlo se mi to spočítat, zkus to znovu.', tracky: null };
  if (!odpoved.ok) {
    const proc = await odpoved.text().catch(() => '');
    console.error('Bruno u tracklistu: API odpovědělo', odpoved.status, proc.slice(0, 300));
    return { text: 'Nepovedlo se mi to spočítat, zkus to znovu.', tracky: null };
  }

  const telo = (await odpoved.json().catch(() => null)) as { content?: { type: string; text?: string }[] } | null;
  const text = (telo?.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => (b.text ?? '').trim())
    .join('\n')
    .trim();
  if (!text) return { text: 'Nevím, co na to říct.', tracky: null };

  const json = vytahniJson(text);
  // Když se JSON nepovede přečíst, bereme celou odpověď jako řeč - lepší než
  // tvrdit, že se nic nestalo. Tabulka v tom případě zůstane, jak byla.
  if (!json) return { text: text.slice(0, DELKA_MAX), tracky: null };

  return {
    text: String(json.odpoved ?? '').trim().slice(0, DELKA_MAX) || 'Hotovo.',
    tracky: srovnejTracky(json.tracky, z.sMezerami),
  };
}
