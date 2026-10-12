import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { SEKCE, type Sekce, type UkazkaData } from '@/lib/prezentaceNabidky';
import { naData } from '@/lib/ukazkyServer';
import { notify } from '@/lib/notifications';

/**
 * NABÍDKOVÁ PREZENTACE - SERVEROVÁ ČÁST (zadání 11. 10. 2026).
 *
 * Prezentace stojí VEDLE dokladové nabídky, nenahrazuje ji. Doklad má číslo,
 * položky a účetní platnost; tohle je to, co klient opravdu otevře.
 *
 * CENY SE NIKDY NEOPISUJÍ. Berou se z navázaného dokladu při každém otevření -
 * když se nabídka opraví, prezentace se opraví s ní a nemůže se stát, že
 * klient vidí jiné číslo, než na které mu přijde faktura.
 */

export type PrezentaceShrnuti = {
  id: string;
  token: string;
  nadpis: string | null;
  klientNazev: string;
  zverejneno: boolean;
  offerId: string | null;
  offerCislo: string | null;
  pocetOtevreni: number;
  posledniOtevreni: string | null;
  schvalenoAt: string | null;
  schvalilJmeno: string | null;
  odmitnutoAt: string | null;
  vybranyHerec: string | null;
  pocetReferenci: number;
  pocetHercu: number;
};

const VYBER_SHRNUTI = {
  id: true,
  token: true,
  nadpis: true,
  klientNazev: true,
  zverejneno: true,
  offerId: true,
  pocetOtevreni: true,
  posledniOtevreni: true,
  schvalenoAt: true,
  schvalilJmeno: true,
  odmitnutoAt: true,
  offer: { select: { number: true } },
  vybranyHerec: { select: { nazev: true } },
  ukazky: { select: { sekce: true } },
} as const;

function naShrnuti(r: {
  id: string;
  token: string;
  nadpis: string | null;
  klientNazev: string;
  zverejneno: boolean;
  offerId: string | null;
  pocetOtevreni: number;
  posledniOtevreni: Date | null;
  schvalenoAt: Date | null;
  schvalilJmeno: string | null;
  odmitnutoAt: Date | null;
  offer: { number: string } | null;
  vybranyHerec: { nazev: string } | null;
  ukazky: { sekce: string }[];
}): PrezentaceShrnuti {
  return {
    id: r.id,
    token: r.token,
    nadpis: r.nadpis,
    klientNazev: r.klientNazev,
    zverejneno: r.zverejneno,
    offerId: r.offerId,
    offerCislo: r.offer?.number ?? null,
    pocetOtevreni: r.pocetOtevreni,
    posledniOtevreni: r.posledniOtevreni?.toISOString() ?? null,
    schvalenoAt: r.schvalenoAt?.toISOString() ?? null,
    schvalilJmeno: r.schvalilJmeno,
    odmitnutoAt: r.odmitnutoAt?.toISOString() ?? null,
    vybranyHerec: r.vybranyHerec?.nazev ?? null,
    pocetReferenci: r.ukazky.filter((u) => u.sekce === SEKCE.reference).length,
    pocetHercu: r.ukazky.filter((u) => u.sekce === SEKCE.herec).length,
  };
}

export async function nactiPrezentaceProjektu(caflouProjectId: string): Promise<PrezentaceShrnuti[]> {
  const radky = await prisma.prezentaceNabidky
    .findMany({
      where: { caflouProjectId },
      orderBy: { createdAt: 'desc' },
      select: VYBER_SHRNUTI,
    })
    .catch(() => []);
  return radky.map(naShrnuti);
}

/** Jedna prezentace i s texty a zaškrtnutými ukázkami - pro sestavování. */
export async function nactiProUpravy(id: string) {
  const r = await prisma.prezentaceNabidky
    .findUnique({
      where: { id },
      select: {
        ...VYBER_SHRNUTI,
        caflouProjectId: true,
        podtitul: true,
        navrhReseni: true,
        podminky: true,
        lzeSchvalit: true,
        ukazky: {
          orderBy: { poradi: 'asc' },
          select: { sekce: true, poradi: true, ukazkaId: true },
        },
      },
    })
    .catch(() => null);
  if (!r) return null;

  return {
    ...naShrnuti({ ...r, ukazky: r.ukazky }),
    caflouProjectId: r.caflouProjectId,
    podtitul: r.podtitul,
    navrhReseni: r.navrhReseni,
    podminky: r.podminky,
    lzeSchvalit: r.lzeSchvalit,
    vybrane: {
      [SEKCE.reference]: r.ukazky.filter((u) => u.sekce === SEKCE.reference).map((u) => u.ukazkaId),
      [SEKCE.herec]: r.ukazky.filter((u) => u.sekce === SEKCE.herec).map((u) => u.ukazkaId),
    },
  };
}

