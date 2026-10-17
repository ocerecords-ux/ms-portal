/**
 * CO JE TO ZA SKLADBU - PŘEČTENO ZE SOUBORU (zadání 17. 10. 2026: „pojďme to
 * udělat tak, že se tam vypíše název skladby a autor, když tam vložím soubor.
 * Ten název autor by neměl jít měnit").
 *
 * ČTE SE V PROHLÍŽEČI, NE NA SERVERU. Soubor jde z Finderu rovnou do Dropboxu
 * a portál ho nikdy nevidí - padesátimegový WAV by přes Vercel neprošel (strop
 * požadavku je kolem 4,5 MB). Metadata se proto přečtou tam, kde soubor
 * opravdu je, a do portálu doletí jen pár řádků textu a zmenšený obal.
 *
 * ČTE SE JEN ZAČÁTEK SOUBORU. Z padesáti megabajtů se do paměti natáhne
 * nejvýš pár set kilobajtů - štítek je na začátku a u WAVu se přeskakuje
 * po hlavičkách bloků, ne po datech.
 *
 * PODPOROVANÉ ŠTÍTKY: ID3v2 (MP3 i WAV, kde bývá v bloku „id3 "), RIFF INFO
 * (WAV) a Vorbis comment (FLAC). Co se nepovede přečíst, spadne na jméno
 * souboru ve tvaru „Autor - Název" - tak si hudbu pojmenovává většina
 * knihoven a je to lepší odhad než prázdné pole.
 *
 * SOUBOR JE BEZ PRISMY A BEZ SERVERU - běží v prohlížeči.
 */

export type MetadataHudby = {
  nazev: string;
  autor: string | null;
  /** Obal z metadat, ještě v původní velikosti. */
  obal: Blob | null;
};

/** Kolik bajtů si smíme z jednoho souboru přečíst, než to vzdáme. */
const STROP_CTENI = 8 * 1024 * 1024;

/** Obal větší než tohle do metadat nepatří - je to skoro jistě omyl. */
const STROP_OBALU = 12 * 1024 * 1024;

// ---------------------------------------------------------------- pomocné

async function kus(soubor: Blob, od: number, do_: number): Promise<Uint8Array> {
  const konec = Math.min(do_, soubor.size);
  if (od >= konec) return new Uint8Array(0);
  return new Uint8Array(await soubor.slice(od, konec).arrayBuffer());
}

function znacka(b: Uint8Array, od: number, delka: number): string {
  let s = '';
  for (let i = 0; i < delka && od + i < b.length; i++) s += String.fromCharCode(b[od + i]);
  return s;
}

function cisloBE(b: Uint8Array, od: number, delka: number): number {
  let n = 0;
  for (let i = 0; i < delka; i++) n = n * 256 + (b[od + i] ?? 0);
  return n;
}

function cisloLE(b: Uint8Array, od: number, delka: number): number {
  let n = 0;
  for (let i = delka - 1; i >= 0; i--) n = n * 256 + (b[od + i] ?? 0);
  return n;
}

/**
 * Synchsafe číslo z ID3: v každém bajtu se používá jen sedm bitů, aby se
 * velikost štítku nedala splést se začátkem zvuku.
 */
function synchsafe(b: Uint8Array, od: number): number {
  return ((b[od] & 0x7f) << 21) | ((b[od + 1] & 0x7f) << 14) | ((b[od + 2] & 0x7f) << 7) | (b[od + 3] & 0x7f);
}

/**
 * Obrázek z výřezu štítku. Bajty se KOPÍRUJÍ do vlastní paměti - výřez
 * (`subarray`) ukazuje do celého načteného štítku a Blob by si ho držel celý,
 * i kdyby z něj potřeboval jen obálku.
 */
function naBlob(bajty: Uint8Array, mime: string): Blob {
  const kopie = new Uint8Array(bajty.length);
  kopie.set(bajty);
  return new Blob([kopie.buffer as ArrayBuffer], {
    type: mime.startsWith('image/') ? mime : 'image/jpeg',
  });
}

function dekoduj(bajty: Uint8Array, kodovani: string): string {
  try {
    return new TextDecoder(kodovani, { fatal: false }).decode(bajty);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bajty);
  }
}

/** Texty v ID3 končí nulou (u UTF-16 dvěma) a občas i mezerami navíc. */
function ocisti(text: string): string {
  return text.replace(/\u0000+$/g, '').replace(/\s+/g, ' ').trim();
}

// ------------------------------------------------------------------- ID3

