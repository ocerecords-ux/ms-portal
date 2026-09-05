import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

function getClient() {
  const { S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT } = process.env;
  if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;

  return new S3Client({
    region: S3_REGION || 'eu-central-1',
    endpoint: S3_ENDPOINT || undefined, // prazdne = AWS S3, jinak napr. Cloudflare R2
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });
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

/**
 * Ulozi fotku uzivatele (sekce Mediaspace v adminu, zadani 5. 9. 2026) -
 * stejny princip jako uploadOrderAttachment: pokud uloziste jeste neni
 * nakonfigurovane, nahravani se jen tise preskoci a ucet se ulozi bez fotky.
 */
export async function uploadUserPhoto(file: File): Promise<string | null> {
  const client = getClient();
  const bucket = process.env.S3_BUCKET;
  if (!client || !bucket) return null;

  const buffer = Buffer.from(await file.arrayBuffer());
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
}
