import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { computeTotals, formatAddress, formatMoney } from '@/lib/doklady';
import { OfferApproval } from './OfferApproval';

// Nabidka pro klienta (zadani 6. 9. 2026). Verejna stranka - klient sem prijde
// z e-mailu odkazem s tokenem a nemusi se prihlasovat. Nabidka se hleda
// VYHRADNE podle tokenu, zadne ID z adresy se nikam nepropisuje.
export const dynamic = 'force-dynamic';

function formatDate(date: Date | null): string {
  return date ? new Intl.DateTimeFormat('cs-CZ').format(date) : '—';
}

export default async function PublicOfferPage({ params }: { params: { token: string } }) {
  const offer = await prisma.offer.findUnique({
    where: { approvalToken: params.token },
    include: { issuer: true, company: true, items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!offer) notFound();

  const totals = computeTotals(offer.items);

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-10 py-6 flex items-center gap-3 sm:gap-4">
        <span className="font-body text-brand-green font-semibold text-2xl sm:text-3xl">MS portal</span>
        <span className="w-px h-8 sm:h-10 bg-white/40" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-12 sm:h-14 w-auto" />
      </header>

      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8 sm:py-12 flex flex-col gap-6">
        <div>
          <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">Nabídka {offer.number}</p>
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0 mt-1">
            {offer.subject || 'Nabídka k odsouhlasení'}
          </h1>
          <p className="text-muted text-sm mt-2 font-body m-0">
            Vystaveno {formatDate(offer.issueDate)}
            {offer.validUntil ? ` · platnost do ${formatDate(offer.validUntil)}` : ''}
          </p>
        </div>

        <div className="bg-white rounded-card border border-line shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 border-b border-line">
            <div>
              <span className="text-xs font-heading text-muted uppercase tracking-wide">Dodavatel</span>
              <p className="font-heading font-semibold text-ink m-0 mt-1">{offer.issuer.name}</p>
              <p className="text-sm font-body text-muted m-0 mt-0.5">
                {formatAddress(offer.issuer) || '—'}
                <br />
                {offer.issuer.ic ? `IČ ${offer.issuer.ic}` : ''}
                {offer.issuer.dic ? ` · DIČ ${offer.issuer.dic}` : ''}
              </p>
            </div>
            <div>
              <span className="text-xs font-heading text-muted uppercase tracking-wide">Odběratel</span>
              <p className="font-heading font-semibold text-ink m-0 mt-1">{offer.company.name}</p>
              <p className="text-sm font-body text-muted m-0 mt-0.5">
                {formatAddress(offer.company) || '—'}
                <br />
                {offer.company.ic ? `IČ ${offer.company.ic}` : ''}
                {offer.company.dic ? ` · DIČ ${offer.company.dic}` : ''}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="bg-field text-muted font-heading text-[11px] uppercase tracking-wide">
                  <th className="text-left px-6 py-3">Položka</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">Množství</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">Cena / j.</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">DPH</th>
                  <th className="text-right px-6 py-3 whitespace-nowrap">Celkem</th>
                </tr>
              </thead>
              <tbody>
                {offer.items.map((item) => (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-6 py-3.5 text-sm font-body text-ink">{item.description}</td>
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums text-right whitespace-nowrap">
                      {item.quantity} {item.unit ?? ''}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums text-right whitespace-nowrap">
                      {formatMoney(item.unitPriceMinor, offer.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums text-right whitespace-nowrap">
                      {item.vatRate} %
                    </td>
                    <td className="px-6 py-3.5 text-sm font-heading text-ink tabular-nums text-right whitespace-nowrap">
                      {formatMoney(Math.round(item.quantity * item.unitPriceMinor), offer.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-line p-6 flex justify-end">
            <div className="w-full max-w-xs flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm font-heading">
                <span className="text-muted">Základ bez DPH</span>
                <span className="text-ink tabular-nums">{formatMoney(totals.exVat, offer.currency)}</span>
              </div>
              {totals.byRate.map((r) => (
                <div key={r.rate} className="flex items-center justify-between text-sm font-heading">
                  <span className="text-muted">DPH {r.rate} %</span>
                  <span className="text-muted tabular-nums">{formatMoney(r.vat, offer.currency)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-line pt-2 mt-1">
                <span className="font-heading font-semibold text-ink">Celkem</span>
                <span className="font-display text-2xl text-ink tabular-nums">
                  {formatMoney(totals.incVat, offer.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {offer.note && (
          <div className="bg-white rounded-card border border-line shadow-sm p-6">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Poznámka</span>
            <p className="text-sm font-body text-ink m-0 mt-2 whitespace-pre-line">{offer.note}</p>
          </div>
        )}

        <OfferApproval
          token={offer.approvalToken}
          status={offer.status}
          approvedByName={offer.approvedByName}
          approvedAt={offer.approvedAt ? offer.approvedAt.toISOString() : null}
          rejectedAt={offer.rejectedAt ? offer.rejectedAt.toISOString() : null}
          issuerName={offer.issuer.name}
          issuerEmail={offer.issuer.email}
        />
      </div>
    </main>
  );
}