/**
 * Nová prezentace. Texty se předvyplní ze vzoru - podmínky spolupráce jsou
 * u všech nabídek skoro stejné a psát je pokaždé znovu znamená, že se časem
 * rozejdou. Doklad se napojí sám, když má projekt právě jednu nabídku.
 */
export async function zalozPrezentaci(
  caflouProjectId: string,
  vytvorilId: string,
): Promise<string | null> {
  const meta = await prisma.projectMeta
    .findUnique({
      where: { caflouProjectId },
      select: { name: true, companyName: true, company: { select: { name: true } } },
    })
    .catch(() => null);

  const vzor = await prisma.vzorPrezentace
    .findFirst({
      where: { active: true },
      orderBy: [{ vychozi: 'desc' }, { poradi: 'asc' }],
      select: { navrhReseni: true, podminky: true },
    })
    .catch(() => null);

  const nabidky = await prisma.offer
    .findMany({ where: { caflouProjectId }, orderBy: { issueDate: 'desc' }, select: { id: true } })
    .catch(() => []);

  const zalozeno = await prisma.prezentaceNabidky
    .create({
      data: {
        caflouProjectId,
        projectName: meta?.name || `Projekt ${caflouProjectId}`,
        klientNazev: meta?.company?.name || meta?.companyName || '',
        token: randomBytes(24).toString('base64url'),
        navrhReseni: vzor?.navrhReseni ?? null,
        podminky: vzor?.podminky ?? null,
        // Jedna nabídka = žádné rozhodování. Víc jich je = ať si vybere člověk.
        offerId: nabidky.length === 1 ? nabidky[0].id : null,
        vytvorilId,
      },
      select: { id: true },
    })
    .catch((err) => {
      console.error('Prezentaci se nepodařilo založit:', err);
      return null;
    });

  return zalozeno?.id ?? null;
}

export async function upravPrezentaci(
  id: string,
  zmeny: {
    nadpis?: string | null;
    podtitul?: string | null;
    klientNazev?: string;
    navrhReseni?: string | null;
    podminky?: string | null;
    offerId?: string | null;
    zverejneno?: boolean;
    lzeSchvalit?: boolean;
  },
): Promise<boolean> {
  const ok = await prisma.prezentaceNabidky
    .update({ where: { id }, data: zmeny, select: { id: true } })
    .catch((err) => {
      console.error(`Prezentaci ${id} se nepodařilo upravit:`, err);
      return null;
    });
  return Boolean(ok);
}

/**
 * Zaškrtnuté ukázky jedné sekce. Přepisuje se celý seznam, ne po jedné -
 * pořadí je součástí výběru a skládat ho z dílčích změn by znamenalo hádat,
 * co se kam posunulo.
 */
export async function nastavUkazky(id: string, sekce: Sekce, ids: string[]): Promise<boolean> {
  try {
    await prisma.$transaction([
      prisma.prezentaceUkazka.deleteMany({ where: { prezentaceId: id, sekce } }),
      prisma.prezentaceUkazka.createMany({
        data: ids.map((ukazkaId, i) => ({ prezentaceId: id, ukazkaId, sekce, poradi: i })),
        skipDuplicates: true,
      }),
    ]);
    return true;
  } catch (err) {
    console.error(`Ukázky prezentace ${id} se nepodařilo uložit:`, err);
    return false;
  }
}

