import { prisma } from '@/lib/db';

/**
 * PROGRAM TECHNICKÉ PORADY (zadání 28. 9. 2026).
 *
 * Peter vede poradu podle seznamu témat: postupně je probírá a odškrtává.
 * Na plátně je vidět jen NADPIS tématu, podrobné poznámky má u sebe v režii
 * (/prehledy/knihy/porada) - na telefonu, na druhé obrazovce, kdekoliv.
 *
 * PROTO SE POZNÁMKY NAČÍTAJÍ ZVLÁŠŤ. `nactiProgram` je pro plátno a poznámku
 * vůbec nevrací - kdyby ji vracel a stránka ji jen nevykreslila, ležela by
 * v HTML a stačilo by otevřít vývojářské nástroje. Do režie chodí přes
 * `nactiProgramSPoznamkami`.
 */

export type TemaNaPlatno = {
  id: string;
  nadpis: string;
  hotovo: boolean;
};

export type TemaVRezii = TemaNaPlatno & {
  poznamka: string | null;
  poradi: number;
};

type Radek = {
  id: string;
  nadpis: string;
  poznamka: string | null;
  poradi: number;
  hotovo: boolean;
};

/** Témata pro plátno - bez poznámek. */
export async function nactiProgram(): Promise<TemaNaPlatno[]> {
  try {
    const temata = (await prisma.poradaTema.findMany({
      orderBy: [{ poradi: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, nadpis: true, hotovo: true },
    })) as { id: string; nadpis: string; hotovo: boolean }[];
    return temata;
  } catch (err) {
    console.error('Program porady se nepodařilo načíst:', err);
    return [];
  }
}

/** Témata pro režii - včetně poznámek. */
export async function nactiProgramSPoznamkami(): Promise<TemaVRezii[]> {
  try {
    const temata = (await prisma.poradaTema.findMany({
      orderBy: [{ poradi: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, nadpis: true, poznamka: true, poradi: true, hotovo: true },
    })) as Radek[];
    return temata;
  } catch (err) {
    console.error('Program porady se nepodařilo načíst:', err);
    return [];
  }
}

export async function pridejTema(nadpis: string): Promise<TemaVRezii> {
  const posledni = (await prisma.poradaTema.findFirst({
    orderBy: { poradi: 'desc' },
    select: { poradi: true },
  })) as { poradi: number } | null;
  const tema = (await prisma.poradaTema.create({
    data: { nadpis, poradi: (posledni?.poradi ?? -1) + 1 },
    select: { id: true, nadpis: true, poznamka: true, poradi: true, hotovo: true },
  })) as Radek;
  return tema;
}

export async function upravTema(
  id: string,
  zmena: { nadpis?: string; poznamka?: string | null; hotovo?: boolean },
): Promise<TemaVRezii> {
  const tema = (await prisma.poradaTema.update({
    where: { id },
    data: {
      ...(zmena.nadpis !== undefined ? { nadpis: zmena.nadpis } : {}),
      ...(zmena.poznamka !== undefined ? { poznamka: zmena.poznamka || null } : {}),
      // Čas odškrtnutí se drží kvůli pořadí, v jakém se témata probírala.
      ...(zmena.hotovo !== undefined
        ? { hotovo: zmena.hotovo, hotovoAt: zmena.hotovo ? new Date() : null }
        : {}),
    },
    select: { id: true, nadpis: true, poznamka: true, poradi: true, hotovo: true },
  })) as Radek;
  return tema;
}

export async function smazTema(id: string): Promise<void> {
  await prisma.poradaTema.delete({ where: { id } });
}

/**
 * Přesun tématu o jedno nahoru nebo dolů. Prohodí se pořadová čísla dvou
 * sousedů - přečíslovat celý seznam kvůli jednomu kroku nemá smysl.
 */
export async function presunTema(id: string, smer: 'nahoru' | 'dolu'): Promise<void> {
  const temata = (await prisma.poradaTema.findMany({
    orderBy: [{ poradi: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, poradi: true },
  })) as { id: string; poradi: number }[];
  const i = temata.findIndex((t) => t.id === id);
  const j = smer === 'nahoru' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= temata.length) return;

  // Pořadová čísla můžou být po ručních zásazích stejná - přepíšou se oběma
  // podle skutečného pořadí v seznamu, jinak by se prohození neprojevilo.
  await prisma.$transaction([
    prisma.poradaTema.update({ where: { id: temata[i].id }, data: { poradi: j } }),
    prisma.poradaTema.update({ where: { id: temata[j].id }, data: { poradi: i } }),
  ]);
}

/** Nová porada = všechno zpátky neodškrtnuté. Seznam témat zůstává. */
export async function zacniNovouPoradu(): Promise<void> {
  await prisma.poradaTema.updateMany({
    where: { hotovo: true },
    data: { hotovo: false, hotovoAt: null },
  });
}
