/**
 * NOVINKY PORTÁLU - práce s daty (zadání 17. 10. 2026).
 *
 * Čtení, zápis a sestavení měsíčního newsletteru. Číselníky (publika, typy)
 * jsou v lib/novinky.ts, aby je mohly používat i klientské komponenty.
 */
import { prisma } from '@/lib/db';
import {
  KODY_PUBLIK,
  KODY_TYPU,
  klicNovinky,
  labelPublika,
  mesicKlice,
  mesicTextem,
  type Publikum,
} from '@/lib/novinky';

export type Novinka = {
  id: string;
  klic: string;
  datum: Date;
  nazev: string;
  popis: string;
  proNewsletter: string | null;
  modul: string;
  typ: string;
  publikum: string[];
  zverejneno: boolean;
  odeslanoAt: Date | null;
};

const VYBER = {
  id: true,
  klic: true,
  datum: true,
  nazev: true,
  popis: true,
  proNewsletter: true,
  modul: true,
  typ: true,
  publikum: true,
  zverejneno: true,
  odeslanoAt: true,
} as const;

/**
 * Celá historie, od nejnovějšího. Rozepsané novinky vidí jen ten, kdo smí
 * psát - ostatním se nenabízejí.
 */
export async function nactiNovinky(vcetneRozepsanych: boolean): Promise<Novinka[]> {
  const radky = await prisma.novinkaPortalu
    .findMany({
      where: vcetneRozepsanych ? {} : { zverejneno: true },
      orderBy: [{ datum: 'desc' }, { createdAt: 'desc' }],
      select: VYBER,
    })
    .catch(() => []);
  return radky as Novinka[];
}

/** Moduly, které už v historii jsou - do našeptávače ve formuláři. */
export async function seznamModulu(): Promise<string[]> {
  const radky = await prisma.novinkaPortalu
    .findMany({ distinct: ['modul'], select: { modul: true }, orderBy: { modul: 'asc' } })
    .catch(() => []);
  return (radky as { modul: string }[]).map((r) => r.modul).filter(Boolean);
}

export type ZapisNovinky = {
  datum: string;
  nazev: string;
  popis: string;
  proNewsletter?: string | null;
  modul?: string;
  typ?: string;
  publikum?: string[];
  zverejneno?: boolean;
};

function ocisti(vstup: ZapisNovinky) {
  const datum = new Date(`${vstup.datum}T12:00:00.000Z`);
  if (Number.isNaN(datum.getTime())) throw new Error('Datum nedává smysl.');
  const nazev = vstup.nazev.trim();
  if (!nazev) throw new Error('Novinka musí mít název.');
  const typ = KODY_TYPU.includes(vstup.typ as never) ? (vstup.typ as string) : 'VYLEPSENI';
  const publikum = (vstup.publikum ?? []).filter((p) => KODY_PUBLIK.includes(p as Publikum));
  const proNewsletter = (vstup.proNewsletter ?? '').trim();
  return {
    datum,
    nazev,
    popis: vstup.popis.trim(),
    proNewsletter: proNewsletter || null,
    modul: (vstup.modul ?? '').trim() || 'Ostatní',
    typ,
    publikum,
    zverejneno: vstup.zverejneno !== false,
  };
}

export async function zalozNovinku(vstup: ZapisNovinky): Promise<string> {
  const data = ocisti(vstup);
  /**
   * Klíč z data a názvu. Když už takový existuje (dvě novinky stejného dne
   * se stejným názvem), přidá se pořadí - klíč musí zůstat jedinečný.
   */
  const zaklad = klicNovinky(data.datum, data.nazev);
  let klic = zaklad;
  for (let poradi = 2; poradi < 50; poradi++) {
    const uz = await prisma.novinkaPortalu.findUnique({ where: { klic }, select: { id: true } });
    if (!uz) break;
    klic = `${zaklad}-${poradi}`;
  }
  const vznikla = await prisma.novinkaPortalu.create({ data: { ...data, klic }, select: { id: true } });
  return (vznikla as { id: string }).id;
}

export async function upravNovinku(id: string, vstup: ZapisNovinky): Promise<void> {
  const data = ocisti(vstup);
  await prisma.novinkaPortalu.update({ where: { id }, data });
}

