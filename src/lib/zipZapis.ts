import { deflateRawSync } from 'node:zlib';

/**
 * ZÁPIS ZIPU BEZ KNIHOVNY (30. 9. 2026). Protějšek ke čtečce v docxText.ts,
 * která .docx umí rozebrat - tohle ho umí složit.
 *
 * Proč vlastní zapisovač: .docx je jen ZIP s několika XML soubory a portál
 * kvůli tomu nemá co tahat další závislost. Formát ZIPu je starý a stabilní,
 * `zlib` je přímo v Node a celé to má pod stovku řádků.
 *
 * Píše se prostá varianta: jeden záznam za souborem (bez data descriptorů),
 * bez ZIP64 a bez šifrování. Pro dokument o pár desítkách kilobajtů to bohatě
 * stačí a Word, Google Disk i macOS to čtou.
 */

export type SouborDoZipu = {
  /** Cesta uvnitř archivu, lomítka dopředu ('word/document.xml'). */
  nazev: string;
  data: Buffer;
  /**
   * Uložit beze změny místo komprese. Pro první soubor v .docx
   * ([Content_Types].xml se komprimovat smí, mimetype u ODF ne) to potřeba
   * není, hodí se to ale u dat, která se stlačit nedají (PNG).
   */
  bezKomprese?: boolean;
};

/** Tabulka CRC-32 (polynom 0xEDB88320) - spočítá se jednou při načtení modulu. */
const CRC_TABULKA = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(data: Buffer): number {
  let c = -1;
  for (let i = 0; i < data.length; i++) c = CRC_TABULKA[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/**
 * Čas v ZIPu se píše ve formátu MS-DOS. Datum je schválně PEVNÉ: dva stejné
 * dokumenty tak dají bajt po bajtu stejný soubor, což se hodí při ladění
 * a nic to nerozbije - datum vzniku si stejně vede Disk.
 */
const DOS_CAS = 0;
const DOS_DATUM = ((2026 - 1980) << 9) | (1 << 5) | 1;

export function zabalZip(soubory: SouborDoZipu[]): Buffer {
  const casti: Buffer[] = [];
  const hlavicky: Buffer[] = [];
  let posun = 0;

  for (const soubor of soubory) {
    const jmeno = Buffer.from(soubor.nazev, 'utf-8');
    const syrova = soubor.data;
    const zabalena = soubor.bezKomprese ? syrova : deflateRawSync(syrova, { level: 9 });
    const metoda = soubor.bezKomprese ? 0 : 8;
    const kontrola = crc32(syrova);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // podpis
    local.writeUInt16LE(20, 4); // verze potřebná k rozbalení (2.0)
    local.writeUInt16LE(0x0800, 6); // příznak: jména souborů v UTF-8
    local.writeUInt16LE(metoda, 8);
    local.writeUInt16LE(DOS_CAS, 10);
    local.writeUInt16LE(DOS_DATUM, 12);
    local.writeUInt32LE(kontrola, 14);
    local.writeUInt32LE(zabalena.length, 18);
    local.writeUInt32LE(syrova.length, 22);
    local.writeUInt16LE(jmeno.length, 26);
    local.writeUInt16LE(0, 28); // délka „extra" pole
    casti.push(local, jmeno, zabalena);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // čím bylo vytvořeno
    central.writeUInt16LE(20, 6); // čím jde rozbalit
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(metoda, 10);
    central.writeUInt16LE(DOS_CAS, 12);
    central.writeUInt16LE(DOS_DATUM, 14);
    central.writeUInt32LE(kontrola, 16);
    central.writeUInt32LE(zabalena.length, 20);
    central.writeUInt32LE(syrova.length, 24);
    central.writeUInt16LE(jmeno.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // komentář
    central.writeUInt16LE(0, 34); // číslo disku
    central.writeUInt16LE(0, 36); // vnitřní příznaky
    central.writeUInt32LE(0, 38); // vnější příznaky
    central.writeUInt32LE(posun, 42);
    hlavicky.push(central, jmeno);

    posun += local.length + jmeno.length + zabalena.length;
  }

  const adresar = Buffer.concat(hlavicky);
  const konec = Buffer.alloc(22);
  konec.writeUInt32LE(0x06054b50, 0);
  konec.writeUInt16LE(0, 4); // číslo disku
  konec.writeUInt16LE(0, 6); // disk s adresářem
  konec.writeUInt16LE(soubory.length, 8);
  konec.writeUInt16LE(soubory.length, 10);
  konec.writeUInt32LE(adresar.length, 12);
  konec.writeUInt32LE(posun, 16);
  konec.writeUInt16LE(0, 20); // komentář archivu

  return Buffer.concat([...casti, adresar, konec]);
}
