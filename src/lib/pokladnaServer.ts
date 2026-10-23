import type { Currency } from '@prisma/client';
import { prisma } from '@/lib/db';
import { expandNumberFormat } from '@/lib/doklady';
import { expenseTotalMinor } from '@/lib/expenses';
import { vychoziFirma } from '@/lib/naseFirmyServer';
import { SMERY, VYCHOZI_NAZEV, secti, zustatkyPoRadcich, type Smer } from '@/lib/pokladna';

/**
 * POKLADNA - serverová část (zadání 23. 10. 2026: „potřebuju někde udělat
 * pokladnu"). Co která funkce počítá, je popsané u lib/pokladna.ts.
 *
 * Dvě pravidla, na kterých tady všechno stojí:
 *
 * 1. ZŮSTATEK SE NEUKLÁDÁ. Počítá se z počátečního stavu a dokladů pokaždé
 *    znovu. Uložené číslo by se po první opravě dokladu rozešlo s knihou.
 *
 * 2. HOTOVĚ ZAPLACENÝ VÝDAJ SI POKLADNA DRŽÍ SAMA (zadání: propojit „jen
 *    výdaje"). Účtenka se zadává jednou - ve Výdajích - a do pokladny spadne
 *    jako výdajový doklad. Opraví se částka, srovná se i pokladna; zruší se
 *    úhrada, zmizí i doklad. Ručně se takový řádek v pokladně needituje,
 *    jinak by existovaly dvě pravdy o jedné stokoruně.
 */

/** Výdaj v cizí měně se do pokladny nepřenáší - viz `srovnejPokladnuVydaje`. */
type ExpenseProPokladnu = {
  id: string;
  number: string | null;
  description: string | null;
  issuerCompanyId: string | null;
  currency: Currency;
  amountExVatMinor: number;
  vatRate: number;
  issueDate: Date;
  paid: boolean;
  paidAt: Date | null;
  paymentMethod: string;
  supplierName: string | null;
  supplier: { name: string } | null;
  uhrady: {
    id: string;
    castkaMinor: number;
    datum: Date;
    zpusob: string;
    poznamka: string | null;
    kdoId: string | null;
    kdoJmeno: string | null;
  }[];
};

export type PokladnaData = {
  id: string;
  issuerCompanyId: string;
  /** Prázdné = použije se VYCHOZI_NAZEV, viz lib/pokladna.ts. */
  nazev: string | null;
  mena: Currency;
  pocatecniStavMinor: number;
  pocatecniDatum: Date;
  radaPrijem: string;
  dalsiPrijem: number;
  radaVydej: string;
  dalsiVydej: number;
};

/**
 * Pokladna naší firmy; když ještě není, založí se. Záměrně se nezakládají
 * dopředu pro všechny firmy - pokladna, do které nikdo nikdy nesáhl, by jen
 * mátla v přehledu.
 */
export async function zajistiPokladnu(issuerCompanyId: string): Promise<PokladnaData | null> {
  const stavajici = await prisma.pokladna
    .findUnique({ where: { issuerCompanyId } })
    .catch(() => null);
  if (stavajici) return stavajici as unknown as PokladnaData;

  const firma = await prisma.issuerCompany
    .findUnique({ where: { id: issuerCompanyId }, select: { defaultCurrency: true } })
    .catch(() => null);
  if (!firma) return null;

  return (await prisma.pokladna
    .create({
      data: {
        issuerCompanyId,
        nazev: VYCHOZI_NAZEV,
        mena: firma.defaultCurrency,
      },
    })
    .catch(async () => {
      // Dva požadavky naráz - ten druhý si prostě přečte, co založil první.
      return prisma.pokladna.findUnique({ where: { issuerCompanyId } }).catch(() => null);
    })) as unknown as PokladnaData | null;
}

/**
 * Přidělení čísla z řady. Když číslo v knize už je (někdo si přenastavil
 * pořadí, nebo se dva doklady zakládaly naráz), zkusí se další - díru v řadě
 * je lepší nechat vzniknout než doklad neuložit.
 */
