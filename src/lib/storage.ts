import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { bezpecnyNazev } from '@/lib/chatPrilohy';

/**
 * Adresa uloziste se z Cloudflare kopiruje rucne, takze snesme drobne
 * preklepy: chybejici https:// a lomitko na konci. Spatne slozena adresa
 * jinak shodi cely klient uz pri sestaveni (9. 9. 2026).
 */
function ocistiEndpoint(hodnota: string | undefined): string | undefined {
  const text = (hodnota || '').trim().replace(/\/+$/, '');
  if (!text) return undefined;
  const sProtokolem = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  // Nevyplneny zastupny text z navodu - snadny preklep pri kopirovani.
  if (/[<>{}\s]/.test(sProtokolem) || /account_id|ucet_id|yourbucket/i.test(sProtokolem)) {
    console.error(`S3_ENDPOINT vypada jako nevyplneny vzor: "${hodnota}"`);
    return undefined;
  }
  try {
    new URL(sProtokolem);
    return sProtokolem;
  } catch {
    console.error(`S3_ENDPOINT neni platna adresa: "${hodnota}"`);
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

  return new S3Client({
    region: S3_REGION || (jeR2 ? 'auto' : 'eu-central-1'),
    endpoint, // prazdne = AWS S3, jinak napr. Cloudflare R2
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });
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

  const endpoint = process.env.S3_ENDPOINT;
  const url = endpoint ? `${endpoint}/${bucket}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;

  return { url, name: file.name };
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
  const client = getClient();
  const bucket = process.env.S3_BUCKET;

  if (client && bucket) {
    try {
      const key = `vydaje/${randomUUID()}-${file.name}`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: file.type || 'application/octet-stream',
        }),
      );
      const endpoint = process.env.S3_ENDPOINT;
      const url = endpoint ? `${endpoint}/${bucket}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;
      return { url, name: file.name };
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

  const mime = file.type || 'application/octet-stream';
  return { url: `data:${mime};base64,${buffer.toString('base64')}`, name: file.name };
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

/** Krátkodobý odkaz ke stažení. Původní název dostane uživatel zpátky celý. */
export async function podepsanyOdkazNaPrilohu(key: string, fileName: string): Promise<string | null> {
  const client = getClient();
  const bucket = process.env.S3_BUCKET;
  if (!client || !bucket) return null;

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }),
    { expiresIn: PLATNOST_STAZENI },
  );
}
