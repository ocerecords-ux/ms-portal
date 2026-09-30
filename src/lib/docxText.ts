import { inflateRawSync } from 'node:zlib';

/**
 * TEXT Z WORDU (zadání 30. 9. 2026: „bylo by super, kdybych tady mohl k těm
 * výstupům i nahrát a editovat text").
 *
 * Texty spotů chodí od klientů ve Wordu. Tenhle soubor z .docx vytáhne holý
 * text - odstavce, konce řádků a tabulátory; formátování se zahazuje schválně,
 * protože natáčecí list si sází vlastní.
 *
 * BEZ KNIHOVNY NAVÍC. .docx je obyčejný ZIP a text je v jednom souboru uvnitř
 * (`word/document.xml`) zabalený deflatem, který umí `node:zlib`. Přidávat
 * kvůli tomu závislost by znamenalo další věc, která se může při buildu
 * rozbít - a číst potřebujeme jen ten jeden soubor.
 *
 * Co tenhle soubor NEUMÍ: .doc (starý binární Word), .pdf a naskenované
 * dokumenty. Ty se do portálu nahrát nedají a je o tom hláška, ať nikdo
 * nečeká, že se text objeví sám.
 */

/** Konec centrálního adresáře ZIPu - „PK\x05\x06". */
const EOCD = 0x06054b50;
const HLAVICKA_V_ADRESARI = 0x02014b50;

type ZaznamZipu = { nazev: string; metoda: number; offset: number; velikost: number };

/**
 * Přečte centrální adresář ZIPu. Hledá se od konce: komentář na konci souboru
 * může být až 64 kB dlouhý, takže se prochází pozpátku, dokud značka nesedí.
 */
function zaznamyZipu(buf: Buffer): ZaznamZipu[] {
  let konec = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65_535; i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      konec = i;
      break;
    }
  }
  if (konec < 0) return [];

  const pocet = buf.readUInt16LE(konec + 10);
  let p = buf.readUInt32LE(konec + 16);
  const zaznamy: ZaznamZipu[] = [];

  for (let i = 0; i < pocet && p + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(p) !== HLAVICKA_V_ADRESARI) break;
    const metoda = buf.readUInt16LE(p + 10);
    const velikost = buf.readUInt32LE(p + 20);
    const delkaNazvu = buf.readUInt16LE(p + 28);
    const delkaExtra = buf.readUInt16LE(p + 30);
    const delkaKomentare = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const nazev = buf.toString('utf8', p + 46, p + 46 + delkaNazvu);
    zaznamy.push({ nazev, metoda, offset, velikost });
    p += 46 + delkaNazvu + delkaExtra + delkaKomentare;
  }
  return zaznamy;
}

/** Obsah jednoho souboru ze ZIPu. Null = není tam, nebo je zabalený jinak. */
function souborZeZipu(buf: Buffer, nazev: string): Buffer | null {
  const zaznam = zaznamyZipu(buf).find((z) => z.nazev === nazev);
  if (!zaznam) return null;

  const p = zaznam.offset;
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== 0x04034b50) return null;
  const delkaNazvu = buf.readUInt16LE(p + 26);
  const delkaExtra = buf.readUInt16LE(p + 28);
  const zacatek = p + 30 + delkaNazvu + delkaExtra;

  // Uložený bez komprese (metoda 0) nebo deflate (8) - nic jiného Word nedělá.
  if (zaznam.metoda === 0) return buf.subarray(zacatek, zacatek + zaznam.velikost);
  if (zaznam.metoda !== 8) return null;
  try {
    return inflateRawSync(buf.subarray(zacatek));
  } catch {
    return null;
  }
}

const ENTITY: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function odkoduj(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (cele, kod: string) => {
    if (kod.startsWith('#x') || kod.startsWith('#X')) {
      return String.fromCodePoint(parseInt(kod.slice(2), 16));
    }
    if (kod.startsWith('#')) return String.fromCodePoint(Number(kod.slice(1)));
    return ENTITY[kod] ?? cele;
  });
}

/**
 * XML dokumentu na text. Word má text v `<w:t>`, odstavce v `<w:p>`, zalomení
 * v `<w:br/>` a tabulátory v `<w:tab/>`. Všechno ostatní (styly, revize,
 * obrázky) se zahodí.
 */
export function textZDocumentXml(xml: string): string {
  const bezPoznamek = xml
    // Smazaný text ze sledování změn do natáčecího listu nepatří.
    .replace(/<w:del\b[\s\S]*?<\/w:del>/g, '')
    .replace(/<w:instrText\b[\s\S]*?<\/w:instrText>/g, '');

  const sZnackami = bezPoznamek
    /**
     * Prázdný odstavec Word zapisuje jako `<w:p .../>` bez konce - a právě
     * ten dělá v textu prázdný řádek mezi replikami. Kdyby se nepočítal,
     * slepil by se celý scénář do jednoho bloku.
     */
    .replace(/<w:p\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<w:cr\b[^>]*\/?>/g, '\n');

  const kusy: string[] = [];
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|(\n|\t)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sZnackami)) !== null) {
    kusy.push(m[1] !== undefined ? odkoduj(m[1]) : m[2]);
  }

  return kusy
    .join('')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((r) => r.replace(/[ \t]+$/, ''))
    // Víc než jeden prázdný řádek za sebou je jen mezera po formátování.
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Text z nahraného .docx. Prázdný řetězec = dokument je prázdný. */
export function textZDocx(soubor: Buffer): string | null {
  const xml = souborZeZipu(soubor, 'word/document.xml');
  if (!xml) return null;
  return textZDocumentXml(xml.toString('utf8'));
}