/** Text rámce ID3 podle bajtu kódování na jeho začátku. */
function textRamce(data: Uint8Array): string {
  if (data.length < 2) return '';
  const kod = data[0];
  const telo = data.subarray(1);
  if (kod === 0) return textLatin(telo);
  if (kod === 1) return ocisti(dekoduj(telo, 'utf-16'));
  if (kod === 2) return ocisti(dekoduj(telo, 'utf-16be'));
  return ocisti(dekoduj(telo, 'utf-8'));
}

/**
 * ID3 s kódováním 0 je podle normy latin-1, jenže české knihovny tam běžně
 * píšou Windows-1250 - v latin-1 by z „Dvořák" bylo „DvoYák". Windows-1250 je
 * nadmnožina, takže čistě anglický text přečte stejně.
 */
function textLatin(data: Uint8Array): string {
  return ocisti(dekoduj(data, 'windows-1250'));
}

type NalezenyStitek = { nazev: string | null; autor: string | null; obal: Blob | null };

function prectiId3(tag: Uint8Array): NalezenyStitek {
  const vysledek: NalezenyStitek = { nazev: null, autor: null, obal: null };
  if (znacka(tag, 0, 3) !== 'ID3') return vysledek;

  const verze = tag[3];
  const priznaky = tag[5];
  let pozice = 10;
  // Rozšířená hlavička - přeskočit, nic z ní nepotřebujeme.
  if (priznaky & 0x40) {
    pozice += verze >= 4 ? synchsafe(tag, pozice) : cisloBE(tag, pozice, 4) + 4;
  }

  const delkaId = verze === 2 ? 3 : 4;
  const delkaVelikosti = verze === 2 ? 3 : 4;

  while (pozice + delkaId + delkaVelikosti <= tag.length) {
    const id = znacka(tag, pozice, delkaId);
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break; // došly rámce, začíná výplň
    const velikost =
      verze >= 4 ? synchsafe(tag, pozice + delkaId) : cisloBE(tag, pozice + delkaId, delkaVelikosti);
    const zacatek = pozice + delkaId + delkaVelikosti + (verze === 2 ? 0 : 2);
    const konec = zacatek + velikost;
    if (velikost <= 0 || konec > tag.length) break;
    const data = tag.subarray(zacatek, konec);

    if (id === 'TIT2' || id === 'TT2') vysledek.nazev = vysledek.nazev || textRamce(data) || null;
    else if (id === 'TPE1' || id === 'TP1') vysledek.autor = vysledek.autor || textRamce(data) || null;
    else if ((id === 'APIC' || id === 'PIC') && !vysledek.obal) vysledek.obal = obrazekZApic(data, id === 'PIC');

    pozice = konec;
  }
  return vysledek;
}

/** Obrázek z rámce APIC: kódování, typ obrázku, popis, a teprve pak data. */
function obrazekZApic(data: Uint8Array, stara: boolean): Blob | null {
  if (data.length < 5) return null;
  const kod = data[0];
  let i = 1;
  let mime = 'image/jpeg';
  if (stara) {
    // ID3v2.2 má místo MIME typu tři písmena („JPG", „PNG").
    const typ = znacka(data, i, 3).toUpperCase();
    mime = typ === 'PNG' ? 'image/png' : 'image/jpeg';
    i += 3;
  } else {
    const zacatek = i;
    while (i < data.length && data[i] !== 0) i++;
    mime = znacka(data, zacatek, i - zacatek) || 'image/jpeg';
    i += 1;
  }
  i += 1; // typ obrázku (obal, zadní strana...)
  // Popis obrázku - u UTF-16 ho ukončují dvě nuly.
  if (kod === 1 || kod === 2) {
    while (i + 1 < data.length && !(data[i] === 0 && data[i + 1] === 0)) i += 2;
    i += 2;
  } else {
    while (i < data.length && data[i] !== 0) i++;
    i += 1;
  }
  if (i >= data.length) return null;
  const obrazek = data.subarray(i);
  if (obrazek.length < 100 || obrazek.length > STROP_OBALU) return null;
  return naBlob(obrazek, mime);
}

// ------------------------------------------------------------------- WAV

/**
 * WAV je posloupnost bloků. Projdou se JEN JEJICH HLAVIČKY - blok „data" se
 * přeskočí podle jeho délky, takže se padesát megabajtů zvuku nikam nenačítá.
 */
