import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { computeTotals } from '@/lib/doklady';
import type { MesicObratu } from '@/lib/palubovka';

/**
 * DATA PRO PALUBOVKU (zadání 27. 9. 2026).
 *
 * Dvě čísla nesou celou stránku, tak ať jsou obě poctivá:
 *
 * VYFAKTUROVÁNO = odeslané a uhrazené faktury, částka BEZ DPH, přepočtená
 * kurzem uloženým na dokladu. Rozpracované (DRAFT) se nepočítají - ty ještě
 * nikam neodešly - a stornované taky ne.
 *
 * ROZPRACOVÁNO (palivo) = u neukončených projektů schválená nebo odeslaná
 * nabídka MÍNUS to, co už je z projektu vyfakturované. Zbytek je práce, která
 * se teprve promění v peníze. Kde nabídka není, ale je to audiokniha se
 * zadanými normostranami, spočítá se ze sazby klienta - jinak by půlka knih
 * v palivu chyběla.
 *
 * MĚNY: faktura si nese kurz ke dni vystavení, takže se přepočítá. Nabídka
 * kurz nemá, proto se do paliva berou jen nabídky v korunách; cizoměnové jsou
 * u nás výjimka a je lepší palivo podhodnotit než si vymýšlet kurz.
 */

export async function smiNaPalubovku(userId?: string | null): Promise<boolean> {
  const id = userId ?? (await getServerSession(authOptions))?.user?.id;
  if (!id) return false;
  const u = (await prisma.user.findUnique({
    where: { id },
    select: { active: true, vidiPalubovku: true },
  })) as { active: boolean; vidiPalubovku: boolean } | null;
  return Boolean(u?.active && u.vidiPalubovku);
}

export type Cile = {
  mesicniObrat: number | null;
  rocniObrat: number | null;
  mesicuKryti: number;
  /**
   * Čistý zisk z uzavřených audioknih za měsíc (zadání 28. 9. 2026). Kč bez
   * DPH. Bydlí to u cílů palubovky, protože je to totéž zvíře - číslo, proti
   * kterému se měří budík - a druhá tabulka na jeden řádek by byla zbytečná.
   */
  mesicniZiskKnih: number | null;
};

/** Bez zadaného cíle se měří proti 400 000 Kč (zadání 28. 9. 2026). */
export const VYCHOZI_ZISK_KNIH = 400_000;

export async function nactiCile(): Promise<Cile> {
  const c = (await prisma.cilePalubovky.findUnique({ where: { id: 'hlavni' } })) as {
    mesicniObrat: number | null;
    rocniObrat: number | null;
    mesicuKryti: number;
    mesicniZiskKnih: number | null;
  } | null;
  return {
    mesicniObrat: c?.mesicniObrat ?? null,
    rocniObrat: c?.rocniObrat ?? null,
    mesicuKryti: c?.mesicuKryti ?? 2,
    mesicniZiskKnih: c?.mesicniZiskKnih ?? null,
  };
}

export async function ulozCile(zmena: Partial<Cile>): Promise<Cile> {
  const data = {
    mesicniObrat: zmena.mesicniObrat ?? null,
    rocniObrat: zmena.rocniObrat ?? null,
    mesicuKryti: zmena.mesicuKryti ?? 2,
    mesicniZiskKnih: zmena.mesicniZiskKnih ?? null,
  };
  await prisma.cilePalubovky.upsert({
    where: { id: 'hlavni' },
    create: { id: 'hlavni', ...data },
    update: data,
  });
  return nactiCile();
}

type PolozkaDokladu = { quantity: number; unitPriceMinor: number; vatRate: number };
type Sleva = { slevaProcent: number; slevaMinor: number };

function bezDph(items: PolozkaDokladu[], sleva: Sleva, kurz = 1): number {
  return (computeTotals(items, sleva).exVat / 100) * (kurz || 1);
}

export type ProjektVPalivu = {
  caflouProjectId: string;
  nazev: string;
  firma: string | null;
  /** Kolik z projektu ještě není vyfakturované (Kč bez DPH). */
  zbyva: number;
  /** Datum dokončení - podle něj se pozná, kdy se palivo promění v peníze. */
  termin: string | null;
  /** Odhad z normostran, ne z nabídky - do tabulky se to napíše. */
  odhad: boolean;
};

export type PalubovkaData = {
  /** Posledních 13 měsíců včetně toho rozjetého; poslední prvek = tenhle měsíc. */
  rady: MesicObratu[];
  /** Vyfakturováno od ledna. */
  odZacatkuRoku: number;
  /** Stejný měsíc loni - proti čemu se dnešek poměřuje. */
  stejnyMesicLoni: number | null;
  palivoCelkem: number;
  projektyVPalivu: ProjektVPalivu[];
  /** Kolik projektů je v palivu celkem (tabulka ukazuje jen špičku). */
  projektuVPalivu: number;
};