export type PrezentaceProKlienta = {
  id: string;
  nadpis: string;
  podtitul: string | null;
  projectName: string;
  klientNazev: string;
  navrhReseni: string | null;
  podminky: string | null;
  lzeSchvalit: boolean;
  schvalenoAt: string | null;
  schvalilJmeno: string | null;
  odmitnutoAt: string | null;
  vybranyHerecId: string | null;
  reference: UkazkaData[];
  herci: UkazkaData[];
  nabidka: {
    cislo: string;
    mena: string;
    platiDo: string | null;
    predmet: string | null;
    polozky: {
      popis: string;
      mnozstvi: number;
      jednotka: string | null;
      cenaZaJednotku: number;
      dph: number;
    }[];
    slevaProcent: number;
    slevaMinor: number;
    slevaPopis: string | null;
  } | null;
  manazer: { jmeno: string | null; email: string | null; telefon: string | null } | null;
};

/**
 * Data pro veřejnou stránku. Hledá se VÝHRADNĚ podle tokenu a nezveřejněná
 * prezentace se tváří, že není - ať se klientovi neotevře rozdělaná, kdyby
 * odkaz někdo poslal dřív.
 */
export async function nactiProKlienta(token: string): Promise<PrezentaceProKlienta | null> {
  const r = await prisma.prezentaceNabidky
    .findUnique({
      where: { token },
      select: {
        id: true,
        nadpis: true,
        podtitul: true,
        projectName: true,
        klientNazev: true,
        navrhReseni: true,
        podminky: true,
        lzeSchvalit: true,
        zverejneno: true,
        schvalenoAt: true,
        schvalilJmeno: true,
        odmitnutoAt: true,
        vybranyHerecId: true,
        caflouProjectId: true,
        ukazky: {
          orderBy: { poradi: 'asc' },
          select: {
            sekce: true,
            ukazka: {
              select: {
                id: true,
                druh: true,
                nazev: true,
                popis: true,
                typSouboru: true,
                delka: true,
                stitky: true,
                aktivni: true,
              },
            },
          },
        },
        offer: {
          select: {
            number: true,
            currency: true,
            validUntil: true,
            subject: true,
            slevaProcent: true,
            slevaMinor: true,
            slevaPopis: true,
            items: {
              orderBy: { sortOrder: 'asc' },
              select: {
                description: true,
                quantity: true,
                unit: true,
                unitPriceMinor: true,
                vatRate: true,
              },
            },
          },
        },
      },
    })
    .catch(() => null);

  if (!r || !r.zverejneno) return null;

  /**
   * KDO JE POD NABÍDKOU. První věc, kterou klient hledá, když chce něco
   * doladit - stejně jako na stránce dokladové nabídky.
   */
  const meta = await prisma.projectMeta
    .findUnique({
      where: { caflouProjectId: r.caflouProjectId },
      select: { manager: { select: { name: true, email: true, phone: true } } },
    })
    .catch(() => null);

  const zive = r.ukazky.filter((u) => u.ukazka.aktivni);

  return {
    id: r.id,
    nadpis: r.nadpis?.trim() || r.projectName,
    podtitul: r.podtitul,
    projectName: r.projectName,
    klientNazev: r.klientNazev,
    navrhReseni: r.navrhReseni,
    podminky: r.podminky,
    lzeSchvalit: r.lzeSchvalit,
    schvalenoAt: r.schvalenoAt?.toISOString() ?? null,
    schvalilJmeno: r.schvalilJmeno,
    odmitnutoAt: r.odmitnutoAt?.toISOString() ?? null,
    vybranyHerecId: r.vybranyHerecId,
    reference: zive.filter((u) => u.sekce === SEKCE.reference).map((u) => naData(u.ukazka)),
    herci: zive.filter((u) => u.sekce === SEKCE.herec).map((u) => naData(u.ukazka)),
    nabidka: r.offer
      ? {
          cislo: r.offer.number,
          mena: String(r.offer.currency),
          platiDo: r.offer.validUntil?.toISOString() ?? null,
          predmet: r.offer.subject,
          polozky: r.offer.items.map((i) => ({
            popis: i.description,
            mnozstvi: i.quantity,
            jednotka: i.unit,
            cenaZaJednotku: i.unitPriceMinor,
            dph: i.vatRate,
          })),
          slevaProcent: r.offer.slevaProcent,
          slevaMinor: r.offer.slevaMinor,
          slevaPopis: r.offer.slevaPopis,
        }
      : null,
    manazer: meta?.manager
      ? { jmeno: meta.manager.name, email: meta.manager.email, telefon: meta.manager.phone }
      : null,
  };
}

