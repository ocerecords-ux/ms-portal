import { createSign } from 'crypto';

// Cteni obsahu Google Disku pro sekci "Nahravky". Autentizace bezi pres
// servisni ucet (email + soukromy klic v env promennych) - zadny klient
// portalu se nemusi k Disku prihlasovat sam. Admin MEDIA SPACE musi kazdou
// klientskou slozku (nebo nadrazenou slozku se vsemi klienty) nasdilet
// e-mailu servisniho uctu jako "Prohlizejici".
//
// DULEZITE - tenant izolace: klient smi videt jen svou slozku a jeji
// potomky. Kazdy pozadavek na konkretni ID (list i download) proto overuje
// funkce isWithinRoot(), ktera projde retezec rodicu az ke korenove slozce
// firmy. Bez tohoto by si klient mohl jen tak vyzadat cizi ID a stahnout
// soubor jine firmy.

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string;
  webViewLink: string | null;
  isFolder: boolean;
};

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Ziska pristupovy token servisniho uctu. Vraci null, pokud env promenne
 * GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY jeste
 * nejsou nastavene - volajici pak ma zobrazit puvodni jednoduchy odkaz.
 */
export async function getAccessToken(): Promise<string | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  // GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY muze byt bud primo PEM text (s \n
  // escapy misto skutecnych zalomeni radku), nebo - spolehlivejsi varianta,
  // kterou se pri rucnim vkladani do Vercelu nic nemuze poskodit - cely PEM
  // zakodovany jako jeden radek v base64.
  const privateKey = rawKey.includes('BEGIN PRIVATE KEY')
    ? rawKey.replace(/\\n/g, '\n')
    : Buffer.from(rawKey, 'base64').toString('utf-8');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;

  let signature: Buffer;
  try {
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    signature = signer.sign(privateKey);
  } catch (err) {
    console.error('Google Drive: podpis JWT selhal (zkontrolujte GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY):', err);
    return null;
  }

  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('Google Drive: ziskani access tokenu selhalo', await res.text().catch(() => ''));
    return null;
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

// Z ruzne tvarovanych Google Disk odkazu (/folders/ID, ?id=ID) vytahneme ID slozky.
export function extractDriveFolderId(url: string): string | null {
  const patterns = [/\/folders\/([a-zA-Z0-9_-]{10,})/, /[?&]id=([a-zA-Z0-9_-]{10,})/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function listFolder(folderId: string, token: string): Promise<DriveItem[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
    orderBy: 'folder,name_natural',
    pageSize: '300',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Drive list selhal: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const data = (await res.json()) as { files?: any[] };
  return (data.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ?? null,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink ?? null,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
  }));
}

export async function getFileMeta(
  fileId: string,
  token: string,
): Promise<{ id: string; name: string; mimeType: string; parents: string[] } | null> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?fields=id,name,mimeType,parents&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { id: data.id, name: data.name, mimeType: data.mimeType, parents: data.parents ?? [] };
}

/**
 * Tenant izolace: overi, ze pozadovane ID je skutecne potomkem korenove
 * slozky firmy (rootId) - klient si tak nemuze vyzadat cizi soubor jen tim,
 * ze do dotazu vlozi jine ID.
 *
 * Puvodne se overovalo "zdola nahoru" - files.get na cilove ID a cteni jeho
 * pole parents, opakovane az ke korenu. V praxi to ale u podslozek/souboru
 * hlasilo "K teto slozce nemate pristup", i kdyz byla polozka viditelne
 * vracena jako potomek korenove slozky pri normalnim vypisu (listFolder) -
 * pole parents ziskane pres samostatny files.get na cilove ID neni pro
 * nektere sdilene polozky stejne spolehlive jako vypis pres query
 * "'X' in parents", ktery uz mame overene jako funkcni (jinak by se
 * nezobrazil ani korenovy vypis). Overeni proto delame "shora dolu" - BFS
 * z jiz funkcni korenove slozky pomoci stejne funkce (listFolder), misto
 * spolehu na getFileMeta/parents ciloveho ID.
 */
export async function isWithinRoot(id: string, rootId: string, token: string, maxNodes = 500): Promise<boolean> {
  if (id === rootId) return true;
  const queue: string[] = [rootId];
  const visited = new Set<string>([rootId]);
  let visitedNodes = 0;
  while (queue.length > 0 && visitedNodes < maxNodes) {
    const current = queue.shift()!;
    let children: DriveItem[];
    try {
      children = await listFolder(current, token);
    } catch (err) {
      console.error('isWithinRoot: vypis slozky pri overovani prislusnosti selhal', current, err);
      continue;
    }
    visitedNodes++;
    for (const child of children) {
      if (child.id === id) return true;
      if (child.isFolder && !visited.has(child.id)) {
        visited.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return false;
}
