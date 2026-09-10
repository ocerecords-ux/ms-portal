import { createSign } from 'crypto';

// Cteni obsahu Google Disku pro sekci "Nahravky". Autentizace bezi pres
// servisni ucet (email + soukromy klic v env promennych) - zadny klient
// portalu se nemusi k Disku prihlasovat sam. Admin Mediaspace musi kazdou
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

/** Rozsah pro cteni Disku - s nim se portal chova jako doted. */
export const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
/** Sirsi rozsah, ktery umi i zapis - potrebuje ho ukladani Rodneho listu. */
export const DRIVE_WRITE_SCOPE = 'https://www.googleapis.com/auth/drive';

// Token si drzime zvlast pro kazdy rozsah - jinak by se pro zapis pouzil
// token vydany jen ke cteni a Google by nahrani odmitl.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Ziska pristupovy token servisniho uctu. Vraci null, pokud env promenne
 * GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY jeste
 * nejsou nastavene - volajici pak ma zobrazit puvodni jednoduchy odkaz.
 */
export async function getAccessToken(scope: string = DRIVE_READONLY_SCOPE): Promise<string | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) return null;

  const cached = tokenCache.get(scope);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token;
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
    scope,
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

  tokenCache.set(scope, { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 });
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

/** Zakladni udaje o slozce - pouziva se pro odkaz na celou slozku v sekci Nahravky. */
export async function getFolderInfo(
  folderId: string,
  token: string,
): Promise<{ id: string; name: string; webViewLink: string | null } | null> {
  const res = await fetch(
    `${DRIVE_API}/files/${folderId}?fields=id,name,webViewLink&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return { id: data.id, name: data.name, webViewLink: data.webViewLink ?? null };
}

/**
 * Prejmenovani souboru nebo slozky na Disku (zadani 5. 9. 2026 - prejmenovani
 * dvojklikem na nazev). Volajici MUSI predem overit, ze polozka lezi uvnitr
 * korenove slozky firmy (isWithinRoot) - jinak by sel prejmenovat cizi soubor.
 */
export async function renameDriveItem(
  fileId: string,
  name: string,
  token: string,
): Promise<{ id: string; name: string } | null> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?supportsAllDrives=true&fields=id,name`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    console.error('Drive rename selhal:', res.status, await res.text().catch(() => ''));
    return null;
  }
  const data = await res.json();
  return { id: data.id, name: data.name };
}

/**
 * Zalozi slozku projektu uvnitr slozky firmy (zadani 10. 9. 2026: "ta slozka
 * na disku by se mohla vytvorit automaticky, kdyz se bude zakladat novy
 * projekt a rovnou se sama zapsat").
 *
 * Vraci odkaz na novou slozku, nebo duvod, proc to neslo. NEVYHAZUJE -
 * zalozeni projektu nesmi spadnout kvuli tomu, ze Disk zrovna nespolupracuje;
 * odkaz se pak doplni rucne.
 *
 * POZOR NA PRAVA: servisni ucet portalu musi mit ve slozce firmy pravo
 * Editor. U klientskych slozek byva jen Prohlizejici a Google pak zalozeni
 * odmitne s chybou 403.
 */
export async function vytvorSlozkuProjektu(
  slozkaFirmyUrl: string,
  nazev: string,
): Promise<{ url: string; id: string } | { chyba: string }> {
  const rodicId = extractDriveFolderId(slozkaFirmyUrl);
  if (!rodicId) return { chyba: 'Odkaz na složku firmy nevypadá jako složka na Google Disku.' };

  const cistyNazev = nazev.trim().replace(/[\\/]/g, '-').slice(0, 200);
  if (!cistyNazev) return { chyba: 'Projekt nemá název, podle kterého by se složka pojmenovala.' };

  try {
    const token = await getAccessToken(DRIVE_WRITE_SCOPE);
    if (!token) return { chyba: 'Portál se nedokázal přihlásit ke Google Disku.' };

    const res = await fetch(`${DRIVE_API}/files?supportsAllDrives=true&fields=id,webViewLink`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cistyNazev,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rodicId],
      }),
    });

    if (!res.ok) {
      const stav = res.status;
      console.error('Zalozeni slozky na Disku selhalo:', stav);
      return {
        chyba:
          stav === 403
            ? 'Google Disk založení složky odmítl - servisní účet portálu nemá ve složce firmy právo Editor.'
            : `Google Disk odpověděl chybou ${stav}.`,
      };
    }

    const data = (await res.json()) as { id?: string; webViewLink?: string };
    if (!data.id) return { chyba: 'Google Disk nevrátil ID nové složky.' };
    return { id: data.id, url: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}` };
  } catch (err) {
    console.error('Zalozeni slozky na Disku spadlo:', err);
    return { chyba: 'Složku na Disku se nepodařilo založit.' };
  }
}

/**
 * Prejmenuje slozku projektu podle noveho nazvu projektu (zadani 10. 9. 2026).
 * Stejne jako zalozeni: nikdy nevyhazuje, jen rekne, jestli to vyslo.
 */
export async function prejmenujSlozkuProjektu(slozkaUrl: string, novyNazev: string): Promise<boolean> {
  const id = extractDriveFolderId(slozkaUrl);
  const cistyNazev = novyNazev.trim().replace(/[\\/]/g, '-').slice(0, 200);
  if (!id || !cistyNazev) return false;
  try {
    const token = await getAccessToken(DRIVE_WRITE_SCOPE);
    if (!token) return false;
    return Boolean(await renameDriveItem(id, cistyNazev, token));
  } catch (err) {
    console.error('Prejmenovani slozky na Disku spadlo:', err);
    return false;
  }
}

/**
 * Nahraje hotove PDF do slozky projektu na Google Disku (zadani 9. 9. 2026 -
 * "uloz PDF do projektove slozky na nakonfigurovanem disku").
 *
 * ZAMERNE JE TO "BEST EFFORT" a vraci null misto vyjimky. Servisni ucet je
 * u klientskych slozek nasdileny jako Prohlizejici, takze zapis muze skoncit
 * chybou 403 - a Rodny list se kvuli tomu nesmi nevyrobit. Dokument se vzdy
 * uklada i k nam (viz lib/storage.ts) a odkaz v portalu i v mailu klientovi
 * vede tam, aby nikdy nekoukal na rozbity odkaz. Az bude slozka nasdilena
 * jako Editor, zacne fungovat i kopie na Disku, bez zasahu do kodu.
 *
 * Nahravaji se VYHRADNE vygenerovana PDF - zvukove soubory portal na Disk
 * nikdy nekopiruje ani nepresouva, nahravky uz tam v tuhle chvili jsou.
 */
export async function uploadPdfToDriveFolder(
  folderUrl: string,
  fileName: string,
  bytes: Buffer,
): Promise<{ id: string; webViewLink: string | null } | null> {
  const folderId = extractDriveFolderId(folderUrl);
  if (!folderId) return null;

  const token = await getAccessToken(DRIVE_WRITE_SCOPE);
  if (!token) return null;

  try {
    const boundary = `mediaspace-${Date.now()}`;
    const metadata = JSON.stringify({ name: fileName, parents: [folderId], mimeType: 'application/pdf' });
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
          `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
        'utf-8',
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'),
    ]);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      console.error('Google Drive: nahrani PDF selhalo', res.status, await res.text().catch(() => ''));
      return null;
    }

    const data = (await res.json()) as { id?: string; webViewLink?: string };
    if (!data.id) return null;
    return { id: data.id, webViewLink: data.webViewLink ?? null };
  } catch (err) {
    console.error('Google Drive: nahrani PDF selhalo:', err);
    return null;
  }
}
