import { prisma } from '@/lib/db';
import { oznacPohyb, rozeberAbo, type AboPohyb } from '@/lib/abo';
import {
  napojeniProUcet,
  ulozAZparuj,
  type PohybKUlozeni,
  type VysledekSynchronizace,
} from '@/lib/bankaServer';
import type { Currency } from '@prisma/client';

/**
 * NAHRÁNÍ BANKOVNÍHO VÝPISU (29. 9. 2026).
 *
 * Náhrada za stahování přes API: GoCardless přestal brát nové zákazníky
 * a Enable Banking Česko nepokrývá. Výpis ve formátu ABO si z internetového
 * bankovnictví stáhne každý a nese totéž, co by přišlo po drátě.
 *
 * Pohyby se ukládají a párují úplně stejnou cestou jako ty stažené - viz
 * `ulozAZparuj` v lib/bankaServer.ts. Tenhle soubor jen přeloží výpis do
 * tvaru, kterému rozumí.
 */

/** Odkud pohyb přišel - kvůli popisku na kartě účtu. */
const ZDROJ = { institutionId: 'ABO_VYPIS', institutionName: 'Výpis z účtu' };

export type VysledekImportu = VysledekSynchronizace & {
  ucet: string;
  cisloVypisu: string | null;
  /** Kolik pohybů výpis nesl a portál je už znal z dřívějška. */
  uzZname: number;
};

/** Z pohybu ve výpisu udělá záznam, kterému rozumí párování. */
function naZaznam(ucet: string, p: AboPohyb): PohybKUlozeni {
  /**
   * MĚNA SE VE VÝPISU ABO NEUVÁDÍ - formát vznikl v době, kdy měl účet jednu
   * měnu a bylo to jasné z hlavičky. Bereme korunu; devizový účet by se sem
   * musel doplnit zvlášť a je lepší, aby to bylo napsané než odhadnuté.
   */
  const currency: Currency = 'CZK';

  // Do `reference` jde všechno, co nese text - párování si z toho ještě samo
  // zkusí vyčíst variabilní symbol, když ho banka nedala do svého pole.
  const kousky = [p.popis, p.variabilniSymbol ? `VS: ${p.variabilniSymbol}` : null].filter(Boolean);

  return {
    externalId: oznacPohyb(ucet, p),
    bookedAt: p.datum,
    amountMinor: p.castkaMinor,
    currency,
    variableSymbol: p.variabilniSymbol,
    counterpartyName: p.popis,
    counterpartyAccount: p.protiucet,
    reference: kousky.join(' · ') || null,
  };
}

/**
 * Přečte nahraný výpis a uloží z něj, co portál ještě nezná.
 *
 * Tentýž soubor se dá nahrát vícekrát - pohyb se pozná podle účtu, data,
 * čísla dokladu a částky, takže se nic nezdvojí. Vrací i `uzZname`, ať je
 * po nahrání vidět, že se nic neztratilo, jen už to tam bylo.
 */
export async function importujAboVypis(obsah: string): Promise<VysledekImportu> {
  const vypis = rozeberAbo(obsah);
  if (!vypis) {
    throw new Error(
      'Tohle nevypadá jako výpis ve formátu ABO. V internetovém bankovnictví vyberte u výpisu formát ABO (GPC).',
    );
  }

  const napojeni = await napojeniProUcet(vypis.ucet, vypis.nazevUctu, ZDROJ);
  const zaznamy = vypis.pohyby.map((p) => naZaznam(vypis.ucet, p));

  const znameIds = new Set(
    (
      await prisma.bankTransaction.findMany({
        where: { connectionId: napojeni.id, externalId: { in: zaznamy.map((z) => z.externalId) } },
        select: { externalId: true },
      })
    ).map((t) => t.externalId),
  );

  const vysledek = await ulozAZparuj(napojeni.id, napojeni.issuerCompanyId, zaznamy);

  await prisma.bankConnection.update({
    where: { id: napojeni.id },
    data: { lastSyncAt: new Date(), lastSyncError: null },
  });

  return {
    ...vysledek,
    stazeno: zaznamy.length,
    uzZname: znameIds.size,
    ucet: vypis.ucet,
    cisloVypisu: vypis.cisloVypisu,
  };
}