export async function nactiPalubovku(dnes = new Date()): Promise<PalubovkaData> {
  const rok = dnes.getFullYear();
  const mesic = dnes.getMonth();
  const od = new Date(rok, mesic - 12, 1);

  const faktury = (await prisma.invoice.findMany({
    where: { status: { in: ['SENT', 'PAID'] }, issueDate: { gte: od } },
    select: {
      issueDate: true,
      paidAt: true,
      status: true,
      exchangeRate: true,
      slevaProcent: true,
      slevaMinor: true,
      items: { select: { quantity: true, unitPriceMinor: true, vatRate: true } },
    },
  })) as unknown as {
    issueDate: Date;
    paidAt: Date | null;
    status: string;
    exchangeRate: number;
    slevaProcent: number;
    slevaMinor: number;
    items: PolozkaDokladu[];
  }[];

  const rady: MesicObratu[] = [];
  for (let i = 12; i >= 0; i -= 1) {
    const d = new Date(rok, mesic - i, 1);
    rady.push({ rok: d.getFullYear(), mesic: d.getMonth() + 1, vyfakturovano: 0, uhrazeno: 0 });
  }
  const klic = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}`;
  const podleKlice = new Map(rady.map((m) => [`${m.rok}-${m.mesic}`, m]));

  let odZacatkuRoku = 0;
  for (const f of faktury) {
    const castka = bezDph(f.items, f, f.exchangeRate);
    const radek = podleKlice.get(klic(f.issueDate));
    if (radek) {
      radek.vyfakturovano += castka;
      if (f.status === 'PAID') radek.uhrazeno += castka;
    }
    if (f.issueDate.getFullYear() === rok) odZacatkuRoku += castka;
  }

  const loni = podleKlice.get(`${rok - 1}-${mesic + 1}`);
  const stejnyMesicLoni = loni ? loni.vyfakturovano : null;

  /* ---------- PALIVO ---------------------------------------------------- */

  const projekty = (await prisma.projectMeta.findMany({
    where: { finished: false },
    select: {
      caflouProjectId: true,
      name: true,
      companyName: true,
      pageCount: true,
      endDate: true,
      company: { select: { name: true, ratePerPage: true } },
    },
  })) as unknown as {
    caflouProjectId: string;
    name: string | null;
    companyName: string | null;
    pageCount: number | null;
    endDate: Date | null;
    company: { name: string; ratePerPage: number | null } | null;
  }[];

  const ids = projekty.map((p) => p.caflouProjectId);
  if (ids.length === 0) {
    return { rady, odZacatkuRoku, stejnyMesicLoni, palivoCelkem: 0, projektyVPalivu: [], projektuVPalivu: 0 };
  }

  const [nabidky, fakturyProjektu] = await Promise.all([
    prisma.offer.findMany({
      where: { caflouProjectId: { in: ids }, status: { in: ['SENT', 'APPROVED'] }, currency: 'CZK' },
      select: {
        caflouProjectId: true,
        slevaProcent: true,
        slevaMinor: true,
        items: { select: { quantity: true, unitPriceMinor: true, vatRate: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { caflouProjectId: { in: ids }, status: { in: ['SENT', 'PAID'] } },
      select: {
        caflouProjectId: true,
        exchangeRate: true,
        slevaProcent: true,
        slevaMinor: true,
        items: { select: { quantity: true, unitPriceMinor: true, vatRate: true } },
      },
    }),
  ]);

  const soucet = new Map<string, { nabidnuto: number; vyfakturovano: number }>();
  const dej = (id: string) => {
    const uz = soucet.get(id);
    if (uz) return uz;
    const novy = { nabidnuto: 0, vyfakturovano: 0 };
    soucet.set(id, novy);
    return novy;
  };
  for (const n of nabidky as unknown as {
    caflouProjectId: string | null;
    slevaProcent: number;
    slevaMinor: number;
    items: PolozkaDokladu[];
  }[]) {
    if (!n.caflouProjectId) continue;
    dej(n.caflouProjectId).nabidnuto += bezDph(n.items, n);
  }
  for (const f of fakturyProjektu as unknown as {
    caflouProjectId: string | null;
    exchangeRate: number;
    slevaProcent: number;
    slevaMinor: number;
    items: PolozkaDokladu[];
  }[]) {
    if (!f.caflouProjectId) continue;
    dej(f.caflouProjectId).vyfakturovano += bezDph(f.items, f, f.exchangeRate);
  }

  const vPalivu: ProjektVPalivu[] = [];
  for (const p of projekty) {
    const s = soucet.get(p.caflouProjectId) ?? { nabidnuto: 0, vyfakturovano: 0 };
    // Bez nabídky se u audioknihy dá cena odhadnout z normostran a sazby
    // klienta - je to totéž, z čeho se dělá rozpočet.
    const odhad = s.nabidnuto === 0 && Boolean(p.pageCount && p.company?.ratePerPage);
    const hodnota = odhad ? (p.pageCount ?? 0) * (p.company?.ratePerPage ?? 0) : s.nabidnuto;
    const zbyva = Math.max(0, hodnota - s.vyfakturovano);
    if (zbyva <= 0) continue;
    vPalivu.push({
      caflouProjectId: p.caflouProjectId,
      nazev: p.name || `Projekt ${p.caflouProjectId}`,
      firma: p.company?.name ?? p.companyName ?? null,
      zbyva,
      termin: p.endDate ? p.endDate.toISOString() : null,
      odhad,
    });
  }
  vPalivu.sort((a, b) => b.zbyva - a.zbyva);

  return {
    rady,
    odZacatkuRoku,
    stejnyMesicLoni,
    palivoCelkem: vPalivu.reduce((s, p) => s + p.zbyva, 0),
    projektyVPalivu: vPalivu.slice(0, 8),
    projektuVPalivu: vPalivu.length,
  };
}