async function prectiWav(soubor: Blob): Promise<NalezenyStitek> {
  const vysledek: NalezenyStitek = { nazev: null, autor: null, obal: null };
  let pozice = 12; // RIFF(4) + velikost(4) + WAVE(4)
  let kroku = 0;
  while (pozice + 8 <= soubor.size && pozice < STROP_CTENI && kroku < 200) {
    kroku++;
    const hlavicka = await kus(soubor, pozice, pozice + 8);
    if (hlavicka.length < 8) break;
    const id = znacka(hlavicka, 0, 4);
    const delka = cisloLE(hlavicka, 4, 4);
    if (delka < 0) break;
    const telo = pozice + 8;

    if (id === 'LIST' && delka < 1024 * 1024) {
      const blok = await kus(soubor, telo, telo + delka);
      if (znacka(blok, 0, 4) === 'INFO') {
        let i = 4;
        while (i + 8 <= blok.length) {
          const pole = znacka(blok, i, 4);
          const d = cisloLE(blok, i + 4, 4);
          const hodnota = textLatin(blok.subarray(i + 8, i + 8 + d));
          if (pole === 'INAM' && hodnota) vysledek.nazev = vysledek.nazev ?? hodnota;
          if ((pole === 'IART' || pole === 'IAUT') && hodnota) vysledek.autor = vysledek.autor ?? hodnota;
          i += 8 + d + (d % 2);
        }
      }
    } else if ((id === 'id3 ' || id === 'ID3 ') && delka < 4 * 1024 * 1024) {
      const blok = await kus(soubor, telo, telo + delka);
      const z = prectiId3(blok);
      vysledek.nazev = vysledek.nazev ?? z.nazev;
      vysledek.autor = vysledek.autor ?? z.autor;
      vysledek.obal = vysledek.obal ?? z.obal;
    }

    pozice = telo + delka + (delka % 2);
  }
  return vysledek;
}

// ------------------------------------------------------------------ FLAC

async function prectiFlac(soubor: Blob): Promise<NalezenyStitek> {
  const vysledek: NalezenyStitek = { nazev: null, autor: null, obal: null };
  let pozice = 4;
  for (let i = 0; i < 64; i++) {
    const hlavicka = await kus(soubor, pozice, pozice + 4);
    if (hlavicka.length < 4) break;
    const posledni = (hlavicka[0] & 0x80) !== 0;
    const typ = hlavicka[0] & 0x7f;
    const delka = cisloBE(hlavicka, 1, 3);
    const telo = pozice + 4;

    if (typ === 4 && delka < 2 * 1024 * 1024) {
      const blok = await kus(soubor, telo, telo + delka);
      let i2 = 0;
      const vendor = cisloLE(blok, 0, 4);
      i2 = 4 + vendor;
      const pocet = cisloLE(blok, i2, 4);
      i2 += 4;
      for (let k = 0; k < pocet && i2 + 4 <= blok.length; k++) {
        const d = cisloLE(blok, i2, 4);
        const radek = dekoduj(blok.subarray(i2 + 4, i2 + 4 + d), 'utf-8');
        const deli = radek.indexOf('=');
        if (deli > 0) {
          const klic = radek.slice(0, deli).toUpperCase();
          const hodnota = ocisti(radek.slice(deli + 1));
          if (klic === 'TITLE' && hodnota) vysledek.nazev = vysledek.nazev ?? hodnota;
          if (klic === 'ARTIST' && hodnota) vysledek.autor = vysledek.autor ?? hodnota;
        }
        i2 += 4 + d;
      }
    } else if (typ === 6 && delka < STROP_OBALU && !vysledek.obal) {
      const blok = await kus(soubor, telo, telo + delka);
      let i2 = 4;
      const mimeD = cisloBE(blok, i2, 4);
      i2 += 4;
      const mime = znacka(blok, i2, mimeD) || 'image/jpeg';
      i2 += mimeD;
      const popisD = cisloBE(blok, i2, 4);
      i2 += 4 + popisD + 16; // popis + šířka, výška, hloubka, barvy
      const dataD = cisloBE(blok, i2, 4);
      i2 += 4;
      if (dataD > 100 && i2 + dataD <= blok.length) {
        vysledek.obal = naBlob(blok.subarray(i2, i2 + dataD), mime);
      }
    }

    pozice = telo + delka;
    if (posledni || pozice > STROP_CTENI) break;
  }
  return vysledek;
}

// ------------------------------------------------------------- jméno souboru

/**
 * Záchranná síť: „Tomáš Dvořák - Modrá hodina.wav". Pomlčka s mezerami je
 * jediný tvar, který se bere - „Modrá hodina-final" by jinak skončila
 * s autorem „Modrá hodina".
 */
