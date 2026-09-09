import Link from 'next/link';
import { prisma } from '@/lib/db';
import { CURRENCY_NAMES, previewNumbers } from '@/lib/doklady';
import { NewIssuerForm } from './NewIssuerForm';
import { MojeFirmyTabulka, type MojeFirmaRadek } from './MojeFirmyTabulka';

// "Moje firmy" (zadani 6. 9. 2026) - fakturacni jednotky, za ktere Mediaspace
// vystavuje doklady. Bez aspon jedne nejde vystavit nabidku ani fakturu.
export const dynamic = 'force-dynamic';

export default async function IssuersPage() {
  const issuers = await prisma.issuerCompany.findMany({
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { bankAccounts: true, offers: true } } },
  });

  const radkyTabulky: MojeFirmaRadek[] = issuers.map((issuer) => ({
    id: issuer.id,
    nazev: issuer.name,
    vychozi: issuer.isDefault,
    aktivni: issuer.active,
    ic: issuer.ic || null,
    dalsiFaktura: previewNumbers(issuer.invoiceNumberFormat, issuer.invoiceNextNumber, 1)[0],
    dalsiNabidka: previewNumbers(issuer.offerNumberFormat, issuer.offerNextNumber, 1)[0],
    mena: CURRENCY_NAMES[issuer.defaultCurrency],
    uctu: issuer._count.bankAccounts,
  }));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted font-body m-0 max-w-3xl">
        Vlastní fakturační údaje na jednom místě. U každé firmy si nastavíte číselné řady (aby šlo navázat na řadu z
        Caflou) a bankovní účty — klidně několik, každý ve své měně.
      </p>

      <MojeFirmyTabulka radky={radkyTabulky} />

      <NewIssuerForm />
    </div>
  );
}
