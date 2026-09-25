import { prisma } from '@/lib/db';
import { computeTotals, formatMoney } from '@/lib/doklady';
import { sendUpominkaEmail } from '@/lib/email';
import { pozdrav } from '@/lib/osloveni';
import {
  VYCHOZI_DNY,
  VYCHOZI_PREDMET,
  VYCHOZI_TEXT,
  dosadDoUpominky,
  kteraUpominka,
  popisDnu,
  type HodnotyUpominky,
} from '@/lib/upominkyFaktur';

/**
 * UPOMÍNKY K FAKTURÁM PO SPLATNOSTI (zadání 25. 9. 2026) - čtení, odesílání
 * a denní úloha. Pravidla a výchozí znění jsou v lib/upominkyFaktur.ts.
 *
 * CO SE POVAŽUJE ZA NEUHRAZENÉ: faktura, která je odeslaná (status SENT),
 * má datum splatnosti v minulosti a není zaplacená. Koncept ani zaplacená
 * faktura upomínku nedostane a stornu se nepřipomíná nic.
 *
 * KOMU SE PÍŠE: stejnému člověku, kterému šla faktura - kontakt firmy, a když
 * ho firma nemá, klient projektu. Nikdy se nehádá adresa odjinud.
 */
const ID = 'upominky';

export type NastaveniUpominek = {
  zapnuto: boolean;
  dny: number[];
  predmet: string;
  text: string;
  kopie: string[];
  upravilJmeno: string | null;
};

export async function nactiNastaveniUpominek(): Promise<NastaveniUpominek> {
  const ulozene = await prisma.nastaveniUpominek.findUnique({ where: { id: ID } }).catch(() => null);
  return {
    zapnuto: ulozene?.zapnuto ?? false,
    dny: ulozene?.dny?.length ? ulozene.dny : [...VYCHOZI_DNY],
    predmet: ulozene?.predmet || VYCHOZI_PREDMET,
    text: ulozene?.text || VYCHOZI_TEXT,
    kopie: ulozene?.kopie ?? [],
    upravilJmeno: ulozene?.upravilJmeno ?? null,
  };
}

export async function ulozNastaveniUpominek(
  vstup: { zapnuto: boolean; dny: number[]; predmet: string; text: string; kopie: string[] },
  kdo: string | null,
): Promise<void> {
  const data = {
    zapnuto: vstup.zapnuto,
    // Dny se ukládají setříděné a bez duplicit - jinak by druhá upomínka mohla
    // vyjít dřív než první.
    dny: Array.from(new Set(vstup.dny.filter((d) => Number.isFinite(d) && d >= 0))).sort((a, b) => a - b),
    predmet: vstup.predmet.trim() || null,
    text: vstup.text.trim() || null,
    kopie: vstup.kopie.map((e) => e.trim()).filter(Boolean),
    upravilJmeno: kdo,
  };
  await prisma.nastaveniUpominek.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
}

/** Faktura po splatnosti tak, jak se ukazuje v seznamu i jak se z ní skládá mail. */
export type FakturaPoSplatnosti = {
  id: string;
  cislo: string;
  firma: string;
  komu: string | null;
  jmeno: string | null;
  castka: string;
  castkaMinor: number;
  mena: string;
  splatnost: string | null;
  splatnostMs: number | null;
  dnuPoSplatnosti: number;
  projekt: string | null;
  /** Kolik upomínek už odešlo a kdy ta poslední. */
  odeslano: number;
  posledniAt: string | null;
};

function dnuPo(due: Date, ted: Date): number {
  return Math.max(0, Math.floor((ted.getTime() - due.getTime()) / 86_400_000));
}

export async function fakturyPoSplatnosti(): Promise<FakturaPoSplatnosti[]> {
  const ted = new Date();
  const faktury = await prisma.invoice
    .findMany({
      where: { status: 'SENT', paidAt: null, dueDate: { lt: ted } },
      orderBy: { dueDate: 'asc' },
      take: 200,
      select: {
        id: true,
        number: true,
        currency: true,
        dueDate: true,
        slevaProcent: true,
        slevaMinor: true,
        projectName: true,
        caflouProjectId: true,
        company: { select: { name: true, contactEmail: true, contactName: true } },
        items: { select: { quantity: true, unitPriceMinor: true, vatRate: true } },
        upominky: { orderBy: { odeslanoAt: 'desc' }, select: { poradi: true, odeslanoAt: true } },
      },
    })
    .catch(() => []);

  /**
   * KOMU SE PÍŠE: kontakt firmy, a když ho firma nemá, klient projektu -
   * stejné pořadí jako při odeslání faktury (viz /api/admin/invoices/[id]/send).
   * Jedním dotazem pro celý seznam, ne projekt po projektu.
   */
  const idProjektu = Array.from(
    new Set(faktury.map((f) => f.caflouProjectId).filter((id): id is string => Boolean(id))),
  );
  const klienti = new Map<string, { email: string | null; jmeno: string | null }>();
  if (idProjektu.length > 0) {
    const meta = await prisma.projectMeta
      .findMany({
        where: { caflouProjectId: { in: idProjektu } },
        select: { caflouProjectId: true, klient: { select: { email: true, name: true } } },
      })
      .catch(() => []);
    for (const m of meta) {
      klienti.set(m.caflouProjectId, { email: m.klient?.email ?? null, jmeno: m.klient?.name ?? null });
    }
  }

  return faktury.map((f) => {
    const klient = f.caflouProjectId ? klienti.get(f.caflouProjectId) : undefined;
    const soucty = computeTotals(f.items, { slevaProcent: f.slevaProcent, slevaMinor: f.slevaMinor });
    return {
      id: f.id,
      cislo: f.number,
      firma: f.company?.name ?? '—',
      komu: f.company?.contactEmail?.trim() || klient?.email?.trim() || null,
      jmeno: f.company?.contactName?.trim() || klient?.jmeno?.trim() || null,
      castka: formatMoney(soucty.incVat, f.currency),
      castkaMinor: soucty.incVat,
      mena: f.currency,
      splatnost: f.dueDate ? new Intl.DateTimeFormat('cs-CZ').format(f.dueDate) : null,
      splatnostMs: f.dueDate ? f.dueDate.getTime() : null,
      dnuPoSplatnosti: f.dueDate ? dnuPo(f.dueDate, ted) : 0,
      projekt: f.projectName,
      odeslano: f.upominky.length,
      posledniAt: f.upominky[0]?.odeslanoAt.toISOString() ?? null,
    };
  });
}

