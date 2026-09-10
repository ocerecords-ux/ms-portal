import { PRAZDNA_UCTENKA, type PrectenaUctenka } from '@/lib/uctenka';

/**
 * Přečtení vyfoceného dokladu (zadání 10. 9. 2026).
 *
 * JAK TO CHODÍ
 * Fotka se pošle modelu, který umí číst dokumenty, a ten vrátí částku, datum,
 * sazbu DPH, dodavatele a způsob úhrady. Údaje se ve formuláři jen předvyplní
 * - uložit je musí člověk. Účtenky z benzinky bývají zmuchlané a na termopapíru
 * vybledlé, takže špatně přečtená číslice není žádná vzácnost a v účetnictví
 * by napáchala víc škody než ruční přepsání.
 *
 * NASTAVENÍ
 * ANTHROPIC_API_KEY - klíč k API. Bez něj se čtení tiše vypne a formulář se
 * chová jako dřív: fotka se jen přiloží a údaje se vyplní ručně.
 * UCTENKA_MODEL - volitelně jiný model, když bude potřeba přepnout.
 *
 * CO SE NIKAM NEUKLÁDÁ
 * Fotka se posílá jen kvůli přečtení, nikam se nezapisuje a odpověď se
 * nezaznamenává do logu - na dokladech bývají čísla karet a jména.
 */

const MODEL = process.env.UCTENKA_MODEL || 'claude-sonnet-4-5';
const ADRESA = 'https://api.anthropic.com/v1/messages';

/** Je čtení dokladů vůbec nastavené? Používá i /api/health. */
export function jeCteniUctenekNastaveno(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const POKYN = `Jsi součástí účetního portálu. Z přiložené fotografie dokladu (účtenka, paragon, faktura)
vyčti údaje a vrať JEDINÝ objekt JSON, nic jiného - žádný doprovodný text, žádné značky pro kód.

Objekt má přesně tyto klíče:
{
  "dodavatel": string|null,      // kdo doklad vystavil, např. "ORLEN Praha 4"
  "popis": string|null,          // krátce co se kupovalo, např. "Nafta 42,3 l"
  "datum": string|null,          // YYYY-MM-DD
  "castkaSDph": string|null,     // celkem k úhradě, jen číslo s desetinnou čárkou
  "castkaBezDph": string|null,   // základ daně, pokud je uveden zvlášť
  "sazbaDph": number|null,       // 21, 12 nebo 0
  "mena": string|null,           // CZK, EUR, USD...
  "cislo": string|null,          // číslo dokladu
  "zpusobUhrady": "CARD"|"CASH"|"TRANSFER"|null,
  "jistota": number              // 0 až 1, jak dobře šel doklad přečíst
}

Pravidla:
- Co na dokladu nevidíš, dej null. Nic nedopočítávej ani nehádej.
- Doklady jsou české; desetinná čárka, mezery v tisících ignoruj ("1 234,50" -> "1234,50").
- "Platba kartou", "PLATEBNÍ KARTA", "VISA", "Maestro" -> CARD. "Hotovost", "HOTOVĚ" -> CASH.
  Bankovní spojení a variabilní symbol na faktuře -> TRANSFER.
- Když je fotka nečitelná, vrať samá null a jistota 0.`;

type Odpoved = { content?: { type: string; text?: string }[] };

/** Vytáhne JSON i z odpovědi, kolem které model něco připsal. */
function vyzobniJson(text: string): unknown {
  const zacatek = text.indexOf('{');
  const konec = text.lastIndexOf('}');
  if (zacatek < 0 || konec <= zacatek) return null;
  try {
    return JSON.parse(text.slice(zacatek, konec + 1));
  } catch {
    return null;
  }
}

function text(hodnota: unknown, maxDelka = 200): string | null {
  if (typeof hodnota !== 'string') return null;
  const o = hodnota.trim();
  return o && o.toLowerCase() !== 'null' ? o.slice(0, maxDelka) : null;
}

function cislo(hodnota: unknown): number | null {
  return typeof hodnota === 'number' && Number.isFinite(hodnota) ? hodnota : null;
}

/** Datum bereme jen ve tvaru YYYY-MM-DD a jen když opravdu existuje. */
function datum(hodnota: unknown): string | null {
  const t = text(hodnota, 10);
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : t;
}

function zpusob(hodnota: unknown): PrectenaUctenka['zpusobUhrady'] {
  const t = text(hodnota, 10);
  return t === 'CARD' || t === 'CASH' || t === 'TRANSFER' ? t : null;
}

/** Sazby držíme na tom, co portál nabízí - jiné číslo by šlo do prázdna. */
function sazba(hodnota: unknown): number | null {
  const c = cislo(hodnota);
  return c === 21 || c === 12 || c === 0 ? c : null;
}

function naTvar(data: unknown): PrectenaUctenka {
  if (!data || typeof data !== 'object') return PRAZDNA_UCTENKA;
  const d = data as Record<string, unknown>;
  return {
    dodavatel: text(d.dodavatel),
    popis: text(d.popis, 300),
    datum: datum(d.datum),
    castkaSDph: text(d.castkaSDph, 30),
    castkaBezDph: text(d.castkaBezDph, 30),
    sazbaDph: sazba(d.sazbaDph),
    mena: text(d.mena, 3)?.toUpperCase() ?? null,
    cislo: text(d.cislo, 60),
    zpusobUhrady: zpusob(d.zpusobUhrady),
    jistota: cislo(d.jistota),
  };
}

export type VysledekCteni =
  | { stav: 'ok'; uctenka: PrectenaUctenka }
  | { stav: 'vypnuto' }
  | { stav: 'chyba'; zprava: string };

/**
 * Přečte doklad z obrázku.
 *
 * Nikdy nevyhazuje - když čtení selže, formulář prostě zůstane prázdný
 * a člověk údaje opíše, jako to dělal dosud.
 */
export async function prectiUctenku(data: Buffer, typSouboru: string): Promise<VysledekCteni> {
  const klic = process.env.ANTHROPIC_API_KEY;
  if (!klic) return { stav: 'vypnuto' };

  try {
    const odpoved = await fetch(ADRESA, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': klic,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: typSouboru, data: data.toString('base64') },
              },
              { type: 'text', text: POKYN },
            ],
          },
        ],
      }),
    });

    if (!odpoved.ok) {
      // Schválně bez těla odpovědi - mohl by v něm být kus dokladu.
      console.error('Čtení dokladu selhalo, API odpovědělo:', odpoved.status);
      return { stav: 'chyba', zprava: 'Doklad se nepodařilo přečíst.' };
    }

    const telo = (await odpoved.json()) as Odpoved;
    const napsal = telo.content?.find((c) => c.type === 'text')?.text ?? '';
    return { stav: 'ok', uctenka: naTvar(vyzobniJson(napsal)) };
  } catch (err) {
    console.error('Čtení dokladu spadlo:', err instanceof Error ? err.message : 'neznámá chyba');
    return { stav: 'chyba', zprava: 'Doklad se nepodařilo přečíst.' };
  }
}
