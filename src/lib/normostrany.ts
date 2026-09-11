/**
 * Počet normostran z přiloženého textu (zadání 12. 9. 2026: „rád bych měl
 * v objednávce audioknihy takový nástroj, že když tam načteš přílohu
 * s textem, tak ti to rovnou přepočítá normostrany").
 *
 * VŠECHNO SE POČÍTÁ V PROHLÍŽEČI. Rukopis se nikam neposílá, počítání je
 * okamžité a server se nemusí prát s formáty. Objednávka pak odešle přílohu
 * tak jako dosud — tohle je jen kalkulačka nad souborem, který už klient
 * vybral.
 *
 * NORMOSTRANA = 1 800 znaků včetně mezer (česká norma). Znaky se počítají
 * po sražení bílých míst: víc mezer, konec řádku i odstavec platí za jednu
 * mezeru, jak to dělá i Word ve „Znaky (včetně mezer)". Na rukopisu se to od
 * Wordu liší o zlomek procenta a hlavně to nezávisí na tom, jestli je text
 * zalomený na šířku stránky.
 */

import { nactiPdfJs, nastavPdfWorker } from '@/lib/pdfJs';

export const ZNAKU_NA_NORMOSTRANU = 1800;

export type RozborTextu = {
  /** Znaky včetně mezer - to, z čeho se normostrany počítají. */
  znaku: number;
  znakuBezMezer: number;
  slov: number;
  /** Desetinné - na doplnění do objednávky se zaokrouhluje. */
  normostran: number;
  /** Čím se soubor přečetl, ať je v hlášce vidět, že to nebyl odhad. */
  zdroj: string;
  /** Jen u PDF - kolik stránek se přečetlo. */
  stran?: number;
};

/** Přípony, u kterých má smysl nabízet počítání. */
const PODPOROVANE = ['txt', 'md', 'rtf', 'docx', 'odt', 'epub', 'pdf', 'fdx', 'htm', 'html'];

export function priponaSouboru(nazev: string): string {
  const tecka = nazev.lastIndexOf('.');
  return tecka > 0 ? nazev.slice(tecka + 1).toLowerCase() : '';
}

export function umimeSpocitat(nazev: string): boolean {
  return PODPOROVANE.includes(priponaSouboru(nazev));
}

// --- Pomocníci nad textem ---------------------------------------------------

function dekodujEntity(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Ze značkovaného dokumentu (XML/HTML) vytáhne holý text. */
function textZeZnacek(xml: string, konceOdstavcu: RegExp): string {
  return dekodujEntity(
    xml
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(konceOdstavcu, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

export function rozeberText(text: string, zdroj: string, stran?: number): RozborTextu {
  // Nedělitelná mezera i měkký spojovník se chovají jako obyčejný znak,
  // ostatní bílá místa se srazí na jednu mezeru.
  const cisty = text.replace(/­/g, '').replace(/\s+/g, ' ').trim();
  const znaku = cisty.length;
  return {
    znaku,
    znakuBezMezer: cisty.replace(/ /g, '').length,
    slov: cisty ? cisty.split(' ').length : 0,
    normostran: znaku / ZNAKU_NA_NORMOSTRANU,
    zdroj,
    stran,
  };
}

// --- ZIP (docx, odt, epub) --------------------------------------------------

/**
 * Minimální čtečka ZIPu. `docx`, `odt` i `epub` jsou obyčejné archivy a
 * rozbalit je umí sám prohlížeč (`DecompressionStream`), takže kvůli tomu
 * netahám do portálu žádnou knihovnu.
 */
async function zipSoubory(data: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);
  const soubory = new Map<string, Uint8Array>();

  // Konec centrálního adresáře se hledá odzadu - za ním může být komentář.
  let konec = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65535; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      konec = i;
      break;
    }
  }
  if (konec < 0) throw new Error('Soubor nevypadá jako platný archiv.');

  const pocet = view.getUint16(konec + 10, true);
  let at = view.getUint32(konec + 16, true);
  const dekoder = new TextDecoder('utf-8');

  for (let i = 0; i < pocet; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) break;
    const metoda = view.getUint16(at + 10, true);
    const compSize = view.getUint32(at + 20, true);
    const delkaNazvu = view.getUint16(at + 28, true);
    const delkaExtra = view.getUint16(at + 30, true);
    const delkaKomentare = view.getUint16(at + 32, true);
    const kdeLokalne = view.getUint32(at + 42, true);
    const nazev = dekoder.decode(bytes.subarray(at + 46, at + 46 + delkaNazvu));
    at += 46 + delkaNazvu + delkaExtra + delkaKomentare;

    if (nazev.endsWith('/')) continue;
    if (view.getUint32(kdeLokalne, true) !== 0x04034b50) continue;
    const zacatek =
      kdeLokalne + 30 + view.getUint16(kdeLokalne + 26, true) + view.getUint16(kdeLokalne + 28, true);
    const syrova = bytes.subarray(zacatek, zacatek + compSize);

    if (metoda === 0) {
      soubory.set(nazev, syrova);
    } else if (metoda === 8) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('Tenhle prohlížeč neumí rozbalit archiv. Zkuste soubor uložit jako PDF nebo TXT.');
      }
      const proud = new Blob([syrova]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      soubory.set(nazev, new Uint8Array(await new Response(proud).arrayBuffer()));
    }
    // Jiné metody (šifrovaný nebo exotický archiv) se prostě přeskočí.
  }

  return soubory;
}

