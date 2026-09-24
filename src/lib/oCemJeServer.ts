import { anthropicHlavicky } from '@/lib/anthropic';

/**
 * O ČEM TA KNIHA JE (zadání 24. 9. 2026: „když se ta má událost v přehledu na
 * dnešek bude týkat první frekvence natáčení audioknihy, tak by mohl Bruno
 * projít text a dát mi alespoň základní info v pár větách, o čem ten příběh
 * je").
 *
 * Je to briefing před první frekvencí: člověk jde do studia režírovat knihu,
 * kterou nečetl, a chce vědět, co se v ní děje, kdo v ní vystupuje a jakým
 * tónem je psaná.
 *
 * TEXT SE ČTE V PROHLÍŽEČI, NE NA SERVERU. Režijní edit je PDF o stovkách
 * stran na Disku; portál umí PDF číst jen v prohlížeči (pdf.js z CDN, viz
 * lib/pdfJs.ts). Okno „Co mě dnes čeká" proto z PDF vytáhne ukázku a pošle
 * sem jen ji - server nepotřebuje žádnou knihovnu navíc a nikdo netahá
 * megabajty tam a zpátky.
 *
 * SHRNUTÍ SE UKLÁDÁ K PROJEKTU a počítá se jednou; podruhé ho dostane každý
 * z databáze. Znovu se dělá jen tehdy, když ve složce přibude jiný režijní
 * edit (hlídá se jméno souboru).
 *
 * NIC SI NEVYMÝŠLÍ. Model dostane jen ukázku z rukopisu a má výslovně
 * zakázáno doplňovat, co v ní není - u neznámé knihy je lepší kratší shrnutí
 * než vymyšlený děj.
 */

const ADRESA = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.BRUNO_MODEL || 'claude-sonnet-4-5';

/** Kolik znaků ukázky se posílá modelu. Víc už jen zdražuje, ne zpřesňuje. */
export const MAX_UKAZKY = 60_000;

export function jeOCemJeNastaveno(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function pokyn(nazevProjektu: string): string {
  return `Jsi Bruno, pomocník ve studiu, které natáčí audioknihy. Zvukař nebo režisér jde za chvíli natáčet první frekvenci knihy „${nazevProjektu}" a potřebuje vědět, do čeho jde.

Dostaneš UKÁZKU Z RUKOPISU (začátek knihy a pár kusů z dalších míst). Napiš z ní krátký briefing česky:

- **3 až 5 vět** o tom, o čem příběh je - prostředí, doba, hlavní postavy, co se v knize řeší.
- Pak jednu větu o **tónu a jazyku**: jestli je to vážné nebo humorné, psané v ich-formě nebo er-formě, jestli je v textu hodně dialogů, nářečí, cizích jmen nebo odborných termínů.
- Když jsou v ukázce **jména nebo slova, u kterých se dá čekat zaváhání ve výslovnosti** (cizí jména, místa, termíny), vypiš je nakonec za pomlčku, nejvýš šest, oddělené čárkou. Když tam nic takového není, tenhle řádek vynech.

PRAVIDLA
- Piš jen to, co je v ukázce. Nic nedoplňuj z toho, co o knize nebo autorovi možná víš - ukázka je jediný zdroj.
- Když z ukázky děj poznat nejde (je to jen tiráž, obsah nebo pár řádků), napiš jednou větou, že z rukopisu zatím nic vyčíst nejde, a nic si nevymýšlej.
- Nehodnoť, nedoporučuj a nespoiluj konec, i kdyby byl v ukázce.
- Žádný úvod typu „V této knize" ani nadpisy. Rovnou text, dohromady nejvýš 120 slov.`;
}

type Odpoved = { content?: { type: string; text?: string }[] };

/**
 * Napíše pár vět o knize z ukázky rukopisu.
 *
 * Nikdy nevyhazuje - když to nevyjde, vrátí null a okno prostě žádné shrnutí
 * neukáže. Briefing je pomoc navíc, ne podmínka natáčení.
 */
export async function napisOCemJe(
  nazevProjektu: string,
  ukazka: string,
): Promise<string | null> {
  const klic = process.env.ANTHROPIC_API_KEY;
  if (!klic) return null;

  const cistaUkazka = ukazka.replace(/\s+/g, ' ').trim().slice(0, MAX_UKAZKY);
  // Pod tisíc znaků to není rukopis, ale tiráž - škoda volání.
  if (cistaUkazka.length < 1000) return null;

  try {
    const odpoved = await fetch(ADRESA, {
      method: 'POST',
      headers: anthropicHlavicky(klic),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: pokyn(nazevProjektu),
        messages: [{ role: 'user', content: `UKÁZKA Z RUKOPISU:\n\n${cistaUkazka}` }],
      }),
    });

    if (!odpoved.ok) {
      console.error('O cem je: API odmitlo', odpoved.status, await odpoved.text().catch(() => ''));
      return null;
    }

    const data = (await odpoved.json()) as Odpoved;
    const text = (data.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')
      .trim();
    return text.length > 20 ? text.slice(0, 2000) : null;
  } catch (err) {
    console.error('O cem je: volani selhalo', err);
    return null;
  }
}
