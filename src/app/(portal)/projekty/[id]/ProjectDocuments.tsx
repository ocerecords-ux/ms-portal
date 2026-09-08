import Link from 'next/link';
import type { Currency } from '@prisma/client';
import { formatMoney, OFFER_STATUS_CLASSES, OFFER_STATUS_LABELS } from '@/lib/doklady';

/**
 * Doklady navázané na projekt (zadani 8. 9. 2026: "chtel bych mit Doklady
 * navazane na projekty. Kdyz rozkliknu projekt, uvidim doklady k projektu").
 *
 * Nabídky, vydané faktury a přijaté doklady pohromadě, dole shrnutí
 * fakturováno / náklady. Vazba se drží přes ID projektu v Caflou — stejně
 * jako u výkazů, protože projekt sám žije v Caflou.
 */

export type ProjectDocRow = {
  id: string;
  href: string;
  title: string;
  number: string;
  date: string;
  amountMinor: number;
  currency: Currency;
  statusLabel: string;
  statusClass: string;
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rozpracovaná',
  SENT: 'Neuhrazená',
  PAID: 'Uhrazená',
  CANCELLED: 'Stornovaná',
};

const INVOICE_STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-field text-muted',
  SENT: 'bg-[#F1ECFF] text-brand-purpleDark',
  PAID: 'bg-[#E3F9EC] text-status-done',
  CANCELLED: 'bg-red-50 text-red-600',
};

export function invoiceStatus(status: string): { label: string; className: string } {
  return {
    label: INVOICE_STATUS_LABELS[status] ?? status,
    className: INVOICE_STATUS_CLASSES[status] ?? 'bg-field text-muted',
  };
}

export function offerStatus(status: string): { label: string; className: string } {
  return {
    label: OFFER_STATUS_LABELS[status] ?? status,
    className: OFFER_STATUS_CLASSES[status] ?? 'bg-field text-muted',
  };
}

export function ProjectDocuments({
  offers,
  invoices,
  expenses,
  contracts,
  invoicedByCurrency,
  costsByCurrency,
}: {
  offers: ProjectDocRow[];
  invoices: ProjectDocRow[];
  expenses: ProjectDocRow[];
  contracts: ProjectDocRow[];
  invoicedByCurrency: { currency: Currency; minor: number }[];
  costsByCurrency: { currency: Currency; minor: number }[];
}) {
  const celkem = offers.length + invoices.length + expenses.length + contracts.length;

  return (
    <div className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Doklady k projektu
        </h2>
        <Link href="/admin/doklady" className="text-xs font-heading font-semibold text-brand-purple no-underline">
          Přejít do Dokladů →
        </Link>
      </div>

      {celkem === 0 ? (
        <p className="text-sm font-body text-muted m-0">
          K tomuhle projektu zatím žádný doklad navázaný není. Projekt se vybírá přímo na nabídce,
          faktuře nebo výdaji.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <Block title="Smlouvy" rows={contracts} hideAmount />
          <Block title="Nabídky" rows={offers} />
          <Block title="Vydané faktury" rows={invoices} />
          <Block title="Přijaté doklady" rows={expenses} />

          <div className="flex items-center gap-8 flex-wrap border-t border-line pt-4">
            <Sum label="Fakturováno" values={invoicedByCurrency} />
            <Sum label="Náklady" values={costsByCurrency} />
          </div>
        </div>
      )}
    </div>
  );
}

function Block({ title, rows, hideAmount }: { title: string; rows: ProjectDocRow[]; hideAmount?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-heading font-semibold text-xs text-muted uppercase tracking-wide m-0">
        {title} <span className="tabular-nums opacity-70">({rows.length})</span>
      </h3>
      <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-4 py-2.5">
            <span className="min-w-0">
              <Link href={row.href} className="text-sm font-heading font-semibold text-ink hover:text-brand-purple no-underline block truncate">
                {row.title}
              </Link>
              <span className="block text-xs text-muted font-body">
                <span className="tabular-nums">{row.number}</span>
                {row.date ? ` · ${row.date}` : ''}
              </span>
            </span>
            <span className="flex items-center gap-4 shrink-0">
              {!hideAmount && (
                <span className="text-sm font-heading text-ink tabular-nums">
                  {formatMoney(row.amountMinor, row.currency)}
                </span>
              )}
              <span
                className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${row.statusClass}`}
              >
                {row.statusLabel}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sum({ label, values }: { label: string; values: { currency: Currency; minor: number }[] }) {
  return (
    <span className="flex items-baseline gap-3">
      <span className="text-xs font-heading text-muted uppercase tracking-wide">{label}</span>
      {values.length === 0 ? (
        <span className="font-display text-xl text-muted">—</span>
      ) : (
        values.map((v) => (
          <span key={v.currency} className="font-display text-xl text-ink tabular-nums">
            {formatMoney(v.minor, v.currency)}
          </span>
        ))
      )}
    </span>
  );
}
