/**
 * ZÁPIS ID3 TAGŮ DO MP3 (zadání 14. 10. 2026: „potřebuju nějak pořešit to,
 * abychom mohli finální nahrávku otagovat").
 *
 * PROČ VLASTNÍ ZAPISOVAČ A NE KNIHOVNA: tagů je osm, všechny textové, a formát
 * ID3 je u textových rámců triviální - hlavička, délka, kódování, text. Balíček
 * navíc by znamenal další závislost v buildu kvůli dvaceti řádkům.
 *
 * PÍŠE SE ID3v2.3, NE v2.4. Novější verze je hezčí, ale starší přehrávače,
 * autorádia a hlavně Windows ji občas neumí - a tagy jsou od toho, aby je
 * přečetl kdokoliv. Text jde v UTF-16 s BOM, takže diakritika sedí všude.
 *
 * Stará značka se nejdřív SUNDÁ: ID3v2 na začátku souboru i ID3v1 (posledních
 * 128 bajtů). Jinak by si přehrávač přečetl tu starou a nová by se jen
 * schovala za ní.
 */

/** Rámce, které zapisujeme. Pořadí je i pořadím v souboru. */
export type Id3Tagy = {
  /** TIT2 - název stopy (kapitoly). */
  title?: string | null;
  /** TPE1 - „přispívající interpret", u nás AUTOR KNIHY. */
  artist?: string | null;
  /** TPE2 - „interpret alba", u nás HEREC. */
  albumArtist?: string | null;
  /** TALB - název audioknihy. */
  album?: string | null;
  /** TYER - rok vydání. */
  rok?: number | null;
  /** TCON - žánr, domluveno „Speech". */
  zanr?: string | null;
  /** TRCK - číslo stopy; zapisuje se „01" i „01/24". */
  cislo?: number | null;
  /** Celkem stop - když je známo, zapíše se „01/24". */
  celkem?: number | null;
  /** TPUB - vydavatel. */
  vydavatel?: string | null;
};

/** Text rámce v UTF-16LE s BOM a ukončovací nulou - kódování 0x01. */
function textovyRamec(id: string, hodnota: string): Buffer | null {
  const text = hodnota.trim();
  if (!text) return null;

  const bom = Buffer.from([0xff, 0xfe]);
  const telo = Buffer.concat([
    Buffer.from([0x01]), // kódování: UTF-16 s BOM
    bom,
    Buffer.from(text, 'utf16le'),
    Buffer.from([0x00, 0x00]), // ukončovací nula
  ]);

  const hlavicka = Buffer.alloc(10);
  hlavicka.write(id, 0, 4, 'latin1');
  hlavicka.writeUInt32BE(telo.length, 4); // v2.3: běžné 32bit číslo
  hlavicka.writeUInt16BE(0, 8); // žádné příznaky
  return Buffer.concat([hlavicka, telo]);
}

/** Velikost značky se v ID3 píše po sedmi bitech (nejvyšší bit je vždy nula). */
function synchsafe(hodnota: number): Buffer {
  const b = Buffer.alloc(4);
  b[0] = (hodnota >> 21) & 0x7f;
  b[1] = (hodnota >> 14) & 0x7f;
  b[2] = (hodnota >> 7) & 0x7f;
  b[3] = hodnota & 0x7f;
  return b;
}

function cisloStopy(tagy: Id3Tagy): string | null {
  if (tagy.cislo == null) return null;
  const cislo = String(tagy.cislo).padStart(2, '0');
  if (tagy.celkem == null || tagy.celkem <= 0) return cislo;
  return `${cislo}/${String(tagy.celkem).padStart(2, '0')}`;
}

/** Hotová značka ID3v2.3 i s hlavičkou - připraveno na začátek souboru. */
export function postavZnacku(tagy: Id3Tagy): Buffer {
  const ramce: Buffer[] = [];
  const pridej = (id: string, hodnota: string | null | undefined) => {
    if (!hodnota) return;
    const ramec = textovyRamec(id, hodnota);
    if (ramec) ramce.push(ramec);
  };

  pridej('TIT2', tagy.title);
  pridej('TPE1', tagy.artist);
  pridej('TPE2', tagy.albumArtist);
  pridej('TALB', tagy.album);
  pridej('TYER', tagy.rok != null ? String(tagy.rok) : null);
  pridej('TCON', tagy.zanr);
  pridej('TRCK', cisloStopy(tagy));
  pridej('TPUB', tagy.vydavatel);

  const telo = Buffer.concat(ramce);
  const hlavicka = Buffer.concat([
    Buffer.from('ID3', 'latin1'),
    Buffer.from([0x03, 0x00]), // verze 2.3.0
    Buffer.from([0x00]), // žádné příznaky
    synchsafe(telo.length),
  ]);
  return Buffer.concat([hlavicka, telo]);
}

/** Kolik bajtů na začátku zabírá stará značka ID3v2 (0 = žádná není). */
function delkaStareZnacky(soubor: Buffer): number {
  if (soubor.length < 10) return 0;
  if (soubor.toString('latin1', 0, 3) !== 'ID3') return 0;
  const velikost =
    ((soubor[6] & 0x7f) << 21) | ((soubor[7] & 0x7f) << 14) | ((soubor[8] & 0x7f) << 7) | (soubor[9] & 0x7f);
  // Příznak „footer" (bit 4) přidává na konec dalších deset bajtů.
  const patka = (soubor[5] & 0x10) !== 0 ? 10 : 0;
  return 10 + velikost + patka;
}

/** Má soubor na konci starou značku ID3v1? Těch 128 bajtů taky pryč. */
function maStaryId3v1(soubor: Buffer): boolean {
  if (soubor.length < 128) return false;
  return soubor.toString('latin1', soubor.length - 128, soubor.length - 125) === 'TAG';
}

/**
 * Nový obsah souboru: čistý zvuk s čerstvou značkou na začátku.
 *
 * Samotná zvuková data se nepřepisují - jen se z nich sundá stará značka
 * a nalepí nová. Soubor se tím nepřekóduje, kvalita se nemění.
 */
export function zapisTagy(soubor: Buffer, tagy: Id3Tagy): Buffer {
  const od = delkaStareZnacky(soubor);
  const konec = maStaryId3v1(soubor) ? soubor.length - 128 : soubor.length;
  const zvuk = soubor.subarray(od, Math.max(od, konec));
  return Buffer.concat([postavZnacku(tagy), zvuk]);
}

/** Co v souboru je teď - pro kontrolu po zápisu a do logu. */
export function prectiTagy(soubor: Buffer): Record<string, string> {
  const konec = delkaStareZnacky(soubor);
  const nalez: Record<string, string> = {};
  if (konec === 0) return nalez;

  let i = 10;
  while (i + 10 <= konec) {
    const id = soubor.toString('latin1', i, i + 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const delka = soubor.readUInt32BE(i + 4);
    if (delka <= 0 || i + 10 + delka > konec) break;
    const telo = soubor.subarray(i + 10, i + 10 + delka);
    const kodovani = telo[0];
    let text: string;
    if (kodovani === 0x01 || kodovani === 0x02) {
      text = telo.subarray(1).toString('utf16le').replace(/^﻿/, '');
    } else if (kodovani === 0x03) {
      text = telo.subarray(1).toString('utf8');
    } else {
      text = telo.subarray(1).toString('latin1');
    }
    nalez[id] = text.replace(/\0+$/, '');
    i += 10 + delka;
  }
  return nalez;
}