function jakoText(data: Uint8Array | undefined): string {
  return data ? new TextDecoder('utf-8').decode(data) : '';
}

// --- Jednotlivé formáty -----------------------------------------------------

async function zDocx(file: File): Promise<RozborTextu> {
  const soubory = await zipSoubory(await file.arrayBuffer());
  const hlavni = soubory.get('word/document.xml');
  if (!hlavni) throw new Error('V dokumentu se nenašel text (není to náhodou starý .doc?).');
  // Konec odstavce a zalomení řádku musí zůstat oddělovačem, jinak by se
  // slova na jejich hranici slepila do jednoho.
  const text = textZeZnacek(jakoText(hlavni), /<\/w:p>|<w:br\b[^>]*\/?>|<w:tab\b[^>]*\/?>/g);
  return rozeberText(text, 'Word (.docx)');
}

async function zOdt(file: File): Promise<RozborTextu> {
  const soubory = await zipSoubory(await file.arrayBuffer());
  const hlavni = soubory.get('content.xml');
  if (!hlavni) throw new Error('V dokumentu se nenašel text.');
  const text = textZeZnacek(jakoText(hlavni), /<\/text:p>|<\/text:h>|<text:line-break\b[^>]*\/?>/g);
  return rozeberText(text, 'OpenDocument (.odt)');
}

async function zEpub(file: File): Promise<RozborTextu> {
  const soubory = await zipSoubory(await file.arrayBuffer());
  const kapitoly = [...soubory.keys()]
    .filter((n) => /\.(x?html?)$/i.test(n))
    .sort((a, b) => a.localeCompare(b, 'cs'));
  if (kapitoly.length === 0) throw new Error('V e-knize se nenašel text.');
  const text = kapitoly
    .map((n) => textZeZnacek(jakoText(soubory.get(n)), /<\/(p|div|h[1-6]|li|tr)>|<br\b[^>]*\/?>/gi))
    .join('\n');
  return rozeberText(text, 'E-kniha (.epub)');
}

async function zPdf(file: File): Promise<RozborTextu> {
  // Soubor se predava JAKO ADRESA (blob:), ne jako pole bajtu - presne tak,
  // jak to dela prehravac v AudioTaggeru, ktery uz je dlouho v provozu.
  // Varianta s `data` se v nekterych prohlizecich chovala jinak.
  const adresa = URL.createObjectURL(file);
  try {
    const pdfjs = await nactiPdfJs();
    await nastavPdfWorker(pdfjs);
    const doc = await pdfjs.getDocument({ url: adresa }).promise;

    const casti: string[] = [];
    for (let strana = 1; strana <= doc.numPages; strana++) {
      const obsah = await (await doc.getPage(strana)).getTextContent();
      const polozky: { str?: string; hasEOL?: boolean }[] = obsah?.items ?? [];
      casti.push(
        polozky
          .map((polozka) => (polozka.str === undefined ? '' : polozka.str + (polozka.hasEOL ? '\n' : '')))
          .join(''),
      );
    }
    const text = casti.join('\n');
    if (!text.replace(/\s/g, '')) {
      throw new Error('PDF neobsahuje text, nejspíš je to sken. Pošlete prosím Word nebo TXT.');
    }
    return rozeberText(text, 'PDF', doc.numPages);
  } finally {
    URL.revokeObjectURL(adresa);
  }
}

