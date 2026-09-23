import { prisma } from '@/lib/db';
import { minutesInZone, minutesToTime } from '@/lib/calendar';

/**
 * HISTORIE KALENDÁŘE (zadání 23. 9. 2026: „ještě by to chtělo někam dát
 * historii, kdo kdy upravil nějakou věc v kalendáři").
 *
 * Jeden řádek = jedna změna: co, kdy se to týkalo, kdo to udělal a kdy.
 * Zapisuje se při zápisu, úpravě i zrušení - u natáčení, blokací, porad,
 * schůzek i Mimo studio.
 *
 * NÁZEV I ČAS SE UKLÁDAJÍ JAKO TEXT, ne odkazem na událost. Záznam má dávat
 * smysl i potom, co událost někdo smaže nebo přejmenuje - právě tehdy se
 * v historii hledá nejčastěji („kdo to zrušil?").
 *
 * NIKDY NEVYHAZUJE. Když se zápis do historie nepovede, nesmí to shodit
 * samotnou změnu v kalendáři - ta je důležitější.
 */

const PASMO = 'Europe/Prague';

export type TypZaznamu = 'SLOT' | 'BLOK' | 'PORADA' | 'SCHUZKA' | 'MIMO';
export type AkceZaznamu = 'VZNIK' | 'UPRAVA' | 'ZRUSENI';

export type ZapisZmeny = {
  typ: TypZaznamu;
  akce: AkceZaznamu;
  zaznamId?: string | null;
  /** „KOUSEK TEBE · Tereza Jarčevská" */
  nazev: string;
  /** Začátek a konec události - z nich se složí den a čas. */
  start?: Date | null;
  end?: Date | null;
  /** Studio nebo jiné upřesnění za čas. */
  kde?: string | null;
  /** Jedna věta k tomu, co se změnilo. */
  podrobnosti?: string | null;
  kdo: { id: string | null; jmeno: string };
};

const cas = (d: Date) => minutesToTime(minutesInZone(d, PASMO));
const denVPraze = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: PASMO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

export async function zapisZmenuKalendare(z: ZapisZmeny): Promise<void> {
  try {
    const den = z.start ? denVPraze(z.start) : null;
    const casText = z.start && z.end ? `${cas(z.start)}–${cas(z.end)}` : null;
    const kdy = [casText, z.kde].filter(Boolean).join(' · ') || null;

    await prisma.kalendarZmena.create({
      data: {
        typ: z.typ,
        akce: z.akce,
        zaznamId: z.zaznamId ?? null,
        nazev: z.nazev.slice(0, 300),
        den,
        kdy,
        podrobnosti: z.podrobnosti?.slice(0, 300) ?? null,
        kdoId: z.kdo.id,
        kdoJmeno: z.kdo.jmeno.slice(0, 120),
      },
    });
  } catch (err) {
    console.error('Zapis do historie kalendare selhal:', err);
  }
}

export type RadekHistorie = {
  id: string;
  typ: string;
  akce: string;
  nazev: string;
  den: string | null;
  kdy: string | null;
  podrobnosti: string | null;
  kdo: string;
  kdyZmena: string;
};

/**
 * Posledních N změn. Bez filtrování podle člověka: kdo vidí kalendář, vidí
 * i to, kdo v něm co přehodil - o to v historii jde.
 */
export async function nactiHistoriiKalendare(limit = 100): Promise<RadekHistorie[]> {
  try {
    const radky = await prisma.kalendarZmena.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 300),
    });
    return radky.map((r) => ({
      id: r.id,
      typ: r.typ,
      akce: r.akce,
      nazev: r.nazev,
      den: r.den,
      kdy: r.kdy,
      podrobnosti: r.podrobnosti,
      kdo: r.kdoJmeno,
      kdyZmena: r.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error('Cteni historie kalendare selhalo:', err);
    return [];
  }
}
