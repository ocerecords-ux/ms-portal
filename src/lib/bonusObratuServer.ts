import { prisma } from '@/lib/db';
import { computeTotals } from '@/lib/doklady';
import { INTERNAL_ROLES } from '@/lib/roles';

/**
 * MOJE BONUSY - PODÍL NA OBRATU (zadání 6. 10. 2026: „potřebuju ještě dát
 * Peterovi a Karolíně do Přehledů záložku Moje bonusy, kde uvidí aktuálně
 * částku bez DPH. Každý z nich má jiný podíl na obratu").
 *
 * ZÁKLAD JE TENTÝŽ, CO UKAZUJE PALUBOVKA: vystavené faktury (odeslané
 * i uhrazené) podle data vystavení, v korunách BEZ DPH a přepočtené kurzem
 * uloženým u dokladu. Kdyby se počítalo jinak, nesedělo by to proti obratu
 * firmy a první otázka by byla, které z těch dvou čísel platí.
 *
 * STORNO A ROZPRACOVANÉ FAKTURY SE NEPOČÍTAJÍ - nejsou obrat.
 */

type PolozkaDokladu = { quantity: number; unitPriceMinor: number; vatRate: number };

/** Koruny bez DPH z položek dokladu, se slevou a kurzem (stejně jako palubovka). */
function bezDph(
  items: PolozkaDokladu[],
  sleva: { slevaProcent: number; slevaMinor: number },
  kurz = 1,
): number {
  return (computeTotals(items, sleva).exVat / 100) * (kurz || 1);
}

export type MesicBonusu = {
  /** 1-12 */
  mesic: number;
  obrat: number;
};

export type ClovekSPodilem = {
  id: string;
  jmeno: string;
  procento: number;
};

export type BonusyData = {
  rok: number;
  /** Leden až aktuální měsíc; měsíce bez faktury jsou nuly, ne díry. */
  mesice: MesicBonusu[];
  obratRoku: number;
  /** Kdo má na kartě vyplněný podíl - seřazeno podle jména. */
  lide: ClovekSPodilem[];
};

/** Bonus z obratu. Zaokrouhluje se až tady, ať to sedí s tím, co je vidět. */
export function bonusZObratu(obrat: number, procento: number): number {
  return Math.round((obrat * procento) / 100);
}

export async function nactiBonusyObratu(dnes = new Date()): Promise<BonusyData> {
  const rok = dnes.getFullYear();
  const od = new Date(rok, 0, 1);
  const doKdy = new Date(rok + 1, 0, 1);

  const [faktury, lide] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { in: ['SENT', 'PAID'] }, issueDate: { gte: od, lt: doKdy } },
      select: {
        issueDate: true,
        exchangeRate: true,
        slevaProcent: true,
        slevaMinor: true,
        items: { select: { quantity: true, unitPriceMinor: true, vatRate: true } },
      },
    }) as unknown as Promise<
      {
        issueDate: Date;
        exchangeRate: number;
        slevaProcent: number;
        slevaMinor: number;
        items: PolozkaDokladu[];
      }[]
    >,
    prisma.user.findMany({
      where: { active: true, role: { in: INTERNAL_ROLES }, podilNaObratu: { gt: 0 } },
      select: { id: true, name: true, email: true, podilNaObratu: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    }) as unknown as Promise<
      { id: string; name: string | null; email: string; podilNaObratu: number | null }[]
    >,
  ]);

  /**
   * Měsíce do konce roku se nekreslí - do prázdna se nedívá nikdo rád. Když
   * ale někdo vystaví fakturu dopředu, musí její měsíc v tabulce být: jinak
   * by součet měsíců nesouhlasil s ročním číslem nad ním.
   */
  const dnesniMesic = dnes.getFullYear() === rok ? dnes.getMonth() + 1 : 12;
  const nejpozdejsi = faktury.reduce((m, f) => Math.max(m, f.issueDate.getMonth() + 1), 0);
  const posledni = Math.min(12, Math.max(dnesniMesic, nejpozdejsi));
  const mesice: MesicBonusu[] = Array.from({ length: posledni }, (_, i) => ({
    mesic: i + 1,
    obrat: 0,
  }));

  let obratRoku = 0;
  for (const f of faktury) {
    const castka = bezDph(f.items, f, f.exchangeRate);
    const radek = mesice[f.issueDate.getMonth()];
    if (radek) radek.obrat += castka;
    obratRoku += castka;
  }

  return {
    rok,
    mesice,
    obratRoku,
    lide: lide.map((u) => ({
      id: u.id,
      jmeno: u.name || u.email,
      procento: u.podilNaObratu ?? 0,
    })),
  };
}

/** Podíl přihlášeného člověka, nebo null, když žádný nemá. */
export async function mujPodilNaObratu(userId: string): Promise<number | null> {
  try {
    const u = (await prisma.user.findUnique({
      where: { id: userId },
      select: { podilNaObratu: true },
    })) as { podilNaObratu: number | null } | null;
    const podil = u?.podilNaObratu ?? null;
    return podil && podil > 0 ? podil : null;
  } catch (err) {
    // Záložka navíc nikdy nesmí shodit celé Přehledy.
    console.error('Podíl na obratu se nepodařilo načíst:', err);
    return null;
  }
}
