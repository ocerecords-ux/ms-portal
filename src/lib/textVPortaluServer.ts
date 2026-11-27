import { prisma } from '@/lib/db';
import { getAccessToken } from '@/lib/googleDrive';
import { nactiZDisku } from '@/lib/preposlechDriveServer';

/**
 * TEXTY V PORTÁLU, NE NA DISKU (zadání 27. 11. 2026: „chtěl bych to do
 * budoucna udělat tak, aby všechny texty byly v portálu a nenačítaly se
 * z disku. Pojďme teď udělat mezikrok, že všechny aktivní projekty, které
 * mají RE text na disku, ať si ho jednou načtou a uloží se. Aby se
 * nezasekávaly texty při poslechu v AudioTaggeru").
 *
 * PROČ: PDF se do teď pokaždé táhlo přes Google API. Při poslechu si o něj
 * prohlížeč řekne současně se stopami, Disk odpovídá různě rychle a text se
 * zasekával - nejhůř zrovna když ho někdo potřeboval číst.
 *
 * JAK: kopie PDF leží v databázi (model TextProjektu) a portál ji vydává sám.
 * Zdrojem pravdy zůstává režijní edit na Disku; nová verze se pozná podle
 * času změny a kopie se přepíše. Je to MEZIKROK - až se texty budou do
 * portálu rovnou nahrávat, zmizí z téhle cesty jen to stahování.
 */

/** Větší PDF do databáze netaháme - to je scan, ne text. */
const MAX_BAJTU = 25 * 1024 * 1024;

export type UlozenyText = {
  driveFileId: string;
  nazev: string;
  velikost: number;
  zmenenoNaDisku: Date | null;
};

/** Hlavička uloženého textu (bez obsahu) - na rozhodování, jestli je aktuální. */
export async function ulozenyText(caflouProjectId: string): Promise<UlozenyText | null> {
  try {
    const radek = (await prisma.textProjektu.findUnique({
      where: { caflouProjectId },
      select: { driveFileId: true, nazev: true, velikost: true, zmenenoNaDisku: true },
    })) as UlozenyText | null;
    return radek;
  } catch {
    // Tabulka ještě nemusí existovat (první nasazení) - portál si text
    // prostě vezme z Disku jako dřív.
    return null;
  }
}

/** Obsah uloženého textu. `null` = v portálu zatím není. */
export async function obsahTextu(
  caflouProjectId: string,
): Promise<{ nazev: string; data: Buffer } | null> {
  try {
    const radek = (await prisma.textProjektu.findUnique({
      where: { caflouProjectId },
      select: { nazev: true, obsah: true },
    })) as { nazev: string; obsah: Buffer } | null;
    if (!radek?.obsah) return null;
    return { nazev: radek.nazev, data: Buffer.from(radek.obsah) };
  } catch (err) {
    console.error('Uložený text se nepodařilo načíst:', err);
    return null;
  }
}

/** Stáhne PDF z Disku a uloží ho do portálu. Vrací, jestli se to povedlo. */
export async function stahniTextDoPortalu(
  caflouProjectId: string,
  text: { id: string; name: string; zmeneno: string | null },
  token: string,
): Promise<boolean> {
  try {
    const odpoved = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(text.id)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!odpoved.ok) {
      console.error(`Text projektu ${caflouProjectId} se nepodařilo stáhnout:`, odpoved.status);
      return false;
    }
    const data = Buffer.from(await odpoved.arrayBuffer());
    if (data.length === 0 || data.length > MAX_BAJTU) {
      console.warn(`Text projektu ${caflouProjectId} se neukládá - má ${data.length} B.`);
      return false;
    }
    const zmeneno = text.zmeneno ? new Date(text.zmeneno) : null;
    await prisma.textProjektu.upsert({
      where: { caflouProjectId },
      create: {
        caflouProjectId,
        driveFileId: text.id,
        nazev: text.name,
        zmenenoNaDisku: zmeneno && !Number.isNaN(zmeneno.getTime()) ? zmeneno : null,
        velikost: data.length,
        obsah: data,
      },
      update: {
        driveFileId: text.id,
        nazev: text.name,
        zmenenoNaDisku: zmeneno && !Number.isNaN(zmeneno.getTime()) ? zmeneno : null,
        velikost: data.length,
        obsah: data,
        nactenoAt: new Date(),
      },
    });
    return true;
  } catch (err) {
    console.error(`Text projektu ${caflouProjectId} se nepodařilo uložit:`, err);
    return false;
  }
}

