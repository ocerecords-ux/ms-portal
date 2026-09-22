import type { Currency } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * NABÍDKA Z OBJEDNÁVKY NA WEBU (zadání 18. 9. 2026: „potřebuju, aby se
 * automaticky z objednávek na webu vytvořila nabídka. Zatím jen u audioknih…
 * ale aby tam zůstala někde nabídnutá a předvyplněná. Nějakým tlačítkem ji
 * přidá. Třeba: Přidat nabídku").
 *
 * NIC SE NEZAKLÁDÁ SAMO. Objednávka je přání klienta, ne odsouhlasená cena -
 * kdyby portál nabídku vystavil sám, měla by rovnou číslo z číselné řady
 * a v Dokladech by přibývaly doklady, které nikdo neviděl. Proto se tu jen
 * SPOČÍTÁ NÁVRH a v kartě projektu se ukáže s tlačítkem; nabídka vznikne až
 * klepnutím, a to už obyčejnou cestou (POST /api/admin/offers), takže dostane
 * číslo ve chvíli, kdy ji někdo doopravdy chce.
 *
 * JEN U AUDIOKNIH (zadání tentýž den). U reklamy se z objednávky nepočítají
 * ani normostrany, ani cena - nebylo by z čeho nabídku složit.
 *
 * NÁVRH ZMIZÍ, JAKMILE U PROJEKTU NĚJAKÁ NABÍDKA JE. Ať ji někdo udělal
 * tlačítkem, nebo ručně - druhá nabídka na tutéž zakázku by byla chyba, a
 * kdyby panel zůstal viset, dřív nebo později by na něj někdo klikl podruhé.
 */

/** Předmět nabídky - zadání 18. 9. 2026, doslova. */
export const PREDMET_AUDIOKNIHA = 'Natáčení a postprodukce audioknihy';

export type NavrhNabidky = {
  /** Objednávka, ze které návrh vznikl - pro popisek „z webu z 12. 9.". */
  objednanoAt: string;
  predmet: string;
  issuerCompanyId: string;
  issuerName: string;
  companyId: string;
  companyName: string;
  currency: Currency;
  /** Celá předběžná cena z objednávky, v haléřích. */
  castkaMinor: number;
  /** Normostrany z objednávky - do popisu, ať je vidět, z čeho cena je. */
  pageCount: number | null;
};

/**
 * Objednávka z webu, ze které tenhle projekt vznikl - nebo null, když byl
 * projekt založený ručně.
 *
 * Schválně se to pozná podle objednávky, a ne podle příznaku na projektu:
 * `ProjectMeta.zdroj` je „PORTAL" i u projektu, který v portálu založila
 * produkce, takže by se obojí slilo. Takhle to sedí i zpětně, u zakázek
 * založených dřív, než tohle vzniklo.
 */
export async function objednavkaProjektu(caflouProjectId: string) {
  try {
    return await prisma.order.findFirst({
      where: { caflouProjectId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        kind: true,
        createdAt: true,
        pageCount: true,
        priceEstimate: true,
        companyId: true,
        company: { select: { name: true } },
        attachmentName: true,
        attachmentUrl: true,
        diskPrilohaId: true,
        diskPrilohaChyba: true,
      },
    });
  } catch (err) {
    console.error('Cteni objednavky k projektu selhalo:', err);
    return null;
  }
}

/** Které projekty ze zadaných přišly z webu - pro seznamy, jedním dotazem. */
export async function projektyZObjednavek(caflouProjectIds: string[]): Promise<Set<string>> {
  if (caflouProjectIds.length === 0) return new Set();
  try {
    const radky = await prisma.order.findMany({
      where: { caflouProjectId: { in: caflouProjectIds } },
      select: { caflouProjectId: true },
    });
    return new Set(radky.map((r) => r.caflouProjectId).filter((id): id is string => Boolean(id)));
  } catch (err) {
    console.error('Cteni objednavek k projektum selhalo:', err);
    return new Set();
  }
}

export async function navrhNabidkyZObjednavky(
  caflouProjectId: string,
): Promise<NavrhNabidky | null> {
  const objednavka = await objednavkaProjektu(caflouProjectId);
  if (!objednavka || objednavka.kind !== 'AUDIOBOOK') return null;
  // Bez ceny není co nabídnout - klient by dostal nulu.
  if (!objednavka.priceEstimate || objednavka.priceEstimate <= 0) return null;

  try {
    const [nabidek, vydavatel] = await Promise.all([
      prisma.offer.count({ where: { caflouProjectId } }),
      prisma.issuerCompany.findFirst({
        where: { active: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, name: true, defaultCurrency: true },
      }),
    ]);
    if (nabidek > 0 || !vydavatel) return null;

    return {
      objednanoAt: objednavka.createdAt.toISOString(),
      predmet: PREDMET_AUDIOKNIHA,
      issuerCompanyId: vydavatel.id,
      issuerName: vydavatel.name,
      companyId: objednavka.companyId,
      companyName: objednavka.company?.name ?? '',
      currency: vydavatel.defaultCurrency,
      // Predbezna cena je v celych korunach, doklady pocitaji v halerich.
      castkaMinor: Math.round(objednavka.priceEstimate * 100),
      pageCount: objednavka.pageCount,
    };
  } catch (err) {
    console.error('Priprava nabidky z objednavky selhala:', err);
    return null;
  }
}
