import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { bezpecnyNazev } from '@/lib/chatPrilohy';

/**
 * Adresa uloziste se z Cloudflare kopiruje rucne, takze snesme drobne
 * preklepy: chybejici https:// a lomitko na konci. Spatne slozena adresa
 * jinak shodi cely klient uz pri sestaveni (9. 9. 2026).
 */
/**
 * Do logu nikdy nepatri obsah promenne. Do S3_ENDPOINT se muze omylem dostat
 * i tajna hodnota (stalo se 9. 9. 2026 - uzivatel tam vlozil secret key),
 * a log by ji rozesel po Vercelu. Staci vedet, jak je hodnota dlouha a cim
 * konci.
 */
function nahled(hodnota: string | undefined): string {
  const text = (hodnota || '').trim();
  if (!text) return '(prazdne)';
  return `${text.length} znaku, konci na "${text.slice(-6)}"`;
}

function ocistiEndpoint(hodnota: string | undefined): string | undefined {
  const text = (hodnota || '').trim().replace(/\/+$/, '');
  if (!text) return undefined;
  // Do adresy obcas omylem sklouzne pristupovy klic (stalo se 9. 9. 2026).
  // Nesmi se s ni pak nakladat jako s adresou - a hlavne se nesmi nikam
  // vypsat. Klic nema tecku ani protokol a byva dlouhy.
  if (!text.includes('.') || (text.length > 45 && !/^https?:\/\//i.test(text))) {
    console.error(
      'S3_ENDPOINT nevypada jako adresa. Pozor: patri sem POUZE adresa uloziste, ' +
        'nikdy pristupovy klic. Pokud tam klic je, zneplatnete ho a vytvorte novy.',
    );
    return undefined;
  }
  const sProtokolem = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  // Nevyplneny zastupny text z navodu - snadny preklep pri kopirovani.
  if (/[<>{}\s]/.test(sProtokolem) || /account_id|ucet_id|yourbucket/i.test(sProtokolem)) {
    console.error(`S3_ENDPOINT vypada jako nevyplneny vzor (${nahled(hodnota)}).`);
    return undefined;
  }
  try {
    const adresa = new URL(sProtokolem);
    // Prazdny kousek jmena ("a1b2....r2...") je neplatna adresa, ale new URL()
    // ji spolkne. Bez teto kontroly se podpis vyrobi a chyba se projevi az
    // v prohlizeci jako necitelne "Failed to fetch" (9. 9. 2026).
    if (adresa.hostname.split('.').some((kus) => kus.length === 0)) {
      console.error(`S3_ENDPOINT ma v adrese prazdny kousek (${nahled(hodnota)}).`);
      return undefined;
    }
    // U Cloudflare R2 je prvni kousek vzdy 32 znaku hex (account ID). Kdyz
    // tam je neco jineho, je to skoro jiste zkopirovany priklad z navodu.
    if (adresa.hostname.endsWith('.r2.cloudflarestorage.com')) {
      const ucet = adresa.hostname.split('.')[0];
      if (!/^[0-9a-f]{32}$/i.test(ucet)) {
        console.error(`S3_ENDPOINT nevypada jako skutecna adresa R2 - prvni kousek jmena neni account ID (${nahled(hodnota)}).`);
        return undefined;
      }
    }
    return sProtokolem;
  } catch {
    console.error(`S3_ENDPOINT neni platna adresa (${nahled(hodnota)}).`);
    return undefined;
  }
}

function getClient() {
  const { S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT } = process.env;
  if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;

  const endpoint = ocistiEndpoint(S3_ENDPOINT);
  // Kdyz je adresa vyplnena, ale nedava smysl (typicky nekdo nechal
  // v hodnote zastupny text jako <account_id>), NESMI se tise sahnout po
  // Amazonu - podpis by pak mířil úplně jinam a chyba by se hledala hodiny
  // (stalo se 9. 9. 2026). Radsi rict, ze uloziste neni dostupne.
  if (S3_ENDPOINT && S3_ENDPOINT.trim() && !endpoint) {
    console.error('S3_ENDPOINT je vyplneny, ale neni to platna adresa - uloziste se nepouzije.');
    return null;
  }
  // Cloudflare R2 zna jedinou oblast, a to "auto". Kdyz se posle cokoliv
  // jineho, podpis nesedi a uloziste zapis odmitne.
  const jeR2 = Boolean(endpoint && endpoint.includes('r2.cloudflarestorage.com'));

  // BEZ AUTOMATICKÝCH KONTROLNÍCH SOUČTŮ (21. 9. 2026: „v chatu nejde
  // příloha").
  //
  // Novější SDK od Amazonu přidává ke každému PutObject kontrolní součet
  // CRC32 - a u PODEPSANÉ ADRESY ho spočítá předem, z prázdného těla, protože
  // soubor v tu chvíli ještě nemá. Prohlížeč pak pošle skutečný soubor, součet
  // nesedí a úložiště požadavek odmítne. Odmítnutí přijde bez hlaviček CORS,
  // takže prohlížeč hlásí jen „Failed to fetch" - na pohled k nerozeznání od
  // špatně nastaveného CORS. Balíček se instaluje v nejnovější verzi (není
  // zamčený), takže se to mohlo rozbít „samo" s kterýmkoli nasazením.
  //
  // WHEN_REQUIRED = součet jen tam, kde ho služba vyžaduje; R2 u nahrávání
  // nevyžaduje. Volby jdou do konfigurace rozbalením: starší verze SDK je
  // neznají a u rozbaleného objektu TypeScript navíc přidané vlastnosti
  // nekontroluje, takže překlad projde s kteroukoli verzí. Za běhu je starší
  // verze jen ignoruje.
  const bezSouctu = {
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  } as const;

  return new S3Client({
    ...bezSouctu,
    region: S3_REGION || (jeR2 ? 'auto' : 'eu-central-1'),
    endpoint, // prazdne = AWS S3, jinak napr. Cloudflare R2
    // SDK od Amazonu sklada adresu jako <bucket>.<server>/<klic>. R2 tohle
    // nezna - chce <server>/<bucket>/<klic>. Adresa s bucketem v podomene
    // se sice prelozi (cloudflarestorage.com ma zastupny zaznam), ale R2 na
    // ni bucket nenajde, takze na pozadavek z prohlizece neodpovi ani
    // hlavickami CORS - a prohlizec hlasi jen necitelne "Failed to fetch"
    // (naměřeno na produkci 9. 9. 2026).
    //
    // Plati pro kazde cizi uloziste, ne jen R2: kdyz je vyplneny vlastni
    // endpoint, je cesta s bucketem v ceste ta bezpecnejsi volba.
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Klic souboru vytazeny z adresy, pod kterou ho ulozila tahle aplikace.
 *
 * PROC TO JE (14. 9. 2026): profilove fotky se ukladaji do R2 a v databazi
 * z nich zustane cela adresa - jenze adresa R2 (`...r2.cloudflarestorage.com`)
 * je ROZHRANI ULOZISTE, ne verejny odkaz. Kdo na ni prijde bez podpisu,
 * dostane 401 a v portalu pak misto fotky svitily iniciály. Z adresy proto
 * vytahneme klic a odkaz si podepiseme sami - viz api/uzivatele/[id]/fotka.
 *
 * Pocita s obema tvary, ktere aplikace zaklada: `<server>/<bucket>/<klic>`
 * (vlastni uloziste, forcePathStyle) i `<bucket>.s3.amazonaws.com/<klic>`.
 */
export function klicZAdresyUloziste(adresa: string): string | null {
  const bucket = (process.env.S3_BUCKET || '').trim();
  if (!adresa.startsWith('http') || !bucket) return null;
  let cesta: string;
  try {
    cesta = decodeURIComponent(new URL(adresa).pathname.replace(/^\/+/, ''));
  } catch {
    return null;
  }
  if (!cesta) return null;
  if (cesta === bucket) return null;
  if (cesta.startsWith(`${bucket}/`)) return cesta.slice(bucket.length + 1) || null;
  return cesta;
}

/** Je uloziste souboru vubec nastavene? Pouziva i /api/health pro diagnostiku. */
export function isStorageConfigured(): boolean {
  return Boolean(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_BUCKET);
}

/**
 * Ulozi prilohu objednavky do S3/R2 pod nahodnym klicem (aby se nedaly
 * uhodnout/prochazet cizi soubory) a vrati verejnou URL. Pokud uloziste
 * jeste neni nakonfigurovane (chybi env promenne), priloha se preskoci -
 * objednavka se presto ulozi, jen bez souboru.
 */
/**
 * Adresa, pod kterou v úložišti leží soubor s tímhle klíčem. Skládá se stejně
 * jako při ukládání - viz uploadOrderAttachment níž.
 */
export function adresaVUlozisti(key: string): string | null {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) return null;
  const endpoint = process.env.S3_ENDPOINT;
  return endpoint ? `${endpoint}/${bucket}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;
}

/**
 * PŘÍLOHA OBJEDNÁVKY JDE DO ÚLOŽIŠTĚ ROVNOU Z PROHLÍŽEČE (oprava 16. 9. 2026:
 * „klientovi se nepodařilo odeslat objednávku").
 *
 * Objednávka s přílohou šla celá přes portál, a funkce na Vercelu mají strop
 * na velikost požadavku kolem 4,5 MB. Naskenovaný rukopis ho přeleze snadno —
 * klientce se stodevítistránkové PDF dvakrát vrátilo s chybou 413 a formulář
 * uměl říct jen „Objednávku se nepodařilo odeslat". Přitom chat tudy soubory
 * posílá odjakživa (viz podepsanyUploadPrilohy); objednávka na to jen nebyla
 * napojená.
 *
 * Klíč si určuje server, stejně jako u chatu - kdyby ho posílal prohlížeč,
 * dal by se jím přepsat cizí soubor.
 */
export async function podepsanyUploadObjednavky(
  fileName: string,
  mime: string,
  companyId: string,
): Promise<{ key: string; uploadUrl: string } | null> {
  const client = getClient();
  const bucket = process.env.S3_BUCKET;
  if (!client || !bucket) return null;

  const key = `objednavky/${companyId}/${randomUUID()}-${bezpecnyNazev(fileName)}`;
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mime || 'application/octet-stream',
    }),
    { expiresIn: PLATNOST_UPLOADU },
  );
  return { key, uploadUrl };
}

export async function uploadOrderAttachment(file: File, companyId: string): Promise<{ url: string; name: string } | null> {
  const client = getClient();
  const bucket = process.env.S3_BUCKET;
  if (!client || !bucket) return null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `objednavky/${companyId}/${randomUUID()}-${file.name}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
    }),
  );

  return { url: adresaVUlozisti(key) ?? '', name: file.name };
}

