import { prisma } from '@/lib/db';
import { extractDriveFolderId } from '@/lib/googleDrive';
import { nabidkaSlozek, type NabidnutaSlozka, type SlozkaKNabidce } from '@/lib/diskoveSlozky';

/**
 * NAČTENÍ SLOŽEK NA DISKU PRO KONKRÉTNÍHO ČLOVĚKA (zadání 30. 9. 2026).
 *
 * Jedno místo, kde se to čte, aby stránka Nahrávky i /api/drive rozhodovaly
 * podle toho samého. Kdyby si to každá počítala po svém, dřív nebo později
 * by se to rozešlo - a rozejít se to může jen tak, že někdo uvidí složku,
 * kterou vidět nemá.
 */

/** Všechny složky i s příznakem, jestli je ten člověk má zaškrtnuté. */
async function nactiVse(userId: string): Promise<{ slozky: SlozkaKNabidce[]; superadmin: boolean }> {
  const [uzivatel, slozky] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { superadmin: true, slozkyDisku: { select: { id: true } } },
    }),
    prisma.diskovaSlozka.findMany({
      orderBy: [{ poradi: 'asc' }, { nazev: 'asc' }],
      select: { id: true, nazev: true, popis: true, driveUrl: true, aktivni: true },
    }),
  ]);

  if (!uzivatel) return { slozky: [], superadmin: false };

  const prideleneId = new Set((uzivatel.slozkyDisku ?? []).map((s: { id: string }) => s.id));

  return {
    superadmin: Boolean(uzivatel.superadmin),
    slozky: slozky.map((s: {
      id: string;
      nazev: string;
      popis: string | null;
      driveUrl: string;
      aktivni: boolean;
    }) => ({
      id: s.id,
      nazev: s.nazev,
      popis: s.popis,
      rootId: extractDriveFolderId(s.driveUrl),
      aktivni: s.aktivni,
      prideleno: prideleneId.has(s.id),
    })),
  };
}

/** Složky, které se tomu člověku smí nabídnout - v pořadí z administrace. */
export async function slozkyProUzivatele(userId: string): Promise<NabidnutaSlozka[]> {
  const { slozky, superadmin } = await nactiVse(userId);
  return nabidkaSlozek(slozky, superadmin);
}

/**
 * Jedna složka, a jen když na ni ten člověk má. Vrací `null` i tehdy, když
 * složka vůbec neexistuje - kdo na ni nemá, se z odpovědi nesmí dozvědět
 * rozdíl mezi „není" a „je, ale není pro tebe".
 */
export async function slozkaProUzivatele(
  userId: string,
  slozkaId: string,
): Promise<NabidnutaSlozka | null> {
  const nabidka = await slozkyProUzivatele(userId);
  return nabidka.find((s) => s.id === slozkaId) ?? null;
}
