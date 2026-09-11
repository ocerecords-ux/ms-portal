import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { InvoiceEditor } from './InvoiceEditor';
import { listProjectOptions } from '@/lib/projectOptions';

// Detail faktury - stejny "vypada jako doklad" editor jako u nabidek.
export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      issuer: { include: { bankAccounts: { orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] } } },
      company: true,
      offer: { select: { id: true, number: true } },
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!invoice) notFound();

  const projects = await listProjectOptions();

  const companies = await prisma.company.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/doklady/faktury" className="text-muted text-sm font-heading no-underline">
        ← Zpět na faktury
      </Link>

      <InvoiceEditor
        issuerCompanyId={invoice.issuerCompanyId}
        invoice={{
          id: invoice.id,
          number: invoice.number,
          variableSymbol: invoice.variableSymbol,
          status: invoice.status,
          companyId: invoice.companyId,
          bankAccountId: invoice.bankAccountId,
          currency: invoice.currency,
          exchangeRate: invoice.exchangeRate,
          exchangeRateDate: invoice.exchangeRateDate ? invoice.exchangeRateDate.toISOString() : null,
          issueDate: invoice.issueDate.toISOString().slice(0, 10),
          taxDate: invoice.taxDate ? invoice.taxDate.toISOString().slice(0, 10) : '',
          dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : '',
          subject: invoice.subject ?? '',
          note: invoice.note ?? '',
          sentAt: invoice.sentAt ? invoice.sentAt.toISOString() : null,
          paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
          offerNumber: invoice.offer?.number ?? null,
          caflouProjectId: invoice.caflouProjectId ?? '',
          projectName: invoice.projectName,
          rezimDph: invoice.rezimDph,
          jazyk: invoice.jazyk,
          items: invoice.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unit: i.unit ?? '',
            unitPriceMinor: i.unitPriceMinor,
            vatRate: i.vatRate,
          })),
        }}
        issuer={{
          name: invoice.issuer.name,
          ic: invoice.issuer.ic,
          dic: invoice.issuer.dic,
          vatPayer: invoice.issuer.vatPayer,
          addressStreet: invoice.issuer.addressStreet,
          addressCity: invoice.issuer.addressCity,
          addressZip: invoice.issuer.addressZip,
        }}
        company={{
          name: invoice.company.name,
          ic: invoice.company.ic,
          dic: invoice.company.dic,
          contactEmail: invoice.company.contactEmail,
          addressStreet: invoice.company.addressStreet,
          addressCity: invoice.company.addressCity,
          addressZip: invoice.company.addressZip,
        }}
        companies={companies}
        bankAccounts={invoice.issuer.bankAccounts.map((a) => ({
          id: a.id,
          label: a.label,
          accountNumber: a.accountNumber,
          iban: a.iban,
          currency: a.currency,
        }))}
        projects={projects.map((p) => ({ id: p.id, label: p.label, finished: p.finished }))}
      />
    </div>
  );
}