/**
 * ZA JAK DLOUHO SE OZVEME ZNOVU. Klient si stranku běžně načte dvakrát za
 * sebou - pošle odkaz kolegovi, vrátí se k ceniku, obnoví záložku. Kdyby
 * každé načtení zvonilo, zvoneček by se zahltil a přestal se číst. Dvanáct
 * hodin od posledního otevření je už nová návštěva, ne obnovení stránky.
 */
const ZNOVU_PO_MS = 12 * 60 * 60 * 1000;

/**
 * ŽE SE NA TO KLIENT PODÍVAL. Bez toho se produkce musí ptát mailem „došlo
 * to?"; takhle je v portálu vidět, kdy a kolikrát se prezentace otevřela.
 * Běží mimochodem při vykreslení a nesmí stránku zdržet ani shodit.
 *
 * ZVONEČEK, KDYŽ KLIENT NABÍDKU OTEVŘE (zadání 11. 10. 2026: „chtěl bych mít
 * možnost, aby mi přišla notifikace do portálu, když tu nabídku pak klient
 * otevře"). Je to prodejní informace, ne úkol: ozve se při PRVNÍM otevření
 * („dorazilo to") a pak už jen tehdy, když se klient vrátí po delší pauze
 * („ještě se v tom hrabe"). Obnovení stránky nezvoní.
 */
export async function zapisOtevreni(id: string): Promise<void> {
  const ted = new Date();

  // Stav PŘED zápisem - podle něj se pozná, jestli je tohle první otevření
  // nebo návrat. Po updatu už by to nikdo nerozlišil.
  const pred = await prisma.prezentaceNabidky
    .findUnique({
      where: { id },
      select: {
        id: true,
        nadpis: true,
        projectName: true,
        klientNazev: true,
        caflouProjectId: true,
        vytvorilId: true,
        prvniOtevreni: true,
        posledniOtevreni: true,
      },
    })
    .catch(() => null);

  await prisma.prezentaceNabidky
    .update({
      where: { id },
      data: { pocetOtevreni: { increment: 1 }, posledniOtevreni: ted },
      select: { id: true },
    })
    .catch(() => null);

  // První otevření se zapíše jen tehdy, když ještě žádné nebylo.
  await prisma.prezentaceNabidky
    .updateMany({ where: { id, prvniOtevreni: null }, data: { prvniOtevreni: ted } })
    .catch(() => null);

  if (!pred) return;
  const poprve = !pred.prvniOtevreni;
  const navrat =
    !poprve &&
    (!pred.posledniOtevreni || ted.getTime() - pred.posledniOtevreni.getTime() > ZNOVU_PO_MS);
  if (!poprve && !navrat) return;

  await zvonekOOtevreni(pred, poprve);
}

/**
 * ZVONEČEK MANAŽEROVI PROJEKTU. Stejný adresát jako u odpovědi na prezentaci
 * (api/prezentace/[token]/odpoved) - manažer projektu, a když žádný není, ten,
 * kdo prezentaci založil. Nikdy nevyhazuje: statistika otevření se nesmí
 * rozbít kvůli zvonečku.
 */
async function zvonekOOtevreni(
  prez: {
    nadpis: string | null;
    projectName: string;
    klientNazev: string;
    caflouProjectId: string;
    vytvorilId: string | null;
  },
  poprve: boolean,
): Promise<void> {
  try {
    const meta = await prisma.projectMeta
      .findUnique({
        where: { caflouProjectId: prez.caflouProjectId },
        select: { managerUserId: true },
      })
      .catch(() => null);
    const prijemce = meta?.managerUserId || prez.vytvorilId;
    if (!prijemce) return;

    const nazev = prez.nadpis?.trim() || prez.projectName;
    await notify({
      userId: prijemce,
      kind: 'prezentace-otevreno',
      title: poprve
        ? `Klient otevřel nabídku: ${nazev}`
        : `Klient se k nabídce vrátil: ${nazev}`,
      body: prez.klientNazev?.trim() || null,
      url: `/projekty/${prez.caflouProjectId}?zalozka=prezentace`,
    });
  } catch (err) {
    console.error('Zvoneček o otevření prezentace selhal:', err);
  }
}
