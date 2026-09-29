import Link from 'next/link';
import { prisma } from '@/lib/db';
import { computeTotals, formatMoney } from '@/lib/doklady';
import { NewInvoiceForm } from './NewInvoiceForm';
import { StahnoutPrilohy } from '../StahnoutPrilohy';
import { FakturyTabulka, type FakturaRadek } from './FakturyTabulka';
import { nactiJazyk } from '@/lib/jazykServer';
import { formatDatum, prelozit } from '@/lib/jazyk';

// Prehled vydanych faktur (zadani 6. 9. 2026). Zalozky podle stavu - nejdulezitejsi
// je videt, co je jeste neuhrazene a co je uz po splatnosti.
export const dynamic = 'force-dynamic';

// Zalozka "Vse" tu byla navic (zadani 8. 9. 2026) - stavy pokryvaji vsechno.
const TABS = [
  { key: 'rozpracovane', klic: 'faktura.zalozkaRozpracovane', statuses: ['DRAFT'] },
  { key: 'neuhrazene', klic: 'faktura.zalozkaNeuhrazene', statuses: ['SENT'] },
  { key: 'uhrazene', klic: 'faktura.zalozkaUhrazene', statuses: ['PAID'] },
  { key: 'stornovane', klic: 'faktura.zalozkaStornovane', statuses: ['CANCELLED'] },
] as const;

const STATUS_KLICE: Record<string, string> = {
  DRAFT: 'faktura.stavRozpracovana',
  SENT: 'faktura.stavNeuhrazena',
  PAID: 'faktura.stavUhrazena',
  CANCELLED: 'faktura.stavStornovana',
};

// Poradi pri razeni podle stavu: co ceka na akci, jde napred.
const STATUS_PORADI: Record<string, number> = {
  SENT: 0,
  DRAFT: 1,
  PAID: 2,
  CANCELLED: 3,
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-field text-muted',
  SENT: 'bg-tint text-brand-purpleDark',
  PAID: 'bg-okTint text-status-done',
  CANCELLED: 'bg-dangerTint text-danger',
};