async function pridelCislo(
  pokladna: PokladnaData,
  smer: Smer,
  datum: Date,
): Promise<string | null> {
  const prijem = smer === SMERY.prijem;
  const rada = prijem ? pokladna.radaPrijem : pokladna.radaVydej;
  let poradi = prijem ? pokladna.dalsiPrijem : pokladna.dalsiVydej;

  for (let pokus = 0; pokus < 50; pokus++) {
    const cislo = expandNumberFormat(rada, poradi, datum);
    const obsazeno = await prisma.pokladniDoklad
      .findFirst({ where: { pokladnaId: pokladna.id, cislo }, select: { id: true } })
      .catch(() => null);
    if (obsazeno) {
      poradi += 1;
      continue;
    }
    await prisma.pokladna
      .update({
        where: { id: pokladna.id },
        data: prijem ? { dalsiPrijem: poradi + 1 } : { dalsiVydej: poradi + 1 },
      })
      .catch(() => undefined);
    return cislo;
  }
  return null;
}

export type NovyDoklad = {
  smer: Smer;
  datum: Date;
  castkaMinor: number;
  vatRate?: number;
  ucel: string;
  protistrana?: string | null;
  poznamka?: string | null;
  kdoId?: string | null;
  kdoJmeno?: string | null;
};

export async function zalozDoklad(
  issuerCompanyId: string,
  vstup: NovyDoklad,
): Promise<{ ok: boolean; chyba?: string }> {
  const pokladna = await zajistiPokladnu(issuerCompanyId);
  if (!pokladna) return { ok: false, chyba: 'Pokladna téhle firmy se nenašla.' };

  const cislo = await pridelCislo(pokladna, vstup.smer, vstup.datum);
  if (!cislo) return { ok: false, chyba: 'Nepodařilo se přidělit číslo dokladu.' };

  const zalozeno = await prisma.pokladniDoklad
    .create({
      data: {
        pokladnaId: pokladna.id,
        cislo,
        smer: vstup.smer,
        datum: vstup.datum,
        castkaMinor: Math.abs(Math.round(vstup.castkaMinor)),
        vatRate: vstup.vatRate ?? 0,
        ucel: vstup.ucel,
        protistrana: vstup.protistrana?.trim() || null,
        poznamka: vstup.poznamka?.trim() || null,
        kdoId: vstup.kdoId ?? null,
        kdoJmeno: vstup.kdoJmeno ?? null,
      },
      select: { id: true },
    })
    .catch((err) => {
      console.error('Pokladní doklad se nepodařilo uložit:', err);
      return null;
    });

  return zalozeno ? { ok: true } : { ok: false, chyba: 'Doklad se nepodařilo uložit.' };
}

/** Popis výdaje na pokladní doklad. Číslo dokladu napřed - podle něj se hledá. */
function ucelZVydaje(e: ExpenseProPokladnu): string {
  const casti = [e.number?.trim(), e.description?.trim()].filter(Boolean);
  return casti.length > 0 ? casti.join(' · ') : 'Hotovostní výdaj';
}

/**
 * SROVNÁNÍ POKLADNY S JEDNÍM VÝDAJEM. Volá se po každé změně výdaje i jeho
 * úhrad (lib/uhradyVydajeServer.ts a routa výdaje).
 *
 * Co se do pokladny dostane:
 *  - každá ÚHRADA výdaje se způsobem „hotově" jako samostatný výdajový doklad,
 *  - a když výdaj žádné úhrady zapsané nemá (tisíce starších dokladů), bere se
 *    postaru: uhrazený doklad se způsobem úhrady „hotově" jako jeden výdaj
 *    na celou částku. Stejné pravidlo jako `uhrazenoMinor` v lib/expenses.ts.
 *
 * CIZÍ MĚNA SE NEPŘENÁŠÍ. Pokladna je vedená v jedné měně a přepočet účtenky
 * kurzem by do hotovosti dal částku, která v krabici nikdy nebyla. Takový
 * výdaj se do pokladny zapíše ručně, když se z ní doopravdy platil.
 */
