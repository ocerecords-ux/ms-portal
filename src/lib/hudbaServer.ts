import { prisma } from '@/lib/db';
import type { SkladbaRadek } from '@/lib/hudba';

/**
 * HUDBA DO PŘÍBĚHŮ - DATA (zadání 8. 10. 2026).
 *
 * Knihovna je jedna pro celou firmu, ne osobní: skladbu nahraje produkce
 * a vybírat z ní může každý, kdo smí poslat příběh. Kdo smí co, se řeší
 * v samotných cestách přes smiPoslatPribeh / smiSchvalovatPribehy - tady
 * jsou jen dotazy.
 *
 * NIKDY NEVYHAZUJE: když se knihovna nenačte, editor prostě hudbu nenabídne
 * a příběh jde ven jako dřív. Kvůli skladbám nesmí spadnout celá stránka.
 */

const VYBER = {
  id: true,
  nazev: true,
  autor: true,
  delka: true,
  aktivni: true,
  nahral: { select: { name: true, email: true } },
};

type Zaznam = {
  id: string;
  nazev: string;
  autor: string;
  delka: number;
  aktivni: boolean;
  nahral: { name: string | null; email: string | null } | null;
};

function naRadek(h: Zaznam): SkladbaRadek {
  return {
    id: h.id,
    nazev: h.nazev,
    autor: h.autor,
    delka: h.delka,
    aktivni: h.aktivni,
    nahral: h.nahral ? h.nahral.name?.trim() || h.nahral.email || null : null,
  };
}

/**
 * Skladby do výběru. `vcetneVypnutych` je jen pro správu - v editoru se
 * vypnutá skladba nabízet nemá.
 */
export async function nactiHudbu(vcetneVypnutych = false): Promise<SkladbaRadek[]> {
  try {
    const radky = (await prisma.pribehHudba.findMany({
      where: vcetneVypnutych ? {} : { aktivni: true },
      orderBy: [{ poradi: 'asc' }, { nazev: 'asc' }],
      take: 200,
      select: VYBER,
    })) as unknown as Zaznam[];
    return radky.map(naRadek);
  } catch (err) {
    console.error('Hudbu do příběhů se nepodařilo načíst:', err);
    return [];
  }
}

export async function nactiSkladbu(id: string): Promise<(SkladbaRadek & { url: string; typSouboru: string; nazevSouboru: string }) | null> {
  const h = (await prisma.pribehHudba.findUnique({
    where: { id },
    select: { ...VYBER, url: true, typSouboru: true, nazevSouboru: true },
  })) as unknown as (Zaznam & { url: string; typSouboru: string; nazevSouboru: string }) | null;
  if (!h) return null;
  return { ...naRadek(h), url: h.url, typSouboru: h.typSouboru, nazevSouboru: h.nazevSouboru };
}

export async function zalozSkladbu(
  nahralId: string,
  vstup: {
    nazev: string;
    autor: string;
    url: string;
    nazevSouboru: string;
    typSouboru: string;
    velikost: number;
    delka: number;
  },
): Promise<SkladbaRadek> {
  // Nová skladba jde na konec seznamu - pořadí se pak dá přerovnat.
  const kolik = await prisma.pribehHudba.count().catch(() => 0);
  const h = (await prisma.pribehHudba.create({
    data: { ...vstup, nahralId, poradi: kolik },
    select: VYBER,
  })) as unknown as Zaznam;
  return naRadek(h);
}

export async function upravSkladbu(
  id: string,
  zmena: { nazev?: string; autor?: string; aktivni?: boolean },
): Promise<SkladbaRadek | null> {
  const data: Record<string, unknown> = {};
  if (zmena.nazev !== undefined) data.nazev = zmena.nazev;
  if (zmena.autor !== undefined) data.autor = zmena.autor;
  if (zmena.aktivni !== undefined) data.aktivni = zmena.aktivni;
  if (Object.keys(data).length === 0) return null;
  const h = (await prisma.pribehHudba.update({
    where: { id },
    data,
    select: VYBER,
  })) as unknown as Zaznam;
  return naRadek(h);
}

/**
 * Smazání skladby. Příběh, ve kterém už je vypálená, se tím nemění - hudba
 * je v jeho souboru, ne odkazem. Kdo si jen nechce skladbu nabízet dál,
 * má ji VYPNOUT; mazat má smysl, když se nahrála omylem.
 */
export async function smazSkladbu(id: string): Promise<boolean> {
  try {
    await prisma.pribehHudba.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