function hodnotyProFakturu(f: FakturaPoSplatnosti, poradi: number): HodnotyUpominky {
  return {
    osloveni: pozdrav(f.jmeno),
    klient: f.jmeno ?? '',
    firma: f.firma,
    cislo: f.cislo,
    castka: f.castka,
    splatnost: f.splatnost ?? '',
    dnu: popisDnu(f.dnuPoSplatnosti),
    poradi: String(poradi),
    projekt: f.projekt ?? '',
  };
}

export type VysledekUpominky =
  | { stav: 'odeslano'; komu: string; poradi: number }
  | { stav: 'chybi-prijemce' }
  | { stav: 'jiz-odeslano' }
  | { stav: 'neni-cas' }
  | { stav: 'chyba'; zprava: string };

/**
 * Pošle upomínku k jedné faktuře. `vynutit` je pro ruční odeslání z portálu -
 * to se neptá, kolikátý je den; jen nepošle dvakrát tutéž upomínku.
 */
export async function posliUpominku(
  faktura: FakturaPoSplatnosti,
  volby: { vynutit?: boolean; kdo?: string | null } = {},
): Promise<VysledekUpominky> {
  const nastaveni = await nactiNastaveniUpominek();
  if (!faktura.komu) return { stav: 'chybi-prijemce' };

  const poradi = volby.vynutit
    ? faktura.odeslano + 1
    : kteraUpominka(nastaveni.dny, faktura.dnuPoSplatnosti, faktura.odeslano);
  if (poradi === null) return { stav: 'neni-cas' };
  if (!volby.vynutit && poradi > nastaveni.dny.length) return { stav: 'jiz-odeslano' };

  const hodnoty = hodnotyProFakturu(faktura, poradi);
  try {
    const vysledek = await sendUpominkaEmail({
      to: faktura.komu,
      kopie: nastaveni.kopie,
      predmet: dosadDoUpominky(nastaveni.predmet, hodnoty),
      text: dosadDoUpominky(nastaveni.text, hodnoty),
      cisloFaktury: faktura.cislo,
      castka: faktura.castka,
      splatnost: faktura.splatnost,
      poradi,
    });
    if (!vysledek.sent) return { stav: 'chyba', zprava: vysledek.reason ?? 'Mail neodešel.' };

    await prisma.upominkaOdeslana.create({
      data: {
        invoiceId: faktura.id,
        poradi,
        komu: faktura.komu,
        poslalJmeno: volby.kdo ?? null,
      },
    });
    return { stav: 'odeslano', komu: faktura.komu, poradi };
  } catch (err) {
    console.error(`Upominka k fakture ${faktura.cislo} selhala:`, err);
    return { stav: 'chyba', zprava: err instanceof Error ? err.message : 'Neznámá chyba.' };
  }
}

export type VysledekUpominek = {
  odeslano: { cislo: string; komu: string; poradi: number }[];
  preskoceno: number;
  vypnuto?: boolean;
};

/** Denní úloha: projde faktury po splatnosti a rozešle, co má dnes jít. */
export async function posliUpominky(): Promise<VysledekUpominek> {
  const nastaveni = await nactiNastaveniUpominek();
  if (!nastaveni.zapnuto) return { odeslano: [], preskoceno: 0, vypnuto: true };

  const faktury = await fakturyPoSplatnosti();
  const odeslano: VysledekUpominek['odeslano'] = [];
  let preskoceno = 0;

  for (const f of faktury) {
    const vysledek = await posliUpominku(f);
    if (vysledek.stav === 'odeslano') {
      odeslano.push({ cislo: f.cislo, komu: vysledek.komu, poradi: vysledek.poradi });
    } else {
      preskoceno += 1;
    }
  }

  return { odeslano, preskoceno };
}
