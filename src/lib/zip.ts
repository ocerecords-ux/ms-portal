/**
 * ZIP BEZ ZÁVISLOSTÍ, skládaný za běhu a rovnou streamovaný ven (původně
 * napsáno 5. 9. 2026 pro „Stáhnout vše" u nahrávek na Disku).
 *
 * Nic se neukládá na disk ani nedrží v paměti, takže projdou i velké soubory.
 * Ukládá se bez komprese (metoda „store"): mp3, wav, PDF i fotky komprimované
 * jsou, takže by komprese jen zdržovala a nic neušetřila.
 *
 * OD 16. 9. 2026 TO NENÍ JEN PRO DISK (zadání: „potřebuji mít u Výdajů
 * a faktur tlačítko, kdy můžu stáhnout kompletní přílohy dokladů za minulý
 * měsíc"). Proto zapisovač bydlí tady a routy si ho půjčují — druhá kopie
 * téhle stovky řádků s hlavičkami a CRC by se po první opravě rozešla.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32Update(crc: number, chunk: Uint8Array): number {
  let c = crc;
  for (let i = 0; i < chunk.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ chunk[i]) & 0xff];
  }
  return c >>> 0;
}

/** Cas v ZIPu se drzi ve starem DOS formatu (2 bajty datum, 2 bajty cas). */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

type Written = {
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
};

function u8(length: number): { buf: Uint8Array; view: DataView } {
  const buf = new Uint8Array(length);
  return { buf, view: new DataView(buf.buffer) };
}

function localHeader(nameBytes: Uint8Array, time: number, date: number): Uint8Array {
  const { buf, view } = u8(30 + nameBytes.length);
  view.setUint32(0, 0x04034b50, true); // podpis
  view.setUint16(4, 20, true); // potrebna verze
  view.setUint16(6, 0x0808, true); // bit 3 = velikosti az za daty, bit 11 = UTF-8 nazvy
  view.setUint16(8, 0, true); // metoda: store
  view.setUint16(10, time, true);
  view.setUint16(12, date, true);
  view.setUint32(14, 0, true); // CRC doplnime v data descriptoru
  view.setUint32(18, 0, true);
  view.setUint32(22, 0, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  buf.set(nameBytes, 30);
  return buf;
}

function dataDescriptor(crc: number, size: number): Uint8Array {
  const { buf, view } = u8(16);
  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc, true);
  view.setUint32(8, size, true);
  view.setUint32(12, size, true);
  return buf;
}

function centralDirectory(entries: Written[], startOffset: number): Uint8Array {
  const parts: Uint8Array[] = [];
  let size = 0;
  for (const e of entries) {
    const { buf, view } = u8(46 + e.nameBytes.length);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true); // verze zapisovace
    view.setUint16(6, 20, true); // potrebna verze
    view.setUint16(8, 0x0808, true);
    view.setUint16(10, 0, true); // store
    view.setUint16(12, e.time, true);
    view.setUint16(14, e.date, true);
    view.setUint32(16, e.crc, true);
    view.setUint32(20, e.size, true);
    view.setUint32(24, e.size, true);
    view.setUint16(28, e.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, e.offset, true);
    buf.set(e.nameBytes, 46);
    parts.push(buf);
    size += buf.length;
  }

  const { buf: end, view: endView } = u8(22);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, size, true);
  endView.setUint32(16, startOffset, true);
  endView.setUint16(20, 0, true);
  parts.push(end);

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Nazvy v archivu musí být unikátní - Disk klidně povolí dva stejné. */
function uniqueName(used: Set<string>, name: string): string {
  const clean = name.normalize('NFC').replace(/[/\\]/g, '-');
  if (!used.has(clean)) {
    used.add(clean);
    return clean;
  }
  const dot = clean.lastIndexOf('.');
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : '';
  let i = 2;
  let candidate = `${base} (${i})${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${base} (${i})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

/** Jedna položka archivu. Obsah se sahá až ve chvíli, kdy na ni dojde řada. */
export type PolozkaZipu = {
  /** Název v archivu. Lomítka se nahradí, duplicity se očíslují. */
  nazev: string;
  /** Datum souboru - v archivu je pak vidět, z kdy doklad je. */
  datum?: Date | null;
  /**
   * Obsah. Stream se přečte po kouscích (velké soubory neprojdou pamětí),
   * Uint8Array se zapíše rovnou. `null` = soubor se nepovedlo získat;
   * přeskočí se a archiv se kvůli tomu nezruší.
   */
  nacti: () => Promise<ReadableStream<Uint8Array> | Uint8Array | null>;
};

/**
 * Sestaví ZIP ze seznamu položek. Vrací stream, který jde poslat rovnou
 * do odpovědi.
 *
 * Když se jedna položka nepovede stáhnout, PŘESKOČÍ SE a archiv se dokončí -
 * u dávky dokladů za měsíc je lepší dostat dvacet z jedenadvaceti příloh než
 * chybovou hlášku. Co vypadlo, se zapíše do logu.
 */
export function zipStream(polozky: PolozkaZipu[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const used = new Set<string>();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const entries: Written[] = [];
        let offset = 0;

        for (const polozka of polozky) {
          let obsah: ReadableStream<Uint8Array> | Uint8Array | null = null;
          try {
            obsah = await polozka.nacti();
          } catch (err) {
            console.error(`ZIP: polozku "${polozka.nazev}" se nepodarilo nacist:`, err);
          }
          if (!obsah) continue;

          const nameBytes = encoder.encode(uniqueName(used, polozka.nazev));
          const kdy = polozka.datum ?? new Date();
          const { time, date } = dosDateTime(Number.isNaN(kdy.getTime()) ? new Date() : kdy);

          const header = localHeader(nameBytes, time, date);
          controller.enqueue(header);
          const entryOffset = offset;
          offset += header.length;

          let crc = 0xffffffff;
          let size = 0;
          const zapis = (kus: Uint8Array) => {
            crc = crc32Update(crc, kus);
            size += kus.length;
            controller.enqueue(kus);
          };

          if (obsah instanceof Uint8Array) {
            zapis(obsah);
          } else {
            const reader = obsah.getReader();
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) zapis(value);
            }
          }

          crc = (crc ^ 0xffffffff) >>> 0;
          offset += size;

          const descriptor = dataDescriptor(crc, size);
          controller.enqueue(descriptor);
          offset += descriptor.length;

          entries.push({ nameBytes, crc, size, offset: entryOffset, time, date });
        }

        controller.enqueue(centralDirectory(entries, offset));
        controller.close();
      } catch (err) {
        console.error('Sestaveni ZIPu selhalo:', err);
        controller.error(err);
      }
    },
  });
}

/** Hlavičky odpovědi, aby prohlížeč archiv stáhl pod správným názvem. */
export function hlavickyZipu(nazevSouboru: string): Record<string, string> {
  const zipName = nazevSouboru.normalize('NFC');
  const asciiFallback = zipName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  return {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
    'Cache-Control': 'no-store',
  };
}

export { crc32Update, dosDateTime, localHeader, dataDescriptor, centralDirectory, uniqueName };
export type { Written };