/** Fotka ulozena primo v databazi nesmi nafouknout radek uzivatele. */
const MAX_INLINE_PHOTO_BYTES = 700 * 1024;

/**
 * Ulozi fotku uzivatele (sekce Mediaspace v adminu, zadani 5. 9. 2026).
 *
 * Oprava 12. 9. 2026: samotne odeslani do S3/R2 (PutObjectCommand) drive
 * mohlo pri jakemkoli problemu (spatne credentials, sit, prava k bucketu)
 * shodit celou API routu nezachycenou vyjimkou - zalozeni uctu pak selhalo
 * s obecnou hlaskou "Účet se nepodařilo založit.".
 *
 * Oprava 8. 9. 2026 ("v detailu uživatele se nezobrazuje fotka, i když ji tam
 * mám"): kdyz uloziste S3 neni nastavene (coz je zatim na produkci pripad)
 * nebo nahravani selze, fotka se drive TISE zahodila - uzivatel ji nahral,
 * ulozeni proslo a fotka nikde. Nove se v takovem pripade ulozi rovnou do
 * databaze jako data URL. Prohlizec ji pred odeslanim zmensi na 400 px
 * (viz PhotoDropzone), takze jde o desitky kB - pro portretovou fotku
 * naprosto dostacujici a bez zavislosti na externim ulozisti.
 */
