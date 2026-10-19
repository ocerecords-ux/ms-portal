import { prisma } from '@/lib/db';
import { expandNumberFormat } from '@/lib/doklady';
import { getRateForCurrency } from '@/lib/cnb';
import { resolveProject } from '@/lib/projectOptions';
import { castPodlePoradi } from '@/lib/fakturaCast';
import { jeReklamaProjekt } from '@/lib/reklamniProjektServer';
import { odesliFakturu } from '@/lib/fakturaOdeslaniServer';
import { notifyMany } from '@/lib/notifications';
import { brunoNapisSoukrome } from '@/lib/brunoOznameni';
import { zapisNotifikaci } from '@/lib/projektLogServer';
import { INTERNAL_ROLES } from '@/lib/roles';
import { zapisZmenyProjektu } from '@/lib/projektLogServer';
import { STAVY_PROJEKTU } from '@/lib/stavyProjektu';
import { uzavriDotazyProjektu } from '@/lib/dotazyServer';
import { uzavriKanalProjektu } from '@/lib/chatServer';

/**
 * FAKTURA U REKLAM SE VYSTAVÍ A ODEŠLE SAMA (zadání 19. 10. 2026: „potrebuju
 * nastavit u reklam, aby se automaticky po preklopeni stavu na schvaleno -
 * k fakturaci, vystavila z nabidky faktura a odeslala se na klienta. Jen
 * u reklam zatim").
 *
 * U reklamy je zakázka krátká a celá se vejde do jedné nabídky: klient
 * odsouhlasí cenu, spot se nahraje, stav se přehodí na „Schváleno -
 * k fakturaci" a pak už jen někdo ručně překlikal nabídku na fakturu a
 * poslal ji. Tenhle poslední krok dělá od teď portál sám.
 *
 * SPOUŠTÍ SE ZE TŘÍ MÍST (doplněno 19. 10. 2026 po prvním ostrém pokusu):
 *  1. přehození stavu ve formuláři projektu (/api/projects/[id]/meta),
 *  2. tlačítko „Spot schvaluji" u klienta (lib/schvaleniKlientem.ts) - tudy
 *     stav u reklam přeskočí nejčastěji a přes formulář vůbec nejde,
 *  3. tlačítko u dokladů projektu (/api/projekty/[id]/automaticka-faktura),
 *     protože projekt, který už ve stavu stojí, se sám nespustí znovu -
 *     automat jede na PŘECHODU do stavu, ne na tom, že v něm projekt je.
 *
 * JEN U REKLAM. Audiokniha se fakturuje po částech, s doplatky a smlouvami,
 * a tam o faktuře rozhoduje člověk - automat by tam způsobil víc škody než
 * práce. Rozhoduje `jeReklamaProjekt` (typ z ceníku, ne zaškrtávátko
 * u firmy) - stejná podmínka jako u rodného listu.
 *
 * KDYŽ SI NEJSME JISTÍ, NEFAKTURUJEME. Faktura je ostrý doklad, který odejde
 * klientovi a posune číselnou řadu - vymyslet si ji „podle nejlepšího
 * odhadu" by bylo horší než ji nevystavit. Automat proto odstoupí a dá
 * o sobě vědět (zvonek + Bruno těm, kdo mají na kartě účtu zaškrtnutou
 * fakturaci projektů) v každém z těchhle případů:
 *
 *  - projekt nemá v portálu žádnou nabídku (reklamní nabídky často chodí
 *    mailem mimo portál),
 *  - visí u něj víc nabídek a není z čeho vybrat,
 *  - nabídka je bez položek,
 *  - u projektu už nějaká faktura je (pak se nic nedubluje a ani se neozývá
 *    - dvakrát fakturovat jednu reklamu je chyba, ne zpráva),
 *  - faktura se vystavila, ale nešla odeslat (chybí e-mail, účet, rodný
 *    list, nejede SMTP). Faktura v tu chvíli zůstane v portálu jako
 *    rozepsaná a dá se poslat ručně - to je rozdíl proti „nevystavila se",
 *    a hláška to říká.
 *
 * NABÍDKA SE NESAHÁ. Bere se z ní odběratel, měna, předmět, položky, sleva
 * i jazyk - a nic se v ní nemění („žádné nabídky neměň!!").
 *
 * POSÍLÁ TO ČLOVĚK, KTERÝ PŘEHODIL STAV. V záznamu o odeslání je jeho jméno,
 * ne „systém" - protože to byl jeho klik, který fakturu poslal. U schválení
 * klientem je to ten, komu faktura připadá: nikdo z nás u toho nebyl.
 *
 * NIKDY NEVYHAZUJE. Přehození stavu je to hlavní, co člověk dělá, a nesmí ho
 * shodit ani zdržet to, že se zrovna nepovedlo vystavit fakturu.
 */