export default async function InvoicesPage({ searchParams }: { searchParams: { tab?: string } }) {
  const jazyk = nactiJazyk();

  // NEUHRAZENE JSOU PRVNI (zadani 15. 9. 2026: „kdyz se dostanu na zalozku
  // Faktury, chci videt nejdriv neuhrazene faktury"). Rozpracovane zustavaji
  // v zalozkach, jen uz nejsou to prvni, co clovek uvidi.
  const vychoziTab = TABS.find((t) => t.key === 'neuhrazene') ?? TABS[0];
  const activeTab = TABS.find((t) => t.key === searchParams?.tab) ?? vychoziTab;

  const [invoices, issuers, counts] = await Promise.all([
    prisma.invoice.findMany({
      where: activeTab.statuses ? { status: { in: activeTab.statuses as never } } : {},
      orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
      take: 300,
      include: { company: { select: { name: true } }, items: true },
    }),
    prisma.issuerCompany.findMany({ where: { active: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
    prisma.invoice.groupBy({ by: ['status'], _count: true }),
  ]);

  const countFor = (statuses: readonly string[] | null) =>
    statuses
      ? counts.filter((c) => statuses.includes(c.status)).reduce((sum, c) => sum + c._count, 0)
      : counts.reduce((sum, c) => sum + c._count, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Souhrn nad seznamem - kolik je v jake mene neuhrazeno.
  const unpaid = invoices.filter((i) => i.status === 'SENT');
  const unpaidByCurrency = new Map<string, number>();
  for (const invoice of unpaid) {
    const totals = computeTotals(invoice.items, invoice);
    unpaidByCurrency.set(invoice.currency, (unpaidByCurrency.get(invoice.currency) ?? 0) + totals.incVat);
  }

  // Radky pro tabulku. Formatuje se tady na serveru, do prohlizece jde hotovy
  // text a k nemu cislo pro razeni - podle vypsaneho textu by razeni datumu
  // ani castek nefungovalo.
  const radkyTabulky: FakturaRadek[] = invoices.map((invoice) => {
    const totals = computeTotals(invoice.items, invoice);
    return {
      id: invoice.id,
      nazev: invoice.subject || prelozit(jazyk, 'faktura.bezNazvu'),
      cislo: invoice.number,
      projekt: invoice.projectName || null,
      odberatel: invoice.company.name,
      vystaveno: formatDatum(jazyk, invoice.issueDate),
      vystavenoMs: invoice.issueDate ? new Date(invoice.issueDate).getTime() : null,
      splatnost: formatDatum(jazyk, invoice.dueDate),
      splatnostMs: invoice.dueDate ? new Date(invoice.dueDate).getTime() : null,
      poSplatnosti: Boolean(
        invoice.status === 'SENT' && invoice.dueDate && new Date(invoice.dueDate) < today,
      ),
      stav: STATUS_KLICE[invoice.status] ? prelozit(jazyk, STATUS_KLICE[invoice.status]) : invoice.status,
      stavTrida: STATUS_CLASSES[invoice.status] ?? 'bg-field text-muted',
      stavPoradi: STATUS_PORADI[invoice.status] ?? 9,
      castka: formatMoney(totals.incVat, invoice.currency, jazyk),
      castkaMinor: totals.incVat,
      cast: invoice.interniCast ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-3 sm:gap-6">
      {issuers.length === 0 ? (
        <div className="bg-surface rounded-card border border-line shadow-sm px-6 py-10 text-center">
          <p className="font-heading font-semibold text-ink m-0">{prelozit(jazyk, 'faktura.zadnaFirmaNadpis')}</p>
          <p className="text-sm text-muted font-body m-0 mt-1 max-w-lg mx-auto">
            {prelozit(jazyk, 'faktura.zadnaFirmaPopis')}
          </p>
          <Link
            href="/admin/doklady/moje-firmy"
            className="inline-block mt-4 bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 no-underline"
          >
            {prelozit(jazyk, 'faktura.prejitNaMojeFirmy')}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-1 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 w-[calc(100%+2rem)] sm:w-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((tab) => {
                const active = tab.key === activeTab.key;
                return (
                  <Link
                    key={tab.key}
                    href={`/admin/doklady/faktury?tab=${tab.key}`}
                    className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-heading font-semibold rounded-pill no-underline transition-colors ${
                      active ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {prelozit(jazyk, tab.klic)}{' '}
                    <span className="tabular-nums opacity-80">({countFor(tab.statuses)})</span>
                  </Link>
                );
              })}
            </div>
            {/* Na telefonu se doklady nezakládají (21. 9. 2026: „takto zredukujme i stránku Doklady v mobilu") - stejně jako Nový projekt. */}
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
              {/* Vystavené faktury za měsíc v jednom ZIPu (zadání 16. 9. 2026). */}
              <StahnoutPrilohy druh="faktury" />
              <NewInvoiceForm />
            </div>
          </div>

          {unpaidByCurrency.size > 0 && (
            <div className="bg-surface rounded-card border border-line shadow-sm px-5 py-4 flex items-center gap-6 flex-wrap">
              <span className="text-xs font-heading text-muted uppercase tracking-wide">
                {prelozit(jazyk, 'faktura.neuhrazenoCelkem')}
              </span>
              {Array.from(unpaidByCurrency.entries()).map(([currency, amount]) => (
                <span key={currency} className="font-display text-xl text-ink tabular-nums">
                  {formatMoney(amount, currency as never, jazyk)}
                </span>
              ))}
            </div>
          )}

          {/* Mazat jde jen ve Stornovanych (zadani 17. 9. 2026). */}
          <FakturyTabulka radky={radkyTabulky} lzeMazat={activeTab.key === 'stornovane'} />
        </>
      )}
    </div>
  );
}