export async function uploadUserPhoto(file: File): Promise<string | null> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const client = getClient();
  const bucket = process.env.S3_BUCKET;

  if (client && bucket) {
    try {
      const key = `uzivatele/${randomUUID()}-${file.name}`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: file.type || 'application/octet-stream',
        }),
      );
      const endpoint = process.env.S3_ENDPOINT;
      return endpoint ? `${endpoint}/${bucket}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;
    } catch (err) {
      console.error('uploadUserPhoto: S3 selhalo, ukladam fotku do databaze:', err);
    }
  }

  // Zaloha bez S3 - fotka rovnou v databazi.
  if (buffer.byteLength > MAX_INLINE_PHOTO_BYTES) {
    console.error(
      `uploadUserPhoto: fotka je bez nastaveneho uloziste moc velka (${buffer.byteLength} B), preskakuji.`,
    );
    return null;
  }
  const mime = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}


/** Priloha vydaje - PDF nebo foto uctenky. */
const MAX_INLINE_ATTACHMENT_BYTES = 1_500 * 1024;

/**
 * Ulozi prilohu prijateho dokladu (zadani 6. 9. 2026 - "prilohy: PDF, foto").
 *
 * Stejny princip jako u fotky uzivatele: kdyz je nastavene S3, jde tam;
 * jinak se priloha ulozi rovnou do databaze jako data URL. Obrazky prohlizec
 * pred odeslanim zmensi, PDF prochazi tak, jak je - nad 1,5 MB uz ale
 * odmitneme a rekneme proc, at se do databaze necpe nekolikamegovy sken.
 */
export async function uploadExpenseAttachment(
  file: File,
): Promise<{ url: string; name: string } | { error: string } | null> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadExpenseBuffer(buffer, file.name, file.type);
}

/**
 * Totez, ale z hotovych bajtu - prilohu z e-mailu (zadani 12. 9. 2026) zadny
 * File neprovazi, prijde rovnou jako Buffer z rozebrane zpravy.
 */
export async function uploadExpenseBuffer(
  buffer: Buffer,
  nazev: string,
  typSouboru?: string,
): Promise<{ url: string; name: string } | { error: string } | null> {
  const client = getClient();
  const bucket = process.env.S3_BUCKET;

  if (client && bucket) {
    try {
      const key = `vydaje/${randomUUID()}-${bezpecnyNazev(nazev)}`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: typSouboru || 'application/octet-stream',
        }),
      );
      const endpoint = process.env.S3_ENDPOINT;
      const url = endpoint ? `${endpoint}/${bucket}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;
      return { url, name: nazev };
    } catch (err) {
      console.error('uploadExpenseAttachment: S3 selhalo, ukladam do databaze:', err);
    }
  }

  if (buffer.byteLength > MAX_INLINE_ATTACHMENT_BYTES) {
    return {
      error:
        'Příloha je moc velká (přes 1,5 MB). Zmenšete ji prosím, nebo naskenujte v nižší kvalitě — zatím nemáme nastavené úložiště souborů.',
    };
  }

  const mime = typSouboru || 'application/octet-stream';
  return { url: `data:${mime};base64,${buffer.toString('base64')}`, name: nazev };
}