/** Vypínač celé automatiky - kdyby se ukázalo, že fakturuje, co nemá. */
const AUTOMATICKA_FAKTURA_REKLAM = true;

export type VysledekAutomatickeFaktury = {
  /** Vystavila se a odešla? */
  ok: boolean;
  /** Věta pro člověka - do historie projektu, do zvonku i na tlačítko. */
  zprava: string;
  /** Číslo vystavené faktury, když nějaká vznikla. */
  cislo?: string;
};

/** Zvonek, Bruno a záznam do historie projektu. Nikdy nevyhazuje. */
async function ozviSe(vstup: {
  caflouProjectId: string;
  projekt: string;
  zprava: string;
  /** Spuštěno ručně tlačítkem - člověk odpověď vidí rovnou, zvonek je navíc. */
  rucne: boolean;
}): Promise<void> {
  try {
    await zapisNotifikaci({
      caflouProjectId: vstup.caflouProjectId,
      stav: 'Schváleno - k fakturaci',
      popis: vstup.zprava,
    }).catch(() => undefined);

    if (vstup.rucne) return;

    const prijemci = (await prisma.user
      .findMany({
        where: { active: true, fakturaceProjektu: true, role: { in: INTERNAL_ROLES as never } },
        select: { id: true },
      })
      .catch(() => [])) as unknown as { id: string }[];
    if (prijemci.length === 0) return;

    const zaklad = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const odkaz = `${zaklad}/projekty/${encodeURIComponent(vstup.caflouProjectId)}`;

    await notifyMany(
      prijemci.map((u) => u.id),
      {
        kind: 'automaticka-faktura',
        title: `${vstup.projekt}: automatická faktura`,
        body: vstup.zprava,
        url: `/projekty/${encodeURIComponent(vstup.caflouProjectId)}`,
      },
    ).catch(() => ({}));

    for (const u of prijemci) {
      await brunoNapisSoukrome(u.id, `${vstup.zprava} ${odkaz}`).catch(() => false);
    }
  } catch (err) {
    console.error('Zprávu o automatické faktuře se nepodařilo poslat:', err);
  }
}

/** Konec cesty projektu - posledni stav v seznamu, ne napsany retezec. */
const STAV_PO_FAKTURE = STAVY_PROJEKTU[STAVY_PROJEKTU.length - 1].nazev;

/**
 * ODESLANÁ FAKTURA ZAVŘE ZAKÁZKU (zadání 19. 10. 2026: „po té automatické
 * fakturaci a odeslání by se měl přehodit projekt Vyfakturováno a přesunout
 * do dokončených").
 *
 * U ručního odeslání faktury se portál ptá („Ukončit projekt?", pojistka
 * z 25. 9. 2026) - tam u toho člověk stojí a odklepne to. U automatu se nemá
 * kdo ptát: faktura je u klienta, zakázka skončila, a otázka, na kterou se
 * za hodinu nikdo nepodívá, by projekt nechala viset mezi aktivními.
 *
 * Dělá přesně totéž co ruční ukončení (/api/projekty/[id]/ukonceni): stav
 * „Vyfakturováno", příznak hotovo, a zavřené kanály - kanál projektu i kanál
 * dotazů klienta, ať v chatu nezůstávají hotové zakázky.
 *
 * ZAVÍRÁ SE JEN PO ÚSPĚŠNĚ ODESLANÉ FAKTUŘE. Vystavená, ale neodeslaná
 * faktura zakázku nezavírá - pořád se čeká, až odejde.
 *
 * NIKDY NEVYHAZUJE. Faktura už je u klienta; kdyby se nepovedlo přehodit
 * stav, je to řádek v logu, ne důvod hlásit, že fakturace selhala.
 */
async function zavriPoFakture(
  caflouProjectId: string,
  kdo: { id: string | null; jmeno: string | null },
): Promise<void> {
  try {
    const pred = (await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: { statusName: true, finished: true },
    })) as { statusName: string | null; finished: boolean } | null;
    if (!pred) return;
    if (pred.finished && pred.statusName === STAV_PO_FAKTURE) return;

    await prisma.projectMeta.update({
      where: { caflouProjectId },
      data: { statusName: STAV_PO_FAKTURE, finished: true },
    });

    await zapisZmenyProjektu({
      caflouProjectId,
      pred: { statusName: pred.statusName, finished: pred.finished },
      ulozeno: { statusName: STAV_PO_FAKTURE, finished: true },
      puvodce: { id: kdo.id, jmeno: kdo.jmeno },
    }).catch(() => undefined);

    await uzavriDotazyProjektu(caflouProjectId).catch(() => undefined);
    await uzavriKanalProjektu(caflouProjectId).catch(() => undefined);
  } catch (err) {
    console.error(`Projekt ${caflouProjectId} se po automatické faktuře nepodařilo zavřít:`, err);
  }
}

