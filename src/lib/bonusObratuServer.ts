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
  /** Roky, ve kterých je co ukazovat - do přepínače nad přehledem. */
  roky: number[];
  /** Měsíc, který právě běží (1-12), nebo null u staršího roku. */
  rozjetyMesic: number | null;
};

/** Bonus z obratu. Zaokrouhluje se až tady, ať to sedí s tím, co je vidět. */
export function bonusZObratu(obrat: number, procento: number): number {
  return Math.round((obrat * procento) / 100);
}

export async function nactiBonusyObratu(rokVstup?: number, dnes = new Date()): Promise<BonusyData> {
  /**
   * ROK SE PŘEPÍNÁ (zadání 6. 10. 2026: „a ještě bych měl mít já možnost
   * upravit ta procenta a získat nějaké grafy a přehledy za minulé měsíce
   * a pod."). Bez roku se bere ten letošní.
   */
  const rok = rokVstup && rokVstup >= 2000 && rokVstup <= 2100 ? rokVstup : dnes.getFullYear();
  const od = new Date(rok, 0, 1);
  const doKdy = new Date(rok + 1, 0, 1);

  const [faktury, lide, nejstarsi] = await Promise.all([
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
    // Od kdy vubec mame faktury - z toho se sklada prepinac roku.
    prisma.invoice.findFirst({
      where: { status: { in: ['SENT', 'PAID'] } },
      orderBy: { issueDate: 'asc' },
      select: { issueDate: true },
    }) as unknown as Promise<{ issueDate: Date } | null>,
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

  const letos = dnes.getFullYear();
  const prvniRok = Math.min(nejstarsi?.issueDate.getFullYear() ?? letos, rok, letos);
  const roky: number[] = [];
  for (let r = letos; r >= prvniRok; r -= 1) roky.push(r);

  return {
    rok,
    mesice,
    obratRoku,
    lide: lide.map((u) => ({
      id: u.id,
      jmeno: u.name || u.email,
      procento: u.podilNaObratu ?? 0,
    })),
    roky,
    rozjetyMesic: rok === letos ? dnes.getMonth() + 1 : null,
  };
}

/**
 * OBRAT JEDNOHO MĚSÍCE (6. 10. 2026: „u těch přehledů bonusů dej ještě na první
 * pohled minulý měsíc a tento měsíc").
 *
 * Minulý měsíc je skoro vždycky už v `mesice` z `nactiBonusyObratu`. Jediná
 * výjimka je LEDEN: tam leží prosinec v jiném roce, a ten by se jinak musel
 * tažit celý jen kvůli jedné dlaždici. Pro ten jeden případ je tahle funkce.
 *
 * Základ je stejný jako výš - vystavené faktury podle data vystavení, bez DPH,
 * kurzem uloženým u dokladu.
 */
export async function obratMesice(rok: number, mesic: number): Promise<number> {
  if (!(rok >= 2000 && rok <= 2100) || !(mesic >= 1 && mesic <= 12)) return 0;
  const od = new Date(rok, mesic - 1, 1);
  const doKdy = new Date(rok, mesic, 1);
  try {
    const faktury = (await prisma.invoice.findMany({
      where: { status: { in: ['SENT', 'PAID'] }, issueDate: { gte: od, lt: doKdy } },
      select: {
        exchangeRate: true,
        slevaProcent: true,
        slevaMinor: true,
        items: { select: { quantity: true, unitPriceMinor: true, vatRate: true } },
      },
    })) as unknown as {
      exchangeRate: number;
      slevaProcent: number;
      slevaMinor: number;
      items: PolozkaDokladu[];
    }[];
    return faktury.reduce((soucet, f) => soucet + bezDph(f.items, f, f.exchangeRate), 0);
  } catch (err) {
    // Dlaždice navíc nikdy nesmí shodit celý přehled.
    console.error('Obrat měsíce se nepodařilo načíst:', err);
    return 0;
  }
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