/** Je uložená kopie pořád ta, co leží na Disku? */
function jeAktualni(ulozeny: UlozenyText | null, text: { id: string; zmeneno: string | null }): boolean {
  if (!ulozeny) return false;
  if (ulozeny.driveFileId !== text.id) return false;
  if (!text.zmeneno) return true;
  const naDisku = new Date(text.zmeneno);
  if (Number.isNaN(naDisku.getTime())) return true;
  return ulozeny.zmenenoNaDisku !== null && ulozeny.zmenenoNaDisku.getTime() >= naDisku.getTime();
}

export type VysledekPrenosu = 'ulozeno' | 'uz-bylo' | 'bez-textu' | 'nepovedlo';

/**
 * Zajistí, že text projektu je v portálu. Volá to úloha i routy, když na
 * uloženou kopii narazí poprvé.
 */
export async function zajistiTextVPortalu(caflouProjectId: string): Promise<VysledekPrenosu> {
  const zDisku = await nactiZDisku(caflouProjectId).catch(() => null);
  if (!zDisku || !zDisku.ok || !zDisku.text) return 'bez-textu';

  const ulozeny = await ulozenyText(caflouProjectId);
  if (jeAktualni(ulozeny, zDisku.text)) return 'uz-bylo';

  const token = await getAccessToken();
  if (!token) return 'nepovedlo';
  return (await stahniTextDoPortalu(caflouProjectId, zDisku.text, token)) ? 'ulozeno' : 'nepovedlo';
}

export type VysledekUlohy = {
  zkouseno: number;
  ulozeno: number;
  uzBylo: number;
  bezTextu: number;
  nepovedlo: number;
};

/**
 * JEDNA DÁVKA PŘENOSU. Bere aktivní projekty, u kterých se to zkoušelo
 * nejdéle (a ty, u kterých ještě nikdy), takže se úloha postupně prokouše
 * všemi a pak už jen hlídá, jestli na Disku nepřibyla novější verze.
 *
 * Malá dávka schválně: každý projekt znamená výpis složky na Disku a stažení
 * PDF, a funkce na Vercelu má svůj čas.
 */
export async function preneseTextyDoPortalu(limit = 6): Promise<VysledekUlohy> {
  const vysledek: VysledekUlohy = { zkouseno: 0, ulozeno: 0, uzBylo: 0, bezTextu: 0, nepovedlo: 0 };

  const projekty = (await prisma.projectMeta
    .findMany({
      where: { finished: false },
      orderBy: [{ textZkusenoAt: { sort: 'asc', nulls: 'first' } }],
      take: Math.max(1, Math.min(limit, 20)),
      select: { caflouProjectId: true },
    })
    .catch(() => [])) as { caflouProjectId: string }[];

  for (const p of projekty) {
    vysledek.zkouseno += 1;
    const stav = await zajistiTextVPortalu(p.caflouProjectId);
    if (stav === 'ulozeno') vysledek.ulozeno += 1;
    else if (stav === 'uz-bylo') vysledek.uzBylo += 1;
    else if (stav === 'bez-textu') vysledek.bezTextu += 1;
    else vysledek.nepovedlo += 1;

    // Razítko se píše vždycky - i když text není. Jinak by se úloha u pár
    // projektů bez textu zacyklila a na zbytek se nedostala.
    await prisma.projectMeta
      .update({ where: { caflouProjectId: p.caflouProjectId }, data: { textZkusenoAt: new Date() } })
      .catch(() => null);
  }

  return vysledek;
}
