import { prisma } from '@/lib/db';
import { najdiPodobne, type PodobnaPripominka } from '@/lib/pripominky';

/**
 * Zpětná vazba k portálu - serverová část (zadání 15. 9. 2026).
 *
 * KDO CO VIDÍ: každý vidí JEN svoje připomínky, Žůžo-labůžo vidí všechny.
 * Odškrtnutá připomínka autorovi zmizí ze seznamu („já bych si to pak jen
 * odškrtával a jim by to mizelo") - nesmaže se ale, zůstává v sekci Hotové,
 * ať je dohledatelné, co se kdy řešilo.
 */

export type PripominkaRadek = {
  id: string;
  text: string;
  odkud: string | null;
  stav: 'NOVA' | 'HOTOVA';
  createdAt: string;
  hotovoAt: string | null;
  hotovoJmeno: string | null;
  poznamka: string | null;
  autorId: string;
  autor: string;
  /** Kolik dalších lidí se k téhle připomínce přidalo. */
  pridalSe: number;
  prilohy: { id: string; url: string; nazev: string }[];
};

function naRadek(p: {
  id: string;
  text: string;
  odkud: string | null;
  stav: string;
  createdAt: Date;
  hotovoAt: Date | null;
  hotovoJmeno: string | null;
  poznamka: string | null;
  userId: string;
  user: { name: string | null; email: string } | null;
  prilohy: { id: string; url: string; nazev: string }[];
  _count?: { podobne?: number };
  pridalSe?: number;
}): PripominkaRadek {
  return {
    id: p.id,
    text: p.text,
    odkud: p.odkud,
    stav: p.stav === 'HOTOVA' ? 'HOTOVA' : 'NOVA',
    createdAt: p.createdAt.toISOString(),
    hotovoAt: p.hotovoAt ? p.hotovoAt.toISOString() : null,
    hotovoJmeno: p.hotovoJmeno,
    poznamka: p.poznamka,
    autorId: p.userId,
    autor: p.user?.name || p.user?.email || 'Neznámý',
    pridalSe: p.pridalSe ?? 0,
    prilohy: p.prilohy,
  };
}

const VYBER = {
  id: true,
  text: true,
  odkud: true,
  stav: true,
  createdAt: true,
  hotovoAt: true,
  hotovoJmeno: true,
  poznamka: true,
  userId: true,
  podobnaId: true,
  user: { select: { name: true, email: true } },
  prilohy: { select: { id: true, url: true, nazev: true }, orderBy: { createdAt: 'asc' as const } },
};

/** Připomínky jednoho člověka. Hotové se mu neukazují - zmizely. */
export async function mojePripominky(userId: string): Promise<PripominkaRadek[]> {
  try {
    const data = await prisma.pripominkaPortalu.findMany({
      where: { userId, stav: 'NOVA' },
      orderBy: { createdAt: 'desc' },
      select: VYBER,
    });
    return data.map((p) => naRadek(p));
  } catch (err) {
    console.error('mojePripominky selhalo:', err);
    return [];
  }
}

/** Všechny připomínky - jen pro Žůžo-labůžo. */
export async function vsechnyPripominky(): Promise<{ otevrene: PripominkaRadek[]; hotove: PripominkaRadek[] }> {
  try {
    const data = await prisma.pripominkaPortalu.findMany({
      orderBy: { createdAt: 'desc' },
      select: VYBER,
    });
    // „Přidal se" = kolik dalších připomínek se navázalo na tuhle.
    const pocty = new Map<string, number>();
    data.forEach((p) => {
      if (p.podobnaId) pocty.set(p.podobnaId, (pocty.get(p.podobnaId) ?? 0) + 1);
    });
    // Připomínky přivěšené k jiné se v seznamu neopakují - jsou to duplicity.
    const hlavni = data.filter((p) => !p.podobnaId);
    const radky = hlavni.map((p) => naRadek({ ...p, pridalSe: pocty.get(p.id) ?? 0 }));
    return {
      otevrene: radky.filter((p) => p.stav === 'NOVA'),
      hotove: radky.filter((p) => p.stav === 'HOTOVA'),
    };
  } catch (err) {
    console.error('vsechnyPripominky selhalo:', err);
    return { otevrene: [], hotove: [] };
  }
}

/** Kolik připomínek čeká na vyřízení - odznak u odkazu Můj účet. */
export async function pocetOtevrenychPripominek(): Promise<number> {
  try {
    return await prisma.pripominkaPortalu.count({ where: { stav: 'NOVA', podobnaId: null } });
  } catch {
    return 0;
  }
}

/**
 * Podobné otevřené připomínky k zadanému textu. Hledá se přes VŠECHNY
 * uživatele: smysl upozornění je, aby se tatáž věc neřešila třikrát.
 */
export async function podobnePripominky(text: string, kromeId?: string): Promise<PodobnaPripominka[]> {
  try {
    const data = await prisma.pripominkaPortalu.findMany({
      where: { stav: 'NOVA', podobnaId: null, ...(kromeId ? { id: { not: kromeId } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { id: true, text: true, user: { select: { name: true, email: true } } },
    });
    return najdiPodobne(
      text,
      data.map((p) => ({ id: p.id, text: p.text, autor: p.user?.name || p.user?.email || 'Neznámý' })),
    );
  } catch (err) {
    console.error('podobnePripominky selhalo:', err);
    return [];
  }
}