export async function smazNovinku(id: string): Promise<void> {
  await prisma.novinkaPortalu.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// NEWSLETTER
// ---------------------------------------------------------------------------

export type Newsletter = {
  mesic: string;
  mesicTextem: string;
  publikum: string;
  publikumTextem: string;
  pocet: number;
  text: string;
  idcka: string[];
};

/**
 * MĚSÍČNÍ PŘEHLED PRO JEDNO PUBLIKUM (zadání 17. 10. 2026: „bude to pak
 * i slouzit k ziskani prehledu na newslettery, ktere chci pak rozesilat
 * jednou za mesic").
 *
 * Bere jen zveřejněné novinky daného měsíce, které mají zaškrtnuté tohle
 * publikum. Text je prostý - má se odsud zkopírovat do mailingu, ne se
 * tvářit jako hotový e-mail.
 *
 * ODESLANÉ SE PŘESKAKUJÍ. Když se novinka v některém newsletteru už poslala,
 * podruhé se do přehledu nedostane, ledaže si člověk vyžádá i ty odeslané -
 * od toho je `vcetneOdeslanych`.
 */
export async function sestavNewsletter(
  mesic: string,
  publikum: string,
  vcetneOdeslanych = false,
): Promise<Newsletter> {
  const [rok, cisloMesice] = mesic.split('-').map(Number);
  const od = new Date(Date.UTC(rok, cisloMesice - 1, 1));
  const do_ = new Date(Date.UTC(rok, cisloMesice, 1));

  const radky = (await prisma.novinkaPortalu
    .findMany({
      where: {
        zverejneno: true,
        datum: { gte: od, lt: do_ },
        publikum: { has: publikum },
        ...(vcetneOdeslanych ? {} : { odeslanoAt: null }),
      },
      orderBy: [{ datum: 'asc' }],
      select: VYBER,
    })
    .catch(() => [])) as Novinka[];

  // Pořadí: nejdřív nové moduly, pak vylepšení, nakonec opravy.
  const vahaTypu = (typ: string) => (typ === 'MODUL' ? 0 : typ === 'VYLEPSENI' ? 1 : 2);
  const serazene = [...radky].sort(
    (a, b) => vahaTypu(a.typ) - vahaTypu(b.typ) || a.modul.localeCompare(b.modul, 'cs'),
  );

  const radkyTextu: string[] = [`Co je nového v MS portálu – ${mesicTextem(mesic)}`, ''];
  let poslednicModul = '';
  for (const n of serazene) {
    if (n.modul !== poslednicModul) {
      if (poslednicModul) radkyTextu.push('');
      radkyTextu.push(`${n.modul}`);
      poslednicModul = n.modul;
    }
    radkyTextu.push(`• ${n.nazev}`);
    const text = (n.proNewsletter ?? n.popis).trim();
    if (text) radkyTextu.push(`  ${text.replace(/\n+/g, ' ')}`);
  }

  return {
    mesic,
    mesicTextem: mesicTextem(mesic),
    publikum,
    publikumTextem: labelPublika(publikum),
    pocet: serazene.length,
    text: serazene.length ? radkyTextu.join('\n') : '',
    idcka: serazene.map((n) => n.id),
  };
}

/** Měsíce, ve kterých něco je - do výběru nad newsletterem. */
export async function mesiceSNovinkami(): Promise<string[]> {
  const radky = (await prisma.novinkaPortalu
    .findMany({ where: { zverejneno: true }, select: { datum: true }, orderBy: { datum: 'desc' } })
    .catch(() => [])) as { datum: Date }[];
  return [...new Set(radky.map((r) => mesicKlice(new Date(r.datum))))];
}

/** Po rozeslání - ať se tytéž věci nepošlou příští měsíc znovu. */
export async function oznacOdeslane(idcka: string[]): Promise<number> {
  if (!idcka.length) return 0;
  const vysledek = await prisma.novinkaPortalu.updateMany({
    where: { id: { in: idcka }, odeslanoAt: null },
    data: { odeslanoAt: new Date() },
  });
  return (vysledek as { count: number }).count;
}
