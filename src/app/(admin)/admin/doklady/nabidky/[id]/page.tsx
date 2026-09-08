import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { OfferEditor } from './OfferEditor';
import { listProjectOptions } from '@/lib/projectOptions';

// Detail nabidky - editor, ktery vypada jako samotny doklad (zadani 8. 9. 2026:
// "hlavně, ať je vše přehledné a intuitivní").
export const dynamic = 'force-dynamic';

export default async function OfferDetailPage({ params }: { params: { id: string } }) {
  const [offer, issuers, companies] = await Promise.all([
    prisma.offer.findUnique({
      where: { id: params.id },
      include: {
        issuer: true,
        company: true,
        items: { orderBy: { sortOrder: 'asc' } },
      },
    }),
    prisma.issuerCompany.findMany({ where: { active: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
    prisma.company.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  if (!offer) notFound();

  const projects = await listProjectOptions();

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { issuerCompanyId: offer.issuerCompanyId, currency: offer.currency },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
  });

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/doklady/nabidky" className="text-muted text-sm font-heading no-underline">
        ← Zpět na nabídky
      </Link>

      <OfferEditor
        offer={{
          id: offer.id,
          number: offer.number,
          status: offer.status,
          issuerCompanyId: offer.issuerCompanyId,
          companyId: offer.companyId,
          currency: offer.currency,
          issueDate: offer.issueDate.toISOString().slice(0, 10),
          validUntil: offer.validUntil ? offer.validUntil.toISOString().slice(0, 10) : '',
          subject: offer.subject ?? '',
          note: offer.note ?? '',
          approvalToken: offer.approvalToken,
          sentAt: offer.sentAt ? offer.sentAt.toISOString() : null,
          approvedAt: offer.approvedAt ? offer.approvedAt.toISOString() : null,
          approvedByName: offer.approvedByName,
          rejectedAt: offer.rejectedAt ? offer.rejectedAt.toISOString() : null,
          caflouProjectId: offer.caflouProjectId ?? '',
          projectName: offer.projectName,
          items: offer.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
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
          contactEmail: offer.company.contactEmail,
          addressStreet: offer.company.addressStreet,
          addressCity: offer.company.addressCity,
          addressZip: offer.company.addressZip,
        }}
        issuers={issuers.map((i) => ({ id: i.id, name: i.name }))}
        companies={companies}
        bankAccounts={bankAccounts.map((a) => ({
          label: a.label,
          accountNumber: a.accountNumber,
          iban: a.iban,
        }))}
        projects={projects.map((p) => ({ id: p.id, label: p.label, finished: p.finished }))}
      />
    </div>
  );
}