export async function srovnejPokladnuVydaje(expenseId: string): Promise<void> {
  try {
    const vydaj = (await prisma.expense.findUnique({
      where: { id: expenseId },
      select: {
        id: true,
        number: true,
        description: true,
        issuerCompanyId: true,
        currency: true,
        amountExVatMinor: true,
        vatRate: true,
        issueDate: true,
        paid: true,
        paidAt: true,
        paymentMethod: true,
        supplierName: true,
        supplier: { select: { name: true } },
        uhrady: {
          orderBy: { datum: 'asc' },
          select: {
            id: true,
            castkaMinor: true,
            datum: true,
            zpusob: true,
            poznamka: true,
            kdoId: true,
            kdoJmeno: true,
          },
        },
      },
    })) as unknown as ExpenseProPokladnu | null;

    const stavajici = await prisma.pokladniDoklad.findMany({
      where: { expenseId },
      select: { id: true, uhradaId: true, pokladnaId: true },
    });

    const zahod = async (ids: string[]) => {
      if (ids.length === 0) return;
      await prisma.pokladniDoklad.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    };

    if (!vydaj) {
      await zahod(stavajici.map((d) => d.id));
      return;
    }

    const issuerId = vydaj.issuerCompanyId ?? (await vychoziFirma());
    if (!issuerId) {
      await zahod(stavajici.map((d) => d.id));
      return;
    }

    const pokladna = await zajistiPokladnu(issuerId);
    if (!pokladna || pokladna.mena !== vydaj.currency) {
      await zahod(stavajici.map((d) => d.id));
      return;
    }

    const ucel = ucelZVydaje(vydaj);
    const protistrana = vydaj.supplier?.name ?? vydaj.supplierName ?? null;

    type Pozadovany = {
      uhradaId: string | null;
      datum: Date;
      castkaMinor: number;
      poznamka: string | null;
      kdoId: string | null;
      kdoJmeno: string | null;
    };

    const pozadovane: Pozadovany[] =
      vydaj.uhrady.length > 0
        ? vydaj.uhrady
            .filter((u) => u.zpusob === 'CASH')
            .map((u) => ({
              uhradaId: u.id,
              datum: u.datum,
              castkaMinor: u.castkaMinor,
              poznamka: u.poznamka,
              kdoId: u.kdoId,
              kdoJmeno: u.kdoJmeno,
            }))
        : vydaj.paid && vydaj.paymentMethod === 'CASH'
          ? [
              {
                uhradaId: null,
                datum: vydaj.paidAt ?? vydaj.issueDate,
                castkaMinor: expenseTotalMinor(vydaj.amountExVatMinor, vydaj.vatRate),
                poznamka: null,
                kdoId: null,
                kdoJmeno: null,
              },
            ]
          : [];

    // Co už v pokladně je, ale nemá tam co dělat.
    const chtene = new Set(pozadovane.map((p) => p.uhradaId ?? ''));
    await zahod(
      stavajici
        .filter((d) => !chtene.has(d.uhradaId ?? '') || d.pokladnaId !== pokladna.id)
        .map((d) => d.id),
    );

    for (const p of pozadovane) {
      const uz = stavajici.find(
        (d) => (d.uhradaId ?? '') === (p.uhradaId ?? '') && d.pokladnaId === pokladna.id,
      );
      if (uz) {
        await prisma.pokladniDoklad
          .update({
            where: { id: uz.id },
            data: {
              datum: p.datum,
              castkaMinor: Math.abs(p.castkaMinor),
              vatRate: vydaj.vatRate,
              ucel,
              protistrana,
              poznamka: p.poznamka,
            },
          })
          .catch(() => undefined);
        continue;
      }

      const cislo = await pridelCislo(pokladna, SMERY.vydej, p.datum);
      if (!cislo) continue;
      await prisma.pokladniDoklad
        .create({
          data: {
            pokladnaId: pokladna.id,
            cislo,
            smer: SMERY.vydej,
            datum: p.datum,
            castkaMinor: Math.abs(p.castkaMinor),
            vatRate: vydaj.vatRate,
            ucel,
            protistrana,
            poznamka: p.poznamka,
            kdoId: p.kdoId,
            kdoJmeno: p.kdoJmeno,
            expenseId: vydaj.id,
            uhradaId: p.uhradaId,
          },
        })
        .catch((err) => {
          console.error('Pokladní doklad z výdaje se nepodařilo založit:', err);
          return null;
        });
    }
  } catch (err) {
    // Pokladna nesmí shodit uložení výdaje - srovná se při příští změně.
    console.error('Srovnání pokladny podle výdaje selhalo:', err);
  }
}

