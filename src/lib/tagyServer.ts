import { prisma } from '@/lib/db';
import { getAccessToken, listFolder, type DriveItem } from '@/lib/googleDrive';
import { slozkaProjektu } from '@/lib/preposlechDriveServer';

/**
 * TAGY FINÁLNÍ NAHRÁVKY (zadání 14. 10. 2026: „potřebuju nějak pořešit to,
 * abychom mohli finální nahrávku otagovat. Mělo by to fungovat u Albatrosu
 * jen zatím").
 *
 * JAK TO STOJÍ: společné údaje (autor, album, herec, rok, žánr, vydavatel) se
 * zadají JEDNOU u projektu a zapíšou se do všech stop. Jediné, co se liší kus
 * od kusu, je název stopy - ten se bere z reálného názvu souboru a dá se
 * opravit (typicky doplnit diakritiku), viz model TagStopa.
 *
 * SOUBORY SE NEPŘESOUVAJÍ ANI NEKOPÍRUJÍ. Značka se přepíše rovnou ve složce
 * projektu na Disku, soubor si nechává své ID i jméno - viz
 * googleDrive.prepisObsahSouboru.
 *
 * ZATÍM JEN MP3. ID3 je formát MP3; WAV i M4A mají vlastní systém značek
 * a každý trochu jinak čitelný. Až to bude potřeba, přibydou vedle.
 */

/** Jen tyhle soubory umíme otagovat. */
const PRIPONY = ['.mp3'];

export type StopaKTagovani = {
  driveFileId: string;
  nazevSouboru: string;
  velikost: number | null;
  /** Číslo stopy - z názvu souboru, jinak pořadí ve složce. */
  cislo: number;
  /** Název do tagu. Uložená oprava, jinak odvozeno z názvu souboru. */
  title: string;
  /** Uložený title už někdo opravil - ať se pozná, co je ruční a co odhad. */
  ulozeno: boolean;
  zapsanoAt: string | null;
};

export type SpolecneTagy = {
  autor: string;
  album: string;
  interpret: string;
  rok: number | null;
  zanr: string;
  vydavatel: string;
};

export type SlozkaKVyberu = { id: string; nazev: string };

export type TagyProjektu =
  | {
      ok: true;
      slozkaId: string;
      slozkaUrl: string | null;
      /** Složka projektu a její podsložky - finál bývá v podsložce. */
      slozky: SlozkaKVyberu[];
      stopy: StopaKTagovani[];
      spolecne: SpolecneTagy;
      zapsanoAt: string | null;
    }
  | { ok: false; duvod: string };

/** „03_Kapitola tri.mp3" -> 3 */
function cisloZNazvu(name: string): number | null {
  const shoda = /^(\d{1,3})\s*[_\-.)]/.exec(name.trim());
  if (!shoda) return null;
  const cislo = Number(shoda[1]);
  return Number.isFinite(cislo) && cislo > 0 ? cislo : null;
}

/**
 * Z názvu souboru název stopy: pryč pořadové číslo a přípona, podtržítka na
 * mezery. Diakritiku dopisuje člověk - z „kotatko" se „koťátko" neuhodne.
 */
export function titleZNazvu(name: string): string {
  let text = name.trim().replace(/\.[A-Za-z0-9]{1,5}$/, '');
  text = text.replace(/^\d{1,3}\s*[_\-.)]\s*/, '');
  text = text.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text;
}

function jeMp3(item: DriveItem): boolean {
  if (item.isFolder) return false;
  if (item.mimeType === 'audio/mpeg') return true;
  return PRIPONY.some((p) => item.name.toLowerCase().endsWith(p));
}

/** Smí se u tohohle projektu vůbec tagovat? Rozhoduje firma, ne kód. */
export async function tagovaniPovoleno(caflouProjectId: string): Promise<boolean> {
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: { company: { select: { tagyPovoleny: true } } },
  });
  return meta?.company?.tagyPovoleny === true;
}