async function zRtf(file: File): Promise<RozborTextu> {
  // RTF je text prošpikovaný řídicími slovy - stačí je vyházet.
  const syrove = await file.text();
  const text = syrove
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\s?\??/g, (_, d) => String.fromCharCode(((Number(d) % 65536) + 65536) % 65536))
    .replace(/\{\\\*[\s\S]*?\}/g, ' ')
    .replace(/\\par[d]?\b/g, '\n')
    .replace(/\\[a-z]+-?\d*\s?/gi, '')
    .replace(/[{}]/g, '');
  return rozeberText(text, 'RTF');
}

/**
 * Spočítá normostrany z vybraného souboru. Vyhazuje srozumitelnou hlášku —
 * v objednávce se ukáže rovnou klientovi.
 */
export async function spoctiNormostrany(file: File): Promise<RozborTextu> {
  const pripona = priponaSouboru(file.name);

  // Skutecnou chybu chceme videt v konzoli - v okne objednavky se ukazuje
  // jen srozumitelna veta a z te se nic nevypatra.
  if (!PODPOROVANE.includes(pripona) && pripona !== 'doc') {
    console.warn('Normostrany: neznama pripona', pripona);
  }

  if (pripona === 'doc') {
    throw new Error('Starý formát .doc přečíst neumím. Uložte prosím jako .docx nebo PDF.');
  }
  if (!PODPOROVANE.includes(pripona)) {
    throw new Error('Z tohohle souboru text vyčíst neumím. Pošlete Word, PDF nebo TXT.');
  }

  switch (pripona) {
    case 'docx':
      return zDocx(file);
    case 'odt':
      return zOdt(file);
    case 'epub':
      return zEpub(file);
    case 'pdf':
      return zPdf(file);
    case 'rtf':
      return zRtf(file);
    case 'htm':
    case 'html':
      return rozeberText(
        textZeZnacek(await file.text(), /<\/(p|div|h[1-6]|li|tr)>|<br\b[^>]*\/?>/gi),
        'HTML',
      );
    case 'fdx':
      // Final Draft - scénář v XML; text je v <Text>…</Text>.
      return rozeberText(textZeZnacek(await file.text(), /<\/Paragraph>/g), 'Final Draft (.fdx)');
    default:
      return rozeberText(await file.text(), 'Textový soubor');
  }
}

/**
 * Počet normostran do objednávky (zadání 12. 9. 2026: „když to bude započatá
 * strana, zaokrouhleme to nahoru").
 *
 * Účtuje se po celých normostranách, takže 71,1 je sedmdesát dva. Malá
 * tolerance je tam kvůli počítání s desetinnými čísly: přesně 71 nemá kvůli
 * poslední cifře za čárkou vyskočit na 72.
 */
export function zaokrouhliNormostrany(n: number): number {
  return Math.max(0, Math.ceil(n - 1e-9));
}

/** „71,3" — na hlášku pod přílohou. */
export function formatujNormostrany(n: number): string {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(n);
}

export function formatujCislo(n: number): string {
  return new Intl.NumberFormat('cs-CZ').format(n);
}

/**
 * „1 normostrana", „3 normostrany", „71 normostran" — a u desetinného čísla
 * druhý pád: „71,3 normostrany".
 */
export function sklonujNormostrany(n: number): string {
  const zaokrouhlene = Math.round(n * 10) / 10;
  if (!Number.isInteger(zaokrouhlene)) return 'normostrany';
  if (zaokrouhlene === 1) return 'normostrana';
  if (zaokrouhlene >= 2 && zaokrouhlene <= 4) return 'normostrany';
  return 'normostran';
}
