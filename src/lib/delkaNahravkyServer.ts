import { prisma } from '@/lib/db';
import { getAccessToken } from '@/lib/googleDrive';
import { nactiZDisku } from '@/lib/preposlechDriveServer';

/**
 * CELKOVÝ ČAS NAHRÁVKY ZE SERVERU (zadání 18. 11. 2026: „jde mi jen o to, ať
 * se nějak k přeposlouchávači dostane info s tím celkovým časem").
 *
 * AudioTagger si délky stop měří v prohlížeči - přehrávač načte metadata a
 * sečte je. Server to číslo nikdy neměl, takže by v mailu neměl co napsat.
 *
 * PROČ Z HLAVIČEK, NE STAHOVÁNÍM. Stopy jsou WAVy o desítkách megabajtů a
 * stáhnout kvůli jednomu číslu celou knihu je nesmysl. U WAVu ale délka
 * vyplývá z hlavičky a velikosti souboru: v bloku `fmt ` stojí počet bajtů za
 * vteřinu, takže stačí z každého souboru prvních pár desítek bajtů (Disk umí
 * Range) a velikost, kterou výpis složky vrací stejně.
 *
 * Co není WAV, se přeskočí - délka takového souboru z hlavičky nevyplývá
 * (u MP3 s proměnným datovým tokem vůbec) a hádat se nemá.
 */

/** Kolik bajtů z úvodu souboru stačí, aby se v nich našel blok `fmt `. */
const HLAVICKA_BAJTU = 256;

/** Vrátí počet bajtů za vteřinu z WAV hlavičky, nebo null. */
function bajtuZaVterinu(hlavicka: Buffer): number | null {
  if (hlavicka.length < 16) return null;
  if (hlavicka.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (hlavicka.toString('ascii', 8, 12) !== 'WAVE') return null;
  // Bloky jdou za sebou: 4 bajty název, 4 bajty délka, pak obsah.
  let pozice = 12;
  while (pozice + 8 <= hlavicka.length) {
    const nazev = hlavicka.toString('ascii', pozice, pozice + 4);
    const delka = hlavicka.readUInt32LE(pozice + 4);
    if (nazev === 'fmt ') {
      // audioFormat(2) + numChannels(2) + sampleRate(4) = 8 bajtů, pak byteRate.
      const kde = pozice + 8 + 8;
      if (kde + 4 > hlavicka.length) return null;
      const rychlost = hlavicka.readUInt32LE(kde);
      return rychlost > 0 ? rychlost : null;
    }
    pozice += 8 + delka + (delka % 2);
  }
  return null;
}

async function delkaSouboru(fileId: string, velikost: number, token: string): Promise<number | null> {
  try {
    const odpoved = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}`, Range: `bytes=0-${HLAVICKA_BAJTU - 1}` } },
    );
    if (!odpoved.ok) return null;
    const hlavicka = Buffer.from(await odpoved.arrayBuffer());
    const rychlost = bajtuZaVterinu(hlavicka);
    if (!rychlost) return null;
    // Hlavička sama je proti hodinám zvuku zanedbatelná, neodečítá se.
    return velikost / rychlost;
  } catch (err) {
    console.error(`Délku stopy ${fileId} se nepodařilo zjistit:`, err);
    return null;
  }
}

export type CelkovyCas = {
  /** Součet v sekundách. */
  sekundy: number;
  /** Kolik stop se podařilo změřit a kolik jich na Disku leží. */
  zmereno: number;
  stop: number;
};

/**
 * Spočítá celkový čas všech stop projektu. Vrací null, když se nepodařilo
 * změřit ani jednu - to je jediný případ, kdy se číslo nikam nepíše.
 */
export async function zmerCelkovyCas(caflouProjectId: string): Promise<CelkovyCas | null> {
  const disk = await nactiZDisku(caflouProjectId).catch(() => null);
  if (!disk || !disk.ok || disk.stopy.length === 0) return null;

  const token = await getAccessToken();
  if (!token) return null;

  let sekundy = 0;
  let zmereno = 0;
  for (const stopa of disk.stopy) {
    if (!stopa.velikost) continue;
    const delka = await delkaSouboru(stopa.id, stopa.velikost, token);
    if (delka === null) continue;
    sekundy += delka;
    zmereno += 1;
  }
  if (zmereno === 0) return null;
  return { sekundy: Math.round(sekundy), zmereno, stop: disk.stopy.length };
}

/**
 * Celkový čas ze záznamu, a když tam ještě není, změří se a uloží. Měření
 * sahá na Disk, takže se nedělá při každém zobrazení.
 */
export async function celkovyCasProjektu(caflouProjectId: string): Promise<number | null> {
  const stav = await prisma.preposlechStav
    .findUnique({ where: { caflouProjectId }, select: { delkaSekund: true } })
    .catch(() => null);
  if (stav?.delkaSekund) return stav.delkaSekund;

  const zmereno = await zmerCelkovyCas(caflouProjectId);
  if (!zmereno) return null;

  await prisma.preposlechStav
    .upsert({
      where: { caflouProjectId },
      update: { delkaSekund: zmereno.sekundy, delkaZjistenaAt: new Date() },
      create: { caflouProjectId, delkaSekund: zmereno.sekundy, delkaZjistenaAt: new Date() },
    })
    .catch(() => undefined);
  return zmereno.sekundy;
}

/**
 * „8 h 42 min 15 s" (zadání 18. 11. 2026). Hodiny se vynechají, když žádné
 * nejsou - u ukázky by „0 h" jen mátlo.
 */
export function casSlovy(sekundy: number): string {
  const h = Math.floor(sekundy / 3600);
  const m = Math.floor((sekundy % 3600) / 60);
  const s = Math.round(sekundy % 60);
  return [h > 0 ? `${h} h` : null, `${m} min`, `${s} s`].filter(Boolean).join(' ');
}
