import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getRateForCurrency } from '@/lib/cnb';
import { InvoiceEditor } from '../[id]/InvoiceEditor';
import { listProjectOptions } from '@/lib/projectOptions';

/**
 * Faktura z nabídky PŘED uložením (zadani 8. 9. 2026: "chci se dostat ještě
 * do editace faktury a až pak ji uložit").
 *
 * Nic se tu nezakládá - stránka jen předvyplní doklad z nabídky a nechá ho
 * upravit. Teprve tlačítko Uložit pošle POST /api/admin/invoices, které
 * fakturu založí a přidělí jí číslo z řady. Kdo si to rozmyslí, nenechá po
 * sobě rozpracovaný doklad ani díru v číselné řadě.
 */
export const dynamic = 'force-dynamic';

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function NewInvoiceFromOfferPage({
  searchParams,
}: {
  searchParams: { nabidka?: string; firma?: string; vydavatel?: string; predmet?: string };
}) {
  const offerId = searchParams?.nabidka;
  // Bez nabidky se zaklada prazdny doklad - taky se nic neuklada, dokud
  // clovek neda Ulozit (zadani 10. 9. 2026).
  if (!offerId) return <PrazdnaFaktura searchParams={searchParams} />;

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      issuer: true,
      company: true,
      invoice: { select: { id: true } },
    },
  });
  if (!offer) notFound();

  // Z jedné nabídky jen jedna faktura - když už existuje, jdeme rovnou na ni.
  if (offer.invoice) redirect(`/admin/doklady/faktury/${offer.invoice.id}`);

  const [companies, bankAccounts, rate] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.bankAccount.findMany({
      where: { issuerCompanyId: offer.issuerCompanyId },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
      select: { id: true, label: true, accountNumber: true, iban: true, currency: true },
    }),
    getRateForCurrency(offer.currency),
  ]);

  const projects = await listProjectOptions();

  const dnes = new Date();
  const splatnost = new Date(dnes);
  splatnost.setDate(splatnost.getDate() + (offer.company.paymentTermDays ?? 14));
  const ucet = bankAccounts.find((a) => a.currency === offer.currency) ?? null;

  return (
    <InvoiceEditor
      issuerCompanyId={offer.issuerCompanyId}
      draftFromOfferId={offer.id}
      invoice={{
        id: 'nova',
        number: 'Nová faktura',
        variableSymbol: '',
        status: 'DRAFT',
        companyId: offer.companyId,
        bankAccountId: ucet?.id ?? null,
        currency: offer.currency,
        exchangeRate: rate?.rate ?? 1,
        exchangeRateDate: rate ? new Date().toISOString() : null,
        issueDate: iso(dnes),
        taxDate: iso(dnes),
        dueDate: iso(splatnost),
        subject: offer.subject ?? '',
        note: offer.note ?? '',
        sentAt: null,
        paidAt: null,
        offerNumber: offer.number,
        // Projekt se prebira z nabidky (zadani 8. 9. 2026: z nabidky se musi
        // propsat vsechny udaje).
        caflouProjectId: offer.caflouProjectId ?? '',
        projectName: offer.projectName,
        // Nova faktura zacina v beznem rezimu a v jazyce nabidky.
        rezimDph: 'STANDARD',
        jazyk: offer.jazyk,
        items: offer.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          // OfferItem.unit muze byt v databazi null, editor ceka retezec.
          unit: i.unit ?? '',
          unitPriceMinor: i.unitPriceMinor,
          vatRate: i.vatRate,
        })),
      }}
      issuer={{
        name: offer.issuer.name,
        ic: offer.issuer.ic,
        dic: offer.issuer.dic,
        vatPayer: offer.issuer.vatPayer,
        addressStreet: offer.issuer.addressStreet,
        addressCity: offer.issuer.addressCity,
        addressZip: offer.issuer.addressZip,
      }}
      company={{
        name: offer.company.name,
        ic: offer.company.ic,
        dic: offer.company.dic,
        vatPayer: offer.company.vatPayer,
        contactEmail: offer.company.contactEmail,
        addressStreet: offer.company.addressStreet,
        addressCity: offer.company.addressCity,
        addressZip: offer.company.addressZip,
      }}
      companies={companies}
      bankAccounts={bankAccounts}
      projects={projects.map((p) => ({ id: p.id, label: p.label, finished: p.finished }))}
    />
  );
}

/**
 * Prázdná faktura - stejný editor, jen bez nabídky. Taky se nic nezakládá,
 * dokud člověk nedá Uložit; číslo z řady se tím pádem nespotřebuje
 * rozmyšlením (zadání 10. 9. 2026).
 */
async function PrazdnaFaktura({
  searchParams,
}: {
  searchParams: { firma?: string; vydavatel?: string; predmet?: string };
}) {
  const vydavatel = searchParams?.vydavatel
    ? await prisma.issuerCompany.findUnique({ where: { id: searchParams.vydavatel } })
    : await prisma.issuerCompany.findFirst({
        where: { active: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
  if (!vydavatel) redirect('/admin/doklady/moje-firmy');

  const [companies, bankAccounts, projects] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.bankAccount.findMany({
      where: { issuerCompanyId: vydavatel.id },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
      select: { id: true, label: true, accountNumber: true, iban: true, currency: true },
    }),
    listProjectOptions(),
  ]);

  const odberatel = searchParams?.firma
    ? await prisma.company.findUnique({ where: { id: searchParams.firma } })
    : null;

  const dnes = new Date();
  const splatnost = new Date(dnes);
  splatnost.setDate(splatnost.getDate() + (odberatel?.paymentTermDays ?? 14));
  const ucet = bankAccounts.find((a) => a.currency === vydavatel.defaultCurrency) ?? bankAccounts[0] ?? null;

  return (
    <InvoiceEditor
      issuerCompanyId={vydavatel.id}
      invoice={{
        id: 'nova',
        number: 'Nová faktura',
        variableSymbol: '',
        status: 'DRAFT',
        companyId: odberatel?.id ?? companies[0]?.id ?? '',
        bankAccountId: ucet?.id ?? null,
        currency: vydavatel.defaultCurrency,
        exchangeRate: 1,
        exchangeRateDate: null,
        issueDate: iso(dnes),
        taxDate: iso(dnes),
        dueDate: iso(splatnost),
        subject: searchParams?.predmet ?? '',
        note: '',
        sentAt: null,
        paidAt: null,
        offerNumber: null,
        caflouProjectId: '',
        projectName: null,
        rezimDph: 'STANDARD',
        jazyk: 'CS',
        items: [],
      }}
      issuer={{
        name: vydavatel.name,
        ic: vydavatel.ic,
        dic: vydavatel.dic,
        vatPayer: vydavatel.vatPayer,
        addressStreet: vydavatel.addressStreet,
        addressCity: vydavatel.addressCity,
        addressZip: vydavatel.addressZip,
      }}
      company={{
        name: odberatel?.name ?? '',
        ic: odberatel?.ic ?? null,
        dic: odberatel?.dic ?? null,
        vatPayer: odberatel?.vatPayer ?? false,
        contactEmail: odberatel?.contactEmail ?? null,
        addressStreet: odberatel?.addressStreet ?? null,
        addressCity: odberatel?.addressCity ?? null,
        addressZip: odberatel?.addressZip ?? null,
      }}
      companies={companies}
      bankAccounts={bankAccounts}
      projects={projects.map((p) => ({ id: p.id, label: p.label, finished: p.finished }))}
    />
  );
}
