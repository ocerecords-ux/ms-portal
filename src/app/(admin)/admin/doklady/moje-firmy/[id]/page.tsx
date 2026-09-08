import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { IssuerForm } from './IssuerForm';
import { BankAccounts } from './BankAccounts';

// Detail vlastni fakturacni firmy - udaje, ciselne rady a bankovni ucty.
export const dynamic = 'force-dynamic';

export default async function IssuerDetailPage({ params }: { params: { id: string } }) {
  const issuer = await prisma.issuerCompany.findUnique({
    where: { id: params.id },
    include: { bankAccounts: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } },
  });
  if (!issuer) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Link href="/admin/doklady/moje-firmy" className="text-muted text-sm font-heading no-underline">
        ← Zpět na moje firmy
      </Link>

      <IssuerForm
        issuer={{
          id: issuer.id,
          name: issuer.name,
          ic: issuer.ic,
          dic: issuer.dic,
          vatPayer: issuer.vatPayer,
          addressStreet: issuer.addressStreet,
          addressCity: issuer.addressCity,
          addressZip: issuer.addressZip,
          addressCountry: issuer.addressCountry,
          email: issuer.email,
          phone: issuer.phone,
          invoiceNumberFormat: issuer.invoiceNumberFormat,
          invoiceNextNumber: issuer.invoiceNextNumber,
          offerNumberFormat: issuer.offerNumberFormat,
          offerNextNumber: issuer.offerNextNumber,
          defaultCurrency: issuer.defaultCurrency,
          isDefault: issuer.isDefault,
          active: issuer.active,
        }}
      />

      <BankAccounts
        issuerId={issuer.id}
        accounts={issuer.bankAccounts.map((a) => ({
          id: a.id,
          label: a.label,
          accountNumber: a.accountNumber,
          iban: a.iban,
          swift: a.swift,
          bankName: a.bankName,
          currency: a.currency,
          isDefault: a.isDefault,
        }))}
      />
    </div>
  );
}