/** Vygenerovane PDF ulozene rovnou v databazi nesmi nafouknout radek. */
const MAX_INLINE_PDF_BYTES = 3 * 1024 * 1024;

/**
 * Ulozi PDF, ktere si portal vyrobil sam (zatim Rodny list - zadani
 * 9. 9. 2026), a vrati odkaz, pod kterym se da vydat.
 *
 * Stejny princip jako u priloh vydaju a fotek: kdyz je nastavene S3/R2, jde
 * soubor tam pod nahodny klic; kdyz uloziste nastavene neni (coz je zatim na
 * produkci pripad), ulozi se dokument rovnou do databaze jako data URL.
 * Rodny list ma kolem 60 kB, takze to databazi nijak nezatezuje - a hlavne
 * to znamena, ze funkce nikdy nezavisi na tom, jestli uz nekdo doplnil
 * pristupove udaje k uloziti.
 */
export async function uploadGeneratedPdf(
  bytes: Buffer,
  keyPrefix: string,
  fileName: string,
): Promise<{ url: string } | null> {
  const client = getClient();
  const bucket = process.env.S3_BUCKET;

  if (client && bucket) {
    try {
      const key = `${keyPrefix}/${randomUUID()}-${fileName}`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: 'application/pdf',
        }),
      );
      const endpoint = process.env.S3_ENDPOINT;
      const url = endpoint ? `${endpoint}/${bucket}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;
      return { url };
    } catch (err) {
      console.error('uploadGeneratedPdf: S3 selhalo, ukladam PDF do databaze:', err);
    }
  }

  if (bytes.byteLength > MAX_INLINE_PDF_BYTES) {
    console.error(
      `uploadGeneratedPdf: PDF je bez nastaveneho uloziste moc velke (${bytes.byteLength} B), neukladam.`,
    );
    return null;
  }

  return { url: `data:application/pdf;base64,${bytes.toString('base64')}` };
}


/* ---------------------------------------------------------------------------
   Přílohy v MS chatu (zadání 9. 9. 2026)

   Tady se to dělá jinak než u objednávek a výdajů: soubor NEJDE přes portál,
   ale rovnou z prohlížeče do úložiště přes podepsanou adresu.

   Důvod je praktický - funkce na Vercelu mají strop na velikost požadavku
   kolem 4,5 MB. Mediaspace posílá zvukové soubory a fotky, které jsou běžně
   větší, takže přes API by to prostě neprošlo. Podepsaná adresa platí pár
   minut a je jen na zápis jednoho konkrétního klíče.

   Ke stažení se taky nedává trvalá veřejná adresa: v chatu můžou být klientské
   materiály, takže se pokaždé vydá krátkodobý podepsaný odkaz, a to až potom,
   co portál ověří, že do té konverzace uživatel vůbec smí.
--------------------------------------------------------------------------- */

/** Jak dlouho platí podepsaná adresa na nahrání (v sekundách). */
const PLATNOST_UPLOADU = 10 * 60;
/** Jak dlouho platí podepsaný odkaz na stažení. */
const PLATNOST_STAZENI = 5 * 60;

/**
 * Připraví adresu, na kterou prohlížeč pošle soubor. Klíč si vymýšlí server -
 * kdyby si ho určoval prohlížeč, dal by se přepsat cizí soubor.
 */
export async function podepsanyUploadPrilohy(
  fileName: string,
  mime: string,
): Promise<{ key: string; uploadUrl: string } | null> {
  const client = getClient();
  const bucket = process.env.S3_BUCKET;
  if (!client || !bucket) return null;

  const key = `chat/${randomUUID()}-${bezpecnyNazev(fileName)}`;
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mime || 'application/octet-stream',
    }),
    { expiresIn: PLATNOST_UPLOADU },
  );
  return { key, uploadUrl };
}

/**
 * Opravdu ten soubor v úložišti leží, a jak je velký? Volá se před uložením
 * zprávy - prohlížeč hlásí velikost sám, takže se na jeho údaj nespoléháme.
 */
export async function overPrilohu(key: string): Promise<{ size: number; mime: string } | null> {
  const client = getClient();
  const bucket = process.env.S3_BUCKET;
  if (!client || !bucket) return null;

  try {
    const hlavicka = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return {
      size: Number(hlavicka.ContentLength ?? 0),
      mime: hlavicka.ContentType || 'application/octet-stream',
    };
  } catch (err) {
    console.error('overPrilohu: soubor v úložišti není:', err);
    return null;
  }
}

/**
 * Krátkodobý odkaz na přílohu. Původní název dostane uživatel zpátky celý.
 *
 * `jakoPrilohu` rozhoduje, co udělá prohlížeč: false soubor otevře (obrázek
 * se ukáže, PDF se zobrazí), true ho rovnou stáhne. Řídí se tím hlavička
 * Content-Disposition, kterou úložiště pošle - u odkazu na cizí server
 * nestačí atribut download, ten prohlížeč přes hranici domény ignoruje
 * (zadání 9. 9. 2026: "mělo by tam svítit tlačítko stáhnout").
 */
export async function podepsanyOdkazNaPrilohu(
  key: string,
  fileName: string,
  jakoPrilohu = false,
): Promise<string | null> {
  const client = getClient();
  const bucket = process.env.S3_BUCKET;
  if (!client || !bucket) return null;

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `${jakoPrilohu ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(
        fileName,
      )}`,
    }),
    { expiresIn: PLATNOST_STAZENI },
  );
}


/**
 * Zkouska spojeni s uloziste ZE SERVERU (9. 9. 2026).
 *
 * Z prohlizece se chyba uloziste pozna mizerne: odpoved bez hlavicek CORS
 * se ke skriptu vubec nedostane, takze odmitnuty podpis vypada uplne stejne
 * jako spatne nastaveny bucket - obojí konci hláškou "Failed to fetch".
 * Odsud zadne CORS neplati, takze je videt skutecny duvod.
 */
/**
 * Popis klice BEZ jeho hodnoty (9. 9. 2026).
 *
 * Cloudflare na strance tokenu ukazuje tri hodnoty a je snadne popadnout
 * spatnou. Rozeznat je pritom jde uz podle tvaru:
 *   - Access Key ID: 32 znaku, jen 0-9 a a-f,
 *   - Secret Access Key: 64 znaku, jen 0-9 a a-f,
 *   - Token value: kolem 40 znaku, velka i mala pismena, pomlcky.
 * Delka a tvar nic tajneho neprozradi, ale okamzite ukazi, jestli je
 * v poli to spravne.
 */
function popisKlice(hodnota: string | undefined): {
  vyplneno: boolean;
  delka: number;
  jenHex: boolean;
  mezeryNaKraji: boolean;
} {
  const syrove = hodnota ?? '';
  const orezane = syrove.trim();
  return {
    vyplneno: orezane.length > 0,
    delka: orezane.length,
    jenHex: /^[0-9a-f]+$/i.test(orezane),
    mezeryNaKraji: syrove !== orezane,
  };
}

export async function zkusUloziste(): Promise<{
  ok: boolean;
  server: string | null;
  bucket: string | null;
  cestaSBucketem: boolean;
  klice: {
    accessKeyId: ReturnType<typeof popisKlice>;
    secretAccessKey: ReturnType<typeof popisKlice>;
    ocekavano: string;
  };
  pocetSouboru?: number;
  chyba?: string;
  kod?: string;
}> {
  const klice = {
    accessKeyId: popisKlice(process.env.S3_ACCESS_KEY_ID),
    secretAccessKey: popisKlice(process.env.S3_SECRET_ACCESS_KEY),
    ocekavano: 'U Cloudflare R2: Access Key ID = 32 znaků hex, Secret Access Key = 64 znaků hex.',
  };
  const bucket = process.env.S3_BUCKET || null;
  const endpoint = ocistiEndpoint(process.env.S3_ENDPOINT);
  let server: string | null = null;
  try {
    server = endpoint ? new URL(endpoint).hostname : '(AWS S3)';
  } catch {
    server = '(neplatná adresa)';
  }

  const client = getClient();
  if (!client || !bucket) {
    return {
      ok: false,
      server,
      bucket,
      cestaSBucketem: Boolean(endpoint),
      klice,
      chyba: 'Úložiště není nastavené (chybí klíče, bucket nebo je adresa neplatná).',
    };
  }

  try {
    // Vypis jednoho souboru staci - overi klice, adresu i pristup k bucketu,
    // a pritom nic nezapisuje.
    const odpoved = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
    return {
      ok: true,
      server,
      bucket,
      cestaSBucketem: Boolean(endpoint),
      klice,
      pocetSouboru: odpoved.KeyCount ?? 0,
    };
  } catch (err) {
    const chyba = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    return {
      ok: false,
      server,
      bucket,
      cestaSBucketem: Boolean(endpoint),
      klice,
      chyba: chyba?.message || 'Neznámá chyba.',
      kod: `${chyba?.name || '?'} / HTTP ${chyba?.$metadata?.httpStatusCode ?? '?'}`,
    };
  }
}

/** Printscreen u připomínky uložený v databázi nesmí nafouknout řádek. */
const MAX_INLINE_SCREENSHOT_BYTES = 900 * 1024;

/**
 * Printscreen k připomínce k portálu (zadání 15. 9. 2026: „s možností, že by
 * mohli přiložit i printscreeny").
 *
 * Stejný princip jako u příloh výdajů a fotek: když je nastavené S3/R2, jde
 * obrázek tam; když ne, uloží se jako data URL do databáze. Prohlížeč ho před
 * odesláním zmenší na 1600 px na šířku, takže jde o desítky až stovky kB.
 */
export async function uploadPripominkaObrazek(
  buffer: Buffer,
  nazev: string,
  typSouboru?: string,
): Promise<{ url: string; name: string } | { error: string }> {
  const client = getClient();
  const bucket = process.env.S3_BUCKET;

  if (client && bucket) {
    try {
      const key = `pripominky/${randomUUID()}-${bezpecnyNazev(nazev)}`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: typSouboru || 'image/png',
        }),
      );
      const endpoint = process.env.S3_ENDPOINT;
      const url = endpoint ? `${endpoint}/${bucket}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;
      return { url, name: nazev };
    } catch (err) {
      console.error('uploadPripominkaObrazek: S3 selhalo, ukladam do databaze:', err);
    }
  }

  if (buffer.byteLength > MAX_INLINE_SCREENSHOT_BYTES) {
    return { error: 'Obrázek je moc velký. Zkuste ho oříznout jen na tu část obrazovky, o kterou jde.' };
  }

  const mime = typSouboru || 'image/png';
  return { url: `data:${mime};base64,${buffer.toString('base64')}`, name: nazev };
}


