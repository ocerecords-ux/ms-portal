import { prisma } from '@/lib/db';
import { extractDriveFolderId, getAccessToken, listFolder, type DriveItem } from '@/lib/googleDrive';

/**
 * Nahrávky a text pro přeposlech, načtené rovnou ze složky projektu na Disku
 * (zadání 11. 9. 2026: „audiotagger si automaticky šáhne do složky projektu
 * a natáhne si nahrávky").
 *
 * DVĚ DOHODNUTÁ PRAVIDLA POJMENOVÁNÍ, na kterých to stojí:
 *  1. stopy se značí pořadím na začátku názvu — `01_jméno`, `02_…`, `03_…`
 *     Z toho se bere pořadí, a tedy i offset na časové ose Cubase.
 *  2. text je PDF, jehož název končí `_RE` (režijní edit) — to je ta správná
 *     verze. Když takové PDF ve složce není, vezme se jediné PDF; když je jich
 *     víc a žádné nekončí _RE, radši se nebere žádné a řekne se to.
 */

const ZVUKOVE_PRIPONY = ['.wav', '.mp3', '.m4a', '.aac', '.flac', '.aif', '.aiff', '.ogg', '.opus'];

export type StopaZDisku = {
  id: string;
  name: string;
  /** Pořadí z názvu (01_ → 1). Když v názvu není, přijde až za očíslované. */
  poradi: number | null;
  /** Velikost v bajtech, když ji Disk hlásí. */
  velikost: number | null;
  mime: string;
};

export type PreposlechZDisku =
  | {
      ok: true;
      slozkaId: string;
      slozkaUrl: string | null;
      stopy: StopaZDisku[];
      text: { id: string; name: string } | null;
      /** Proč text není, když není - ať se člověk nediví prázdnému panelu. */
      poznamkaKTextu: string | null;
    }
  | { ok: false; duvod: string };

function jeZvuk(item: DriveItem): boolean {
  if (item.isFolder) return false;
  if (item.mimeType?.startsWith('audio/')) return true;
  const nazev = item.name.toLowerCase();
  return ZVUKOVE_PRIPONY.some((p) => nazev.endsWith(p));
}

/** "03_Kapitola tri.wav" -> 3; "mix.wav" -> null */
function poradiZNazvu(name: string): number | null {
  const shoda = /^(\d{1,3})\s*[_\-.)]/.exec(name.trim());
  if (!shoda) return null;
  const cislo = Number(shoda[1]);
  return Number.isFinite(cislo) && cislo > 0 ? cislo : null;
}

/** Název bez přípony - kvůli koncovce _RE. */
function bezPripony(name: string): string {
  const tecka = name.lastIndexOf('.');
  return tecka > 0 ? name.slice(0, tecka) : name;
}

/** Složka projektu; když ji projekt nemá, zkusí se složka firmy. */
export async function slozkaProjektu(
  caflouProjectId: string,
): Promise<{ id: string; url: string; vlastni: boolean } | null> {
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: { driveUrl: true, company: { select: { driveFolderUrl: true } } },
  });
  if (!meta) return null;

  const vlastni = meta.driveUrl ? extractDriveFolderId(meta.driveUrl) : null;
  if (vlastni && meta.driveUrl) return { id: vlastni, url: meta.driveUrl, vlastni: true };

  const firemni = meta.company?.driveFolderUrl ? extractDriveFolderId(meta.company.driveFolderUrl) : null;
  if (firemni && meta.company?.driveFolderUrl) {
    return { id: firemni, url: meta.company.driveFolderUrl, vlastni: false };
  }
  return null;
}

export async function nactiZDisku(caflouProjectId: string): Promise<PreposlechZDisku> {
  const slozka = await slozkaProjektu(caflouProjectId);
  if (!slozka) {
    return { ok: false, duvod: 'Projekt nemá vyplněný odkaz na složku na Disku.' };
  }

  const token = await getAccessToken();
  if (!token) {
    return { ok: false, duvod: 'Napojení na Google Disk zatím není nastavené.' };
  }

  let obsah: DriveItem[];
  try {
    obsah = await listFolder(slozka.id, token);
  } catch (err) {
    console.error('Nacteni slozky projektu selhalo:', err);
    return { ok: false, duvod: 'Obsah složky se nepodařilo načíst.' };
  }

  // Poradi: nejdriv ocislovane podle cisla, pak zbytek podle nazvu. Cislo
  // z nazvu je jediny zdroj pravdy - Disk radi po svem a na tom se stavet neda.
  const stopy: StopaZDisku[] = obsah
    .filter(jeZvuk)
    .map((item) => ({
      id: item.id,
      name: item.name,
      poradi: poradiZNazvu(item.name),
      velikost: item.size ? Number(item.size) : null,
      mime: item.mimeType,
    }))
    .sort((a, b) => {
      if (a.poradi !== null && b.poradi !== null) return a.poradi - b.poradi;
      if (a.poradi !== null) return -1;
      if (b.poradi !== null) return 1;
      return a.name.localeCompare(b.name, 'cs', { numeric: true });
    });

  const pdfka = obsah.filter((i) => !i.isFolder && i.name.toLowerCase().endsWith('.pdf'));
  const rezijni = pdfka.filter((i) => bezPripony(i.name).toUpperCase().endsWith('_RE'));

  let text: { id: string; name: string } | null = null;
  let poznamkaKTextu: string | null = null;
  if (rezijni.length > 0) {
    // Kdyz je rezijnich editu vic, bere se ten naposledy zmeneny.
    const vybrany = [...rezijni].sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))[0];
    text = { id: vybrany.id, name: vybrany.name };
  } else if (pdfka.length === 1) {
    text = { id: pdfka[0].id, name: pdfka[0].name };
    poznamkaKTextu = 'Ve složce není žádné PDF končící _RE, tak se vzalo to jediné, které tam je.';
  } else if (pdfka.length > 1) {
    poznamkaKTextu =
      'Ve složce je víc PDF a žádné nekončí _RE, tak portál nehádá, které je režijní edit — vyberte ho ručně.';
  } else {
    poznamkaKTextu = 'Ve složce zatím není žádné PDF s textem.';
  }

  return {
    ok: true,
    slozkaId: slozka.id,
    slozkaUrl: slozka.url,
    stopy,
    text,
    poznamkaKTextu,
  };
}
