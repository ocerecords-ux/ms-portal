import { prisma } from '@/lib/db';
import { najdiFormat, prazdnePlatno, type Platno } from '@/lib/socialni';

/**
 * SÍTĚ - DATA (zadání 27. 9. 2026). Prisma část modulu; podoba plátna
 * a šablony jsou v lib/socialni.ts, který jde importovat i v prohlížeči.
 *
 * KDO MODUL VIDÍ: zatím jediný člověk (zadání: „zatím uvidím jen já").
 * Rozhoduje příznak `vidiSite` na kartě uživatele, ne role - kdyby to viselo
 * jen na roli ADMIN, uviděla by to i Žůžo-labůžo.
 */

export type PrispevekRadek = {
  id: string;
  nazev: string;
  sit: string;
  format: string;
  sirka: number;
  vyska: number;
  stav: string;
  popisek: string;
  hashtagy: string;
  planovanoNa: string | null;
  publikovanoAt: string | null;
  updatedAt: string;
};

export type PrispevekDetail = PrispevekRadek & { platno: Platno };

/** Smí tenhle účet do Sítí? */
export async function smiSite(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const u = (await prisma.user.findUnique({
      where: { id: userId },
      select: { vidiSite: true, active: true },
    })) as { vidiSite: boolean; active: boolean } | null;
    return Boolean(u?.active && u.vidiSite);
  } catch {
    return false;
  }
}

function naRadek(p: {
  id: string;
  nazev: string;
  sit: string;
  format: string;
  sirka: number;
  vyska: number;
  stav: string;
  popisek: string;
  hashtagy: string;
  planovanoNa: Date | null;
  publikovanoAt: Date | null;
  updatedAt: Date;
}): PrispevekRadek {
  return {
    id: p.id,
    nazev: p.nazev,
    sit: p.sit,
    format: p.format,
    sirka: p.sirka,
    vyska: p.vyska,
    stav: p.stav,
    popisek: p.popisek,
    hashtagy: p.hashtagy,
    planovanoNa: p.planovanoNa ? p.planovanoNa.toISOString() : null,
    publikovanoAt: p.publikovanoAt ? p.publikovanoAt.toISOString() : null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

const VYBER = {
  id: true,
  nazev: true,
  sit: true,
  format: true,
  sirka: true,
  vyska: true,
  stav: true,
  popisek: true,
  hashtagy: true,
  planovanoNa: true,
  publikovanoAt: true,
  updatedAt: true,
} as const;

export async function nactiPrispevky(autorId: string): Promise<PrispevekRadek[]> {
  const vsechny = (await prisma.socialniPrispevek.findMany({
    where: { autorId },
    orderBy: { updatedAt: 'desc' },
    select: VYBER,
  })) as Parameters<typeof naRadek>[0][];
  return vsechny.map(naRadek);
}

export async function nactiPrispevek(autorId: string, id: string): Promise<PrispevekDetail | null> {
  const p = (await prisma.socialniPrispevek.findFirst({
    where: { id, autorId },
    select: { ...VYBER, platno: true },
  })) as (Parameters<typeof naRadek>[0] & { platno: unknown }) | null;
  if (!p) return null;
  return { ...naRadek(p), platno: (p.platno as Platno) ?? prazdnePlatno() };
}

export async function zalozPrispevek(
  autorId: string,
  vstup: { nazev: string; format: string; platno?: Platno },
): Promise<PrispevekDetail> {
  const f = najdiFormat(vstup.format);
  const p = (await prisma.socialniPrispevek.create({
    data: {
      autorId,
      nazev: vstup.nazev.trim() || 'Nový příspěvek',
      sit: f.sit,
      format: f.klic,
      sirka: f.sirka,
      vyska: f.vyska,
      platno: (vstup.platno ?? prazdnePlatno()) as object,
    },
    select: { ...VYBER, platno: true },
  })) as Parameters<typeof naRadek>[0] & { platno: unknown };
  return { ...naRadek(p), platno: (p.platno as Platno) ?? prazdnePlatno() };
}

export async function upravPrispevek(
  autorId: string,
  id: string,
  zmena: {
    nazev?: string;
    format?: string;
    platno?: Platno;
    popisek?: string;
    hashtagy?: string;
    stav?: string;
    planovanoNa?: string | null;
  },
): Promise<PrispevekDetail | null> {
  const uz = await prisma.socialniPrispevek.findFirst({ where: { id, autorId }, select: { id: true } });
  if (!uz) return null;

  const data: Record<string, unknown> = {};
  if (zmena.nazev !== undefined) data.nazev = zmena.nazev.trim() || 'Nový příspěvek';
  if (zmena.platno !== undefined) data.platno = zmena.platno as object;
  if (zmena.popisek !== undefined) data.popisek = zmena.popisek;
  if (zmena.hashtagy !== undefined) data.hashtagy = zmena.hashtagy;
  if (zmena.stav !== undefined) data.stav = zmena.stav;
  if (zmena.planovanoNa !== undefined) {
    data.planovanoNa = zmena.planovanoNa ? new Date(zmena.planovanoNa) : null;
  }
  if (zmena.format !== undefined) {
    // Formát mění i rozměry - vrstvy jsou v procentech, takže se nic nerozsype.
    const f = najdiFormat(zmena.format);
    data.format = f.klic;
    data.sit = f.sit;
    data.sirka = f.sirka;
    data.vyska = f.vyska;
  }

  const p = (await prisma.socialniPrispevek.update({
    where: { id },
    data,
    select: { ...VYBER, platno: true },
  })) as Parameters<typeof naRadek>[0] & { platno: unknown };
  return { ...naRadek(p), platno: (p.platno as Platno) ?? prazdnePlatno() };
}

export async function smazPrispevek(autorId: string, id: string): Promise<boolean> {
  const uz = await prisma.socialniPrispevek.findFirst({ where: { id, autorId }, select: { id: true } });
  if (!uz) return false;
  await prisma.socialniPrispevek.delete({ where: { id } });
  return true;
}

export type ObrazekRadek = { id: string; nazev: string; sirka: number | null; vyska: number | null };

export async function nactiObrazky(autorId: string): Promise<ObrazekRadek[]> {
  const vsechny = (await prisma.socialniObrazek.findMany({
    where: { autorId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, nazev: true, sirka: true, vyska: true },
  })) as ObrazekRadek[];
  return vsechny;
}
