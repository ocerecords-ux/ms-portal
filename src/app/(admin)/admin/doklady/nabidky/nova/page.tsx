import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { listProjectOptions } from '@/lib/projectOptions';
import { OfferEditor } from '../[id]/OfferEditor';

/**
 * Nová nabídka BEZ mezikroku (zadání 10. 9. 2026: „dej pryč ten mezikrok při
 * vystavování dokladu, rovnou po kliknutí ukaž náhled").
 *
 * Nic se tu nezakládá - stránka jen otevře prázdný doklad s náhledem vedle.
 * Teprve Uložit pošle POST /api/admin/offers, který nabídku založí a přidělí
 * jí číslo z řady. Kdo si to rozmyslí, nenechá po sobě prázdnou nabídku ani
 * díru v číselné řadě.
 */
export const dynamic = 'force-dynamic';

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function NovaNabidkaPage({
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

  const [issuers, companies, bankAccounts, projects] = await Promise.all([
    prisma.issuerCompany.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.company.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.bankAccount.findMany({
      where: { issuerCompanyId: vydavatel.id },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
      select: { label: true, accountNumber: true, iban: true },
    }),
    listProjectOptions(),
  ]);

  const odberatel = searchParams?.firma
    ? await prisma.company.findUnique({ where: { id: searchParams.firma } })
    : null;

  const dnes = new Date();
  const platnost = new Date(dnes);
  platnost.setDate(platnost.getDate() + 30);

  return (
    <OfferEditor
      offer={{
        id: 'nova',
        number: 'Nová nabídka',
        status: 'DRAFT',
        issuerCompanyId: vydavatel.id,
        companyId: odberatel?.id ?? companies[0]?.id ?? '',
        currency: vydavatel.defaultCurrency,
        issueDate: iso(dnes),
        validUntil: iso(platnost),
        subject: searchParams?.predmet ?? '',
        note: '',
        approvalToken: '',
        sentAt: null,
        approvedAt: null,
        approvedByName: null,
        rejectedAt: null,
        caflouProjectId: '',
        projectName: null,
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
      issuers={issuers}
      companies={companies}
      bankAccounts={bankAccounts}
      projects={projects.map((p) => ({ id: p.id, label: p.label, finished: p.finished }))}
    />
  );
}