export function zJmenaSouboru(jmeno: string): { nazev: string; autor: string | null } {
  const bezPripony = jmeno.replace(/\.[^.]+$/, '').trim();
  const deli = bezPripony.match(/^(.{2,60}?)\s+[-–—]\s+(.+)$/);
  if (deli) {
    return { autor: ocisti(deli[1]) || null, nazev: ocisti(deli[2]) || bezPripony };
  }
  return { nazev: bezPripony || 'Bez názvu', autor: null };
}

// ------------------------------------------------------------------ veřejné

/** Co o skladbě víme z jejího souboru. Nikdy nespadne - nanejvýš nic nenajde. */
export async function prectiMetadata(soubor: File): Promise<MetadataHudby> {
  const zalozni = zJmenaSouboru(soubor.name);
  try {
    const zacatek = await kus(soubor, 0, 16);
    let nalez: NalezenyStitek = { nazev: null, autor: null, obal: null };

    if (znacka(zacatek, 0, 3) === 'ID3') {
      const delka = synchsafe(zacatek, 6) + 10;
      nalez = prectiId3(await kus(soubor, 0, Math.min(delka, STROP_CTENI)));
    } else if (znacka(zacatek, 0, 4) === 'RIFF' && znacka(zacatek, 8, 4) === 'WAVE') {
      nalez = await prectiWav(soubor);
    } else if (znacka(zacatek, 0, 4) === 'fLaC') {
      nalez = await prectiFlac(soubor);
    }

    return {
      nazev: nalez.nazev || zalozni.nazev,
      autor: nalez.autor || zalozni.autor,
      obal: nalez.obal,
    };
  } catch (err) {
    console.error('Metadata skladby se nepodařilo přečíst:', err);
    return { nazev: zalozni.nazev, autor: zalozni.autor, obal: null };
  }
}

/**
 * Délka skladby v sekundách. Měří ji sám prohlížeč - jediný způsob, jak ji
 * dostat ze všech formátů stejně, bez počítání bitrate z hlavičky.
 */
export async function zmerDelku(soubor: File): Promise<number> {
  return new Promise<number>((hotovo) => {
    let adresa: string | null = null;
    try {
      adresa = URL.createObjectURL(soubor);
    } catch {
      hotovo(0);
      return;
    }
    const zvuk = document.createElement('audio');
    zvuk.preload = 'metadata';
    const konec = (delka: number) => {
      if (adresa) URL.revokeObjectURL(adresa);
      hotovo(Number.isFinite(delka) && delka > 0 ? Math.round(delka) : 0);
    };
    zvuk.onloadedmetadata = () => konec(zvuk.duration);
    zvuk.onerror = () => konec(0);
    // Kdyby prohlížeč formát nepoznal a mlčel, ať se nečeká věčně.
    setTimeout(() => konec(zvuk.duration), 8000);
    zvuk.src = adresa;
  });
}

/**
 * Obal se do úložiště nedává tak, jak přišel: v metadatech bývá i obrázek
 * přes dva megabajty, zatímco v kartě z něj svítí čtverec padesát pixelů.
 * Zmenší se na hranu 500 px a uloží jako JPEG.
 */
export async function zmensiObal(obal: Blob, hrana = 500): Promise<Blob | null> {
  try {
    const obrazek = await vytvorObrazek(obal);
    if (!obrazek) return null;
    const merilo = Math.min(1, hrana / Math.max(obrazek.width, obrazek.height));
    const s = Math.max(1, Math.round(obrazek.width * merilo));
    const v = Math.max(1, Math.round(obrazek.height * merilo));
    const platno = document.createElement('canvas');
    platno.width = s;
    platno.height = v;
    const kontext = platno.getContext('2d');
    if (!kontext) return null;
    kontext.drawImage(obrazek, 0, 0, s, v);
    return await new Promise<Blob | null>((hotovo) =>
      platno.toBlob((b) => hotovo(b), 'image/jpeg', 0.85),
    );
  } catch (err) {
    console.error('Obal se nepodařilo zmenšit:', err);
    return null;
  }
}

async function vytvorObrazek(zdroj: Blob): Promise<HTMLImageElement | null> {
  return new Promise<HTMLImageElement | null>((hotovo) => {
    const adresa = URL.createObjectURL(zdroj);
    const obrazek = new Image();
    obrazek.onload = () => {
      URL.revokeObjectURL(adresa);
      hotovo(obrazek);
    };
    obrazek.onerror = () => {
      URL.revokeObjectURL(adresa);
      hotovo(null);
    };
    obrazek.src = adresa;
  });
}

/** „3:07" - délka skladby do karty. Prázdné, když se nezměřila. */
export function delkaTextem(sekundy: number): string {
  if (!sekundy || sekundy <= 0) return '';
  const m = Math.floor(sekundy / 60);
  const s = sekundy % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