/** Hodnoty tagů projektu; co není vyplněné, předvyplní se z projektu a firmy. */
export async function spolecneTagy(caflouProjectId: string): Promise<SpolecneTagy> {
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: {
      name: true,
      narrator: true,
      releaseDate: true,
      endDate: true,
      tagAutor: true,
      tagAlbum: true,
      tagInterpret: true,
      tagRok: true,
      tagZanr: true,
      tagVydavatel: true,
      actor: { select: { name: true } },
      company: { select: { tagyVydavatel: true } },
    },
  });
  const rokZData = (meta?.releaseDate ?? meta?.endDate)?.getFullYear() ?? null;
  return {
    autor: meta?.tagAutor ?? '',
    // Album je název audioknihy - bez série, ta je součást jiného údaje.
    album: meta?.tagAlbum ?? meta?.name ?? '',
    interpret: meta?.tagInterpret ?? meta?.actor?.name ?? meta?.narrator ?? '',
    rok: meta?.tagRok ?? rokZData,
    // Domluvený žánr mluveného slova; jde přepsat.
    zanr: meta?.tagZanr ?? 'Speech',
    vydavatel: meta?.tagVydavatel ?? meta?.company?.tagyVydavatel ?? '',
  };
}

/** Co je ve složce k otagování, i s tím, co už je o stopách uložené. */
export async function nactiTagy(caflouProjectId: string, slozkaIdNavic?: string): Promise<TagyProjektu> {
  const slozka = await slozkaProjektu(caflouProjectId);
  if (!slozka) return { ok: false, duvod: 'Projekt nemá složku na Disku.' };

  const token = await getAccessToken();
  if (!token) return { ok: false, duvod: 'Portál se nepřihlásil ke Google Disku.' };

  let koren: DriveItem[];
  try {
    koren = await listFolder(slozka.id, token);
  } catch (err) {
    console.error('Tagy: vypis slozky projektu selhal:', err);
    return { ok: false, duvod: 'Složku projektu se nepodařilo načíst.' };
  }

  const slozky: SlozkaKVyberu[] = [
    { id: slozka.id, nazev: 'Složka projektu' },
    ...koren.filter((i) => i.isFolder).map((i) => ({ id: i.id, nazev: i.name })),
  ];

  // Vybraná podsložka musí být opravdu podsložkou projektu - ať se přes
  // parametr v adrese nedá sáhnout kamkoliv na Disk.
  const vybrana = slozkaIdNavic && slozky.some((s) => s.id === slozkaIdNavic) ? slozkaIdNavic : slozka.id;

  let obsah = koren;
  if (vybrana !== slozka.id) {
    try {
      obsah = await listFolder(vybrana, token);
    } catch (err) {
      console.error('Tagy: vypis podslozky selhal:', err);
      return { ok: false, duvod: 'Vybranou složku se nepodařilo načíst.' };
    }
  }

  const soubory = obsah.filter(jeMp3);
  type UlozenaStopa = { driveFileId: string; cislo: number; title: string; zapsanoAt: Date | null };
  const ulozene: UlozenaStopa[] = await prisma.tagStopa.findMany({ where: { caflouProjectId } });
  const podleId = new Map<string, UlozenaStopa>(ulozene.map((u) => [u.driveFileId, u]));

  const stopy: StopaKTagovani[] = soubory
    .map((item, i) => {
      const ulozena = podleId.get(item.id);
      return {
        driveFileId: item.id,
        nazevSouboru: item.name,
        velikost: item.size ? Number(item.size) : null,
        cislo: ulozena?.cislo ?? cisloZNazvu(item.name) ?? i + 1,
        title: ulozena?.title ?? titleZNazvu(item.name),
        ulozeno: Boolean(ulozena),
        zapsanoAt: ulozena?.zapsanoAt?.toISOString() ?? null,
      };
    })
    .sort((a, b) => a.cislo - b.cislo || a.nazevSouboru.localeCompare(b.nazevSouboru, 'cs'));

  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: { tagyZapsanoAt: true },
  });

  return {
    ok: true,
    slozkaId: vybrana,
    slozkaUrl: slozka.url,
    slozky,
    stopy,
    spolecne: await spolecneTagy(caflouProjectId),
    zapsanoAt: meta?.tagyZapsanoAt?.toISOString() ?? null,
  };
}