export type RadekKnihy = {
  id: string;
  cislo: string;
  smer: Smer;
  datum: Date;
  castkaMinor: number;
  vatRate: number;
  ucel: string;
  protistrana: string | null;
  poznamka: string | null;
  kdoJmeno: string | null;
  expenseId: string | null;
  zustatekMinor: number;
};

export type Kniha = {
  pokladna: PokladnaData;
  rok: number;
  roky: number[];
  /** Zůstatek k 1. 1. vybraného roku - počáteční stav plus všechno starší. */
  pocatekRokuMinor: number;
  radky: RadekKnihy[];
  prijmyMinor: number;
  vydajeMinor: number;
  zustatekMinor: number;
};

/**
 * Pokladní kniha jedné firmy za jeden rok. Roky se nabízejí podle toho, kde
 * jsou doklady - prázdné roky v přepínači nikoho nezajímají.
 */
export async function nactiKnihu(issuerCompanyId: string, rok?: number): Promise<Kniha | null> {
  const pokladna = await zajistiPokladnu(issuerCompanyId);
  if (!pokladna) return null;

  type RadekZDb = {
    id: string;
    cislo: string;
    smer: string;
    datum: Date;
    castkaMinor: number;
    vatRate: number;
    ucel: string;
    protistrana: string | null;
    poznamka: string | null;
    kdoJmeno: string | null;
    expenseId: string | null;
  };

  const vsechny = (await prisma.pokladniDoklad
    .findMany({
      where: { pokladnaId: pokladna.id },
      orderBy: [{ datum: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        cislo: true,
        smer: true,
        datum: true,
        castkaMinor: true,
        vatRate: true,
        ucel: true,
        protistrana: true,
        poznamka: true,
        kdoJmeno: true,
        expenseId: true,
      },
    })
    .catch(() => [])) as unknown as RadekZDb[];

  const roky = Array.from(
    new Set([
      ...vsechny.map((d) => d.datum.getFullYear()),
      pokladna.pocatecniDatum.getFullYear(),
      new Date().getFullYear(),
    ]),
  ).sort((a, b) => b - a);

  const vybrany = rok && roky.includes(rok) ? rok : (roky[0] ?? new Date().getFullYear());

  const starsi = vsechny.filter((d) => d.datum.getFullYear() < vybrany);
  const letosni = vsechny.filter((d) => d.datum.getFullYear() === vybrany);

  const pocatekRokuMinor =
    pokladna.pocatecniStavMinor +
    secti(starsi.map((d) => ({ smer: d.smer as Smer, castkaMinor: d.castkaMinor }))).zmenaMinor;

  const sZustatkem = zustatkyPoRadcich(
    pocatekRokuMinor,
    letosni.map((d) => ({ ...d, smer: d.smer as Smer })),
  );
  const soucet = secti(letosni.map((d) => ({ smer: d.smer as Smer, castkaMinor: d.castkaMinor })));

  return {
    pokladna,
    rok: vybrany,
    roky,
    pocatekRokuMinor,
    radky: sZustatkem,
    prijmyMinor: soucet.prijmyMinor,
    vydajeMinor: soucet.vydajeMinor,
    zustatekMinor: pocatekRokuMinor + soucet.zmenaMinor,
  };
}
