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
 * JEN U REKLAM. Audiokniha se fakturuje po částech, s doplatky a smlouvami,
 * a tam o faktuře rozhoduje člověk - automat by tam způsobil víc škody než
 * práce. Rozhoduje `jeReklamaProjekt` (typ z ceníku, ne zaškrtávátko
 * u firmy) - stejná podmínka jako u rodného listu.
 *
 * KDYŽ SI NEJSME JISTÍ, NEFAKTURUJEME. Faktura je ostrý doklad, který odejde
 * klientovi a posune číselnou řadu - vymyslet si ji „podle nejlepšího
 * odhadu" by bylo horší než ji nevystavit. Automat proto mlčky odstoupí
 * a dá o sobě vědět (zvonek + Bruno těm, kdo mají na kartě účtu zaškrtnutou
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
 * ne „systém" - protože to byl jeho klik, který fakturu poslal.
 *
 * NIKDY NEVYHAZUJE. Přehození stavu je to hlavní, co člověk dělá, a nesmí ho
 * shodit ani zdržet to, že se zrovna nepovedlo vystavit fakturu.
 */

/** Vypínač celé automatiky - kdyby se ukázalo, že fakturuje, co nemá. */
const AUTOMATICKA_FAKTURA_REKLAM = true;

/** Zvonek, Bruno a záznam do historie projektu. Nikdy nevyhazuje. */
async function ozviSe(vstup: {
  caflouProjectId: string;
  projekt: string;
  zprava: string;
}): Promise<void> {
  try {
    await zapisNotifikaci({
      caflouProjectId: vstup.caflouProjectId,
      stav: 'Schváleno - k fakturaci',
      popis: vstup.zprava,
    }).catch(() => undefined);

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

export async function automatickaFakturaReklamy(vstup: {
  caflouProjectId: string;
  nazevProjektu: string | null;
  nazevFirmy: string | null;
  kdo: { id: string; jmeno: string | null };
}): Promise<void> {
  if (!AUTOMATICKA_FAKTURA_REKLAM) return;

  const projekt = vstup.nazevProjektu || `Projekt ${vstup.caflouProjectId}`;

  try {
    // 1) Jen reklama. Audioknihy si fakturu vystavují ručně.
    if (!(await jeReklamaProjekt(vstup.caflouProjectId))) return;

    // 2) Už vyfakturováno? Pak se nedubluje a ani se neozýváme.
    const uzJe = await prisma.invoice.count({
      where: { caflouProjectId: vstup.caflouProjectId, status: { not: 'CANCELLED' } },
    });
    if (uzJe > 0) return;

    // 3) Nabídka musí být právě jedna a s položkami.
    const nabidky = await prisma.offer.findMany({
      where: { caflouProjectId: vstup.caflouProjectId, status: { not: 'REJECTED' } },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    if (nabidky.length === 0) {
      await ozviSe({
        caflouProjectId: vstup.caflouProjectId,
        projekt,
        zprava: `${projekt}: faktura se nevystavila automaticky — projekt nemá v portálu nabídku. Vystavte ji prosím ručně.`,
      });
      return;
    }
    if (nabidky.length > 1) {
      await ozviSe({
        caflouProjectId: vstup.caflouProjectId,
        projekt,
        zprava: `${projekt}: faktura se nevystavila automaticky — u projektu visí ${nabidky.length} nabídky a není z čeho vybrat. Vystavte ji prosím ručně.`,
      });
      return;
    }

    const offer = nabidky[0];
    if (offer.items.length === 0) {
      await ozviSe({
        caflouProjectId: vstup.caflouProjectId,
        projekt,
        zprava: `${projekt}: faktura se nevystavila automaticky — nabídka nemá žádné položky.`,
      });
      return;
    }

    /**
     * 4) VYSTAVENÍ. Mířeně stejné jako POST /api/admin/invoices při převodu
     * nabídky na fakturu, jen bez ručních úprav z formuláře: všechno se bere
     * z nabídky a z karet firem.
     */
    const issuer = await prisma.issuerCompany.findUnique({
      where: { id: offer.issuerCompanyId },
    });
    const company = await prisma.company.findUnique({ where: { id: offer.companyId } });
    if (!issuer || !company) {
      await ozviSe({
        caflouProjectId: vstup.caflouProjectId,
        projekt,
        zprava: `${projekt}: faktura se nevystavila automaticky — u nabídky chybí vystavovatel nebo odběratel.`,
      });
      return;
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
      await ozviSe({
        caflouProjectId: vstup.caflouProjectId,
        projekt,
        zprava: `${projekt}: faktura se nevystavila automaticky — nepodařilo se přidělit číslo faktury.`,
      });
      return;
    }

    // 5) ODESLÁNÍ. Stejnou cestou jako ruční tlačítko u dokladu - včetně PDF
    // s QR platbou a rodného listu spotu.
    const odeslano = await odesliFakturu({
      invoiceId: created.id,
      odeslal: vstup.kdo,
    });

    if (!odeslano.ok) {
      await ozviSe({
        caflouProjectId: vstup.caflouProjectId,
        projekt,
        zprava: `${projekt}: faktura ${created.number} se vystavila, ale neodešla — ${odeslano.error} Je v portálu rozepsaná, dá se poslat ručně.`,
      });
      return;
    }

    const komu = [odeslano.to, ...odeslano.kopie].join(', ');
    await ozviSe({
      caflouProjectId: vstup.caflouProjectId,
      projekt,
      zprava: `${projekt}: faktura ${created.number} se vystavila z nabídky a odešla klientovi (${komu}).`,
    });
  } catch (err) {
    console.error(`Automatická faktura u projektu ${vstup.caflouProjectId} selhala:`, err);
    await ozviSe({
      caflouProjectId: vstup.caflouProjectId,
      projekt,
      zprava: `${projekt}: automatická faktura selhala — ${err instanceof Error ? err.message : 'neznámá chyba'}. Vystavte ji prosím ručně.`,
    }).catch(() => undefined);
  }
}
