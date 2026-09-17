import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/doklady';
import { computeTotals } from '@/lib/doklady';
import { bankaNastavena } from '@/lib/gocardless';
import { BankaKlient, type NapojeniRadek, type PohybRadek, type FakturaVolba } from './BankaKlient';

/**
 * BANKA (zadání 17. 9. 2026: „potřebuju, ať se ta banka páruje sama").
 *
 * Přehled napojených účtů a pohybů, které z nich přišly. Co sedělo na
 * variabilní symbol i částku, je už označené jako uhrazené; zbytek tu čeká
 * na jedno kliknutí.
 */
export const dynamic = 'force-dynamic';

function den(date: Date | null): string {
  return date ? new Intl.DateTimeFormat('cs-CZ').format(date) : '—';
}

export default async function BankaPage() {
  const [napojeni, pohyby, faktury] = await Promise.all([
    prisma.bankConnection.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        institutionName: true,
        label: true,
        iban: true,
        stav: true,
        consentExpiresAt: true,
        lastSyncAt: true,
        lastSyncError: true,
        issuer: { select: { name: true } },
      },
    }),
    prisma.bankTransaction.findMany({
      orderBy: { bookedAt: 'desc' },
      take: 150,
      select: {
        id: true,
        bookedAt: true,
        amountMinor: true,
        currency: true,
        variableSymbol: true,
        counterpartyName: true,
        reference: true,
        stav: true,
        navrhDuvod: true,
        navrhInvoiceId: true,
        invoice: { select: { id: true, number: true, company: { select: { name: true } } } },
      },
    }),
    prisma.invoice.findMany({
      where: { status: 'SENT' },
      orderBy: { issueDate: 'desc' },
      select: {
        id: true,
        number: true,
        variableSymbol: true,
        currency: true,
        slevaProcent: true,
        slevaMinor: true,
        company: { select: { name: true } },
        items: { select: { quantity: true, unitPriceMinor: true, vatRate: true } },
      },
    }),
  ]);

  const volbyFaktur: FakturaVolba[] = faktury.map((f) => {
    const celkem = computeTotals(f.items, { slevaProcent: f.slevaProcent, slevaMinor: f.slevaMinor }).incVat;
    return {
      id: f.id,
      popis: `${f.number} · ${f.company?.name ?? ''} · ${formatMoney(celkem, f.currency)}`,
      variableSymbol: f.variableSymbol,
    };
  });

  const radkyNapojeni: NapojeniRadek[] = napojeni.map((n) => ({
    id: n.id,
    nazev: [n.label, n.institutionName].filter(Boolean).join(' · ') || n.institutionName,
    firma: n.issuer?.name ?? null,
    iban: n.iban,
    stav: n.stav,
    souhlasDo: den(n.consentExpiresAt),
    souhlasDnu: n.consentExpiresAt
      ? Math.ceil((n.consentExpiresAt.getTime() - Date.now()) / 86400000)
      : null,
    posledni: n.lastSyncAt ? new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(n.lastSyncAt) : null,
    chyba: n.lastSyncError,
  }));

  const radkyPohybu: PohybRadek[] = pohyby.map((p) => ({
    id: p.id,
    datum: den(p.bookedAt),
    castka: formatMoney(p.amountMinor, p.currency),
    prichozi: p.amountMinor > 0,
    vs: p.variableSymbol,
    protistrana: p.counterpartyName,
    zprava: p.reference,
    stav: p.stav,
    duvod: p.navrhDuvod,
    fakturaId: p.invoice?.id ?? null,
    fakturaPopis: p.invoice ? `${p.invoice.number} · ${p.invoice.company?.name ?? ''}` : null,
    navrhInvoiceId: p.navrhInvoiceId,
    navrhPopis: p.navrhInvoiceId ? (volbyFaktur.find((f) => f.id === p.navrhInvoiceId)?.popis ?? null) : null,
  }));

  return (
    <BankaKlient
      nastaveno={bankaNastavena()}
      napojeni={radkyNapojeni}
      pohyby={radkyPohybu}
      faktury={volbyFaktur}
    />
  );
}
