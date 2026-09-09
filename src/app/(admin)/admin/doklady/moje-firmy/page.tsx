import Link from 'next/link';
import { prisma } from '@/lib/db';
import { CURRENCY_NAMES, previewNumbers } from '@/lib/doklady';
import { NewIssuerForm } from './NewIssuerForm';

// "Moje firmy" (zadani 6. 9. 2026) - fakturacni jednotky, za ktere Mediaspace
// vystavuje doklady. Bez aspon jedne nejde vystavit nabidku ani fakturu.
export const dynamic = 'force-dynamic';

export default async function IssuersPage() {
  const issuers = await prisma.issuerCompany.findMany({
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { bankAccounts: true, offers: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted font-body m-0 max-w-3xl">
        Vlastní fakturační údaje na jednom místě. U každé firmy si nastavíte číselné řady (aby šlo navázat na řadu z
        Caflou) a bankovní účty — klidně několik, každý ve své měně.
      </p>

      <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="bg-bar text-white font-heading text-xs">
                <th className="text-left px-4 py-3.5">Firma</th>
                <th className="text-left px-4 py-3.5 whitespace-nowrap">IČ</th>
                <th className="text-left px-4 py-3.5 whitespace-nowrap">Další faktura</th>
                <th className="text-left px-4 py-3.5 whitespace-nowrap">Další nabídka</th>
                <th className="text-left px-4 py-3.5 whitespace-nowrap">Měna</th>
                <th className="text-right px-4 py-3.5 whitespace-nowrap">Účty</th>
              </tr>
            </thead>
            <tbody>
              {issuers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm font-body">
                    Zatím tu není žádná firma. Založte první formulářem níže — bez ní nejde vystavit doklad.
                  </td>
                </tr>
              )}
              {issuers.map((issuer) => (
                <tr key={issuer.id} className="border-t border-line hover:bg-surfaceSoft">
                  <td className="px-4 py-3.5 font-heading font-semibold text-sm">
                    <Link href={`/admin/doklady/moje-firmy/${issuer.id}`} className="text-ink hover:text-brand-purple no-underline">
                      {issuer.name}
                    </Link>
                    {issuer.isDefault && (
                      <span className="ml-2 text-[10px] font-heading font-bold text-brand-purpleDeep bg-tint rounded px-1.5 py-0.5">
                        VÝCHOZÍ
                      </span>
                    )}
                    {!issuer.active && <span className="ml-2 text-xs text-muted">(neaktivní)</span>}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums">{issuer.ic || '—'}</td>
                  <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums">
                    {previewNumbers(issuer.invoiceNumberFormat, issuer.invoiceNextNumber, 1)[0]}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums">
                    {previewNumbers(issuer.offerNumberFormat, issuer.offerNextNumber, 1)[0]}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-heading text-muted">
                    {CURRENCY_NAMES[issuer.defaultCurrency]}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums text-right">
                    {issuer._count.bankAccounts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NewIssuerForm />
    </div>
  );
}