/**
 * ZKOUŠKA NAHRÁVÁNÍ PŘES PODEPSANOU ADRESU (21. 9. 2026: „v chatu nejde
 * příloha").
 *
 * Přílohy chatu jdou z prohlížeče rovnou do úložiště. Když to selže,
 * prohlížeč řekne jen „Failed to fetch" a nedá se poznat, jestli vadí CORS
 * u bucketu, nebo podpis. Tady se obojí zkusí ZE SERVERU, kde CORS neplatí:
 *
 *  1. PŘEDLET (OPTIONS) s hlavičkou Origin portálu - úložiště odpoví podle
 *     svého nastavení CORS, takže je vidět, jestli PUT z portálu vůbec pustí.
 *  2. PUT na podepsanou adresu úplně stejně jako chat (malý textový soubor).
 *     Když projde, podpis je v pořádku; soubor se hned zase smaže.
 *
 * Nevrací žádné tajné hodnoty - z podepsané adresy jen JMÉNA parametrů.
 */
export async function zkusNahravani(): Promise<{
  ok: boolean;
  parametryPodpisu?: string[];
  predlet?: { origin: string; status: number; povolenyOrigin: string | null; povoleneMetody: string | null; povoleneHlavicky: string | null }[];
  nahrani?: { status: number; odpoved: string };
  uklid?: string;
  chyba?: string;
}> {
  const client = getClient();
  const bucket = process.env.S3_BUCKET;
  if (!client || !bucket) return { ok: false, chyba: 'Úložiště není nastavené.' };

  const key = `chat/_zkouska-${randomUUID()}.txt`;
  try {
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'text/plain' }),
      { expiresIn: 120 },
    );
    const parametryPodpisu = Array.from(new URL(uploadUrl).searchParams.keys()).sort();

    // 1) Předlet z obou adres portálu - s www i bez.
    const predlet: {
      origin: string;
      status: number;
      povolenyOrigin: string | null;
      povoleneMetody: string | null;
      povoleneHlavicky: string | null;
    }[] = [];
    for (const origin of ['https://www.msportal.cz', 'https://msportal.cz']) {
      try {
        const r = await fetch(uploadUrl, {
          method: 'OPTIONS',
          headers: {
            Origin: origin,
            'Access-Control-Request-Method': 'PUT',
            'Access-Control-Request-Headers': 'content-type',
          },
        });
        predlet.push({
          origin,
          status: r.status,
          povolenyOrigin: r.headers.get('access-control-allow-origin'),
          povoleneMetody: r.headers.get('access-control-allow-methods'),
          povoleneHlavicky: r.headers.get('access-control-allow-headers'),
        });
      } catch (err) {
        predlet.push({ origin, status: 0, povolenyOrigin: null, povoleneMetody: null, povoleneHlavicky: String(err).slice(0, 120) });
      }
    }

    // 2) Nahrání stejně jako z chatu.
    const r = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain', Origin: 'https://www.msportal.cz' },
      body: 'zkouska nahravani z portalu',
    });
    const nahrani = { status: r.status, odpoved: (await r.text()).slice(0, 400) };

    let uklid = 'nebylo co mazat';
    if (r.ok) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        uklid = 'zkušební soubor smazán';
      } catch (err) {
        uklid = `zkušební soubor se nepodařilo smazat (${key}): ${String(err).slice(0, 120)}`;
      }
    }

    const corsPusti = predlet.some((p) => p.status >= 200 && p.status < 300 && p.povolenyOrigin);
    return { ok: r.ok && corsPusti, parametryPodpisu, predlet, nahrani, uklid };
  } catch (err) {
    return { ok: false, chyba: err instanceof Error ? err.message : String(err) };
  }
}