export async function automatickaFakturaReklamy(vstup: {
  caflouProjectId: string;
  nazevProjektu: string | null;
  nazevFirmy: string | null;
  kdo: { id: string | null; jmeno: string | null };
  /**
   * Spuštěno ručně tlačítkem u dokladů. Mění dvě věci: nezvoní (člověk
   * odpověď vidí rovnou na tlačítku) a odpovídá i tam, kde automat mlčí -
   * „tohle není reklama", „faktura už tu je". Kdo se ptá, má dostat odpověď.
   */
  rucne?: boolean;
}): Promise<VysledekAutomatickeFaktury> {
  const rucne = vstup.rucne === true;
  const projekt = vstup.nazevProjektu || `Projekt ${vstup.caflouProjectId}`;

  if (!AUTOMATICKA_FAKTURA_REKLAM) {
    return { ok: false, zprava: 'Automatické fakturování je vypnuté.' };
  }

  try {
    // 1) Jen reklama. Audioknihy si fakturu vystavují ručně.
    if (!(await jeReklamaProjekt(vstup.caflouProjectId))) {
      return {
        ok: false,
        zprava:
          'Automatická faktura je zatím jen u reklam — tenhle projekt je vedený jako audiokniha.',
      };
    }

    // 2) Už vyfakturováno? Pak se nedubluje a ani se neozýváme.
    const uzJe = await prisma.invoice.count({
      where: { caflouProjectId: vstup.caflouProjectId, status: { not: 'CANCELLED' } },
    });
    if (uzJe > 0) {
      return { ok: false, zprava: 'U projektu už faktura je — druhá se nevystavuje.' };
    }

    // 3) Nabídka musí být právě jedna a s položkami.
    const nabidky = await prisma.offer.findMany({
      where: { caflouProjectId: vstup.caflouProjectId, status: { not: 'REJECTED' } },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    if (nabidky.length === 0) {
      const zprava = `${projekt}: faktura se nevystavila automaticky — projekt nemá v portálu nabídku. Vystavte ji prosím ručně.`;
      await ozviSe({ caflouProjectId: vstup.caflouProjectId, projekt, zprava, rucne });
      return { ok: false, zprava };
    }
    if (nabidky.length > 1) {
      const zprava = `${projekt}: faktura se nevystavila automaticky — u projektu visí ${nabidky.length} nabídky a není z čeho vybrat. Vystavte ji prosím ručně.`;
      await ozviSe({ caflouProjectId: vstup.caflouProjectId, projekt, zprava, rucne });
      return { ok: false, zprava };
    }

    const offer = nabidky[0];
    if (offer.items.length === 0) {
      const zprava = `${projekt}: faktura se nevystavila automaticky — nabídka nemá žádné položky.`;
      await ozviSe({ caflouProjectId: vstup.caflouProjectId, projekt, zprava, rucne });
      return { ok: false, zprava };
    }

    /**
     * 4) VYSTAVENÍ. Míněně stejné jako POST /api/admin/invoices při převodu
     * nabídky na fakturu, jen bez ručních úprav z formuláře: všechno se bere
     * z nabídky a z karet firem.
     */
    const issuer = await prisma.issuerCompany.findUnique({
      where: { id: offer.issuerCompanyId },
    });
    const company = await prisma.company.findUnique({ where: { id: offer.companyId } });
    if (!issuer || !company) {
      const zprava = `${projekt}: faktura se nevystavila automaticky — u nabídky chybí vystavovatel nebo odběratel.`;
      await ozviSe({ caflouProjectId: vstup.caflouProjectId, projekt, zprava, rucne });
      return { ok: false, zprava };
    }

    const currency = offer.currency ?? issuer.defaultCurrency;

    // Denni kurz CNB. Kdyz se CNB nepodari zeptat, ulozi se 1 a kurz jde
    // doplnit rucne - kvuli tomu faktura padat nebude.
    const rate = await getRateForCurrency(currency);

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + (company.paymentTermDays ?? 14));

    // Vychozi ucet ve mene dokladu.
    const account = await prisma.bankAccount.findFirst({
      where: { issuerCompanyId: issuer.id, currency },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
      select: { id: true },
    });

    // Prvni, nebo druha cast - jen u firmy, ktera to tak ma (30. 9. 2026).
    const castZakazky = company.fakturujeNaCasti
      ? castPodlePoradi(
          await prisma.invoice.count({
            where: { offerId: offer.id, status: { not: 'CANCELLED' } },
          }),
        )
      : null;

    const cilovyProjekt = await resolveProject(offer.caflouProjectId ?? vstup.caflouProjectId);

    let created: { id: string; number: string } | null = null;
    let sequence = issuer.invoiceNextNumber;
    for (let attempt = 0; attempt < 20 && !created; attempt++) {
      const number = expandNumberFormat(issuer.invoiceNumberFormat, sequence);
      const exists = await prisma.invoice.findUnique({ where: { number }, select: { id: true } });
      if (exists) {
        sequence += 1;
        continue;
      }
      const seq = sequence;
      created = (await prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
          data: {
            number,
            // Variabilni symbol = cislo faktury bez necislic - podle nej se
            // paruji platby z banky.
            variableSymbol: number.replace(/\D/g, '') || String(seq),
            issuerCompanyId: issuer.id,
            companyId: company.id,
            bankAccountId: account?.id ?? null,
            currency,
            exchangeRate: rate?.rate ?? 1,
            exchangeRateDate: rate ? new Date() : null,
            issueDate,
            taxDate: issueDate,
            dueDate,
            subject: offer.subject ?? null,
            note: offer.note ?? null,
            offerId: offer.id,
            interniCast: castZakazky,
            caflouProjectId: cilovyProjekt.caflouProjectId,
            projectName: cilovyProjekt.projectName,
            rezimDph: 'STANDARD',
            jazyk: offer.jazyk ?? 'CS',
            // Sleva se prenese s nabidkou - klient ji v nabidce videl.
            slevaProcent: offer.slevaProcent ?? 0,
            slevaMinor: offer.slevaMinor ?? 0,
            slevaPopis: offer.slevaPopis || null,
            items: {
              create: offer.items.map((item, index) => ({
                description: item.description,
                quantity: item.quantity,
                unit: item.unit || 'ks',
                unitPriceMinor: item.unitPriceMinor,
                vatRate: item.vatRate,
                sortOrder: (index + 1) * 10,
              })),
            },
          },
          select: { id: true, number: true },
        });
        await tx.issuerCompany.update({
          where: { id: issuer.id },
          data: { invoiceNextNumber: seq + 1 },
        });
        return invoice;
      })) as { id: string; number: string };
    }

    if (!created) {
      const zprava = `${projekt}: faktura se nevystavila automaticky — nepodařilo se přidělit číslo faktury.`;
      await ozviSe({ caflouProjectId: vstup.caflouProjectId, projekt, zprava, rucne });
      return { ok: false, zprava };
    }

    // 5) ODESLÁNÍ. Stejnou cestou jako ruční tlačítko u dokladu - včetně PDF
    // s QR platbou a rodného listu spotu.
    const odeslano = await odesliFakturu({
      invoiceId: created.id,
      odeslal: vstup.kdo,
    });

    if (!odeslano.ok) {
      const zprava = `${projekt}: faktura ${created.number} se vystavila, ale neodešla — ${odeslano.error} Je v portálu rozepsaná, dá se poslat ručně.`;
      await ozviSe({ caflouProjectId: vstup.caflouProjectId, projekt, zprava, rucne });
      return { ok: false, zprava, cislo: created.number };
    }

    // Faktura je u klienta - zakazka timhle konci (19. 10. 2026).
    await zavriPoFakture(vstup.caflouProjectId, vstup.kdo);

    const komu = [odeslano.to, ...odeslano.kopie].join(', ');
    const zprava = `${projekt}: faktura ${created.number} se vystavila z nabídky a odešla klientovi (${komu}). Projekt je vyfakturovaný a mezi dokončenými.`;
    await ozviSe({ caflouProjectId: vstup.caflouProjectId, projekt, zprava, rucne });
    return { ok: true, zprava, cislo: created.number };
  } catch (err) {
    console.error(`Automatická faktura u projektu ${vstup.caflouProjectId} selhala:`, err);
    const zprava = `${projekt}: automatická faktura selhala — ${err instanceof Error ? err.message : 'neznámá chyba'}. Vystavte ji prosím ručně.`;
    await ozviSe({ caflouProjectId: vstup.caflouProjectId, projekt, zprava, rucne }).catch(
      () => undefined,
    );
    return { ok: false, zprava };
  }
}
