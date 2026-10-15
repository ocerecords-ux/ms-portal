import { prisma } from '@/lib/db';
import { getAccessToken, listFolder, type DriveItem } from '@/lib/googleDrive';
import { slozkaProjektu } from '@/lib/preposlechDriveServer';
import type { Track } from '@/lib/tracklist';

/**
 * TRACKLIST AUDIOKNIHY (zadání 15. 10. 2026: „vytvoř v detailu každého
 * projektu, který je audiokniha, ještě záložku tracklist. Tam bude seznam
 * tracků editovatelný" → „pořadové číslo, název tracku, název kapitoly"
 * → „01, 02, 03").
 *
 * TŘI SLOUPCE, PROTOŽE JSOU TO TŘI RŮZNÉ VĚCI:
 *  - POŘADOVÉ ČÍSLO se nezadává, dopočítá se z pořadí v seznamu a píše se
 *    vždy dvojmístně (01, 02, 03) - stejně jako na začátku názvů souborů.
 *  - NÁZEV TRACKU je jméno samotné stopy / souboru.
 *  - NÁZEV KAPITOLY je, jak se kapitola jmenuje ve výchozí knize. Nemusí
 *    být - ne každá kniha pojmenované kapitoly má, a tehdy se do tagu
 *    title dává název tracku, jen s diakritikou.
 *
 * Vede se u projektu, protože ho potřebuje víc míst: podle něj se pojmenují
 * finální soubory a z něj se berou názvy do tagů (viz lib/tagyServer.ts).
 */

export type { Track } from '@/lib/tracklist';
export { cisloTracku } from '@/lib/tracklist';

export async function nactiTracklist(caflouProjectId: string): Promise<Track[]> {
  const radky = await prisma.trackProjektu
    .findMany({ where: { caflouProjectId }, orderBy: { poradi: 'asc' } })
    .catch(() => [] as { poradi: number; nazevTracku: string; nazevKapitoly: string }[]);
  return radky.map((r) => ({
    poradi: r.poradi,
    nazevTracku: r.nazevTracku ?? '',
    nazevKapitoly: r.nazevKapitoly ?? '',
  }));
}

const ZVUKOVE_PRIPONY = ['.wav', '.mp3', '.m4a', '.aac', '.flac', '.aif', '.aiff', '.ogg', '.opus'];

function jeZvuk(item: DriveItem): boolean {
  if (item.isFolder) return false;
  if (item.mimeType?.startsWith('audio/')) return true;
  const nazev = item.name.toLowerCase();
  return ZVUKOVE_PRIPONY.some((p) => nazev.endsWith(p));
}

/** „03_Kapitola tri.wav" -> 3 */
function poradiZNazvu(name: string): number | null {
  const shoda = /^(\d{1,3})\s*[_\-.)]/.exec(name.trim());
  if (!shoda) return null;
  const cislo = Number(shoda[1]);
  return Number.isFinite(cislo) && cislo > 0 ? cislo : null;
}

/** Z názvu souboru název stopy: pryč pořadí a přípona, podtržítka na mezery. */
export function nazevZeSouboru(name: string): string {
  let text = name.trim().replace(/\.[A-Za-z0-9]{1,5}$/, '');
  text = text.replace(/^\d{1,3}\s*[_\-.)]\s*/, '');
  return text.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * NÁVRH SEZNAMU Z NAHRÁVEK VE SLOŽCE PROJEKTU. Psát tracklist ručně, když
 * stopy na Disku už existují, je opisování - tohle z nich udělá první verzi.
 * Naplní se jen NÁZEV TRACKU; název kapitoly ze souboru poznat nejde, ten
 * se dopisuje z knihy.
 *
 * Nic se neukládá; uloží se až to, co člověk potvrdí.
 */
export async function nazvyZNahravek(
  caflouProjectId: string,
): Promise<{ ok: true; tracky: Track[] } | { ok: false; duvod: string }> {
  const slozka = await slozkaProjektu(caflouProjectId);
  if (!slozka) return { ok: false, duvod: 'Projekt nemá složku na Disku.' };

  const token = await getAccessToken();
  if (!token) return { ok: false, duvod: 'Portál se nepřihlásil ke Google Disku.' };

  try {
    const obsah = await listFolder(slozka.id, token);
    const zvuky = obsah.filter(jeZvuk);
    if (zvuky.length === 0) return { ok: false, duvod: 'Ve složce projektu nejsou žádné nahrávky.' };

    const tracky = zvuky
      .map((item, i) => ({ klic: poradiZNazvu(item.name) ?? i + 1, nazev: nazevZeSouboru(item.name) }))
      .sort((a, b) => a.klic - b.klic || a.nazev.localeCompare(b.nazev, 'cs'))
      .map((t, i) => ({ poradi: i + 1, nazevTracku: t.nazev, nazevKapitoly: '' }));

    return { ok: true, tracky };
  } catch (err) {
    console.error('Tracklist: vypis slozky selhal:', err);
    return { ok: false, duvod: 'Složku projektu se nepodařilo načíst.' };
  }
}
