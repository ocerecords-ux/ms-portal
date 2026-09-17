import { prisma } from '@/lib/db';
import { computeTotals, formatMoney } from '@/lib/doklady';
import { notifyMany } from '@/lib/notifications';
import { nactiSouhlas, nactiTransakce, nactiUcet, textPlatby, type GcTransakce } from '@/lib/gocardless';
import { najdiFakturuKPlatbe, vyctiVariabilniSymbol, type FakturaKParovani } from '@/lib/parovaniPlateb';
import type { Currency } from '@prisma/client';

/**
 * STAHOVÁNÍ POHYBŮ A PÁROVÁNÍ (zadání 17. 9. 2026: „potřebuju, ať se ta banka
 * páruje sama").
 *
 * Portál si z banky stáhne zaúčtované pohyby, uloží je (i ty, které k ničemu
 * nepatří - jinak by nebylo kde ověřit, proč faktura zůstala neuhrazená)
 * a zkusí je přiřadit k neuhrazeným fakturám. Pravidlo je v lib/parovaniPlateb:
 * sedí VS i částka → faktura se označí sama, sedí jen jedno → jen návrh.
 *
 * Pouští se to z cronu (/api/cron/banka) i tlačítkem v sekci Doklady.
 */

/** O kolik dnů zpátky se kouká, když se stahuje poprvé. */
const PRVNI_STAZENI_DNU = 90;
/** Překryv proti tomu, aby pohyb zaúčtovaný zpětně propadl. */
const PREKRYV_DNU = 7;

export type VysledekSynchronizace = {
  stazeno: number;
  nove: number;
  sparovano: number;
  navrhy: number;
  chyby: string[];
};

function minorZCastky(amount: string): number {
  const cislo = Number.parseFloat(String(amount).replace(',', '.'));
  if (!Number.isFinite(cislo)) return 0;
  return Math.round(cislo * 100);
}

function datumPohybu(t: GcTransakce): Date {
  const iso = t.bookingDate || t.valueDate;
  const datum = iso ? new Date(`${iso}T12:00:00.000Z`) : new Date();
  return Number.isNaN(datum.getTime()) ? new Date() : datum;
}

/** Id pohybu od banky. Když ho banka nedá, poskládá se z toho, co dala. */
function idPohybu(t: GcTransakce): string {
  if (t.transactionId) return t.transactionId;
  if (t.internalTransactionId) return t.internalTransactionId;
  const zaklad = [t.bookingDate, t.transactionAmount?.amount, t.debtorName, textPlatby(t)].join('|');
  return `bez-id:${zaklad.slice(0, 180)}`;
}

/** Neuhrazené faktury, mezi kterými se hledá. Součty se dopočítají z položek. */
async function neuhrazeneFaktury(issuerCompanyId: string | null): Promise<FakturaKParovani[]> {
  const faktury = await prisma.invoice.findMany({
    where: {
      status: 'SENT',
      ...(issuerCompanyId ? { issuerCompanyId } : {}),
    },
    select: {
      id: true,
      number: true,
      variableSymbol: true,
      currency: true,
      slevaProcent: true,
      slevaMinor: true,
      items: { select: { quantity: true, unitPriceMinor: true, vatRate: true } },
    },
  });

  return faktury.map((f) => ({
    id: f.id,
    number: f.number,
    variableSymbol: f.variableSymbol,
    currency: f.currency,
    totalIncVatMinor: computeTotals(f.items, { slevaProcent: f.slevaProcent, slevaMinor: f.slevaMinor }).incVat,
  }));
}

/**
 * Komu cinkne zvoneček. Jen těm, kdo na banku vidí (zadání 17. 9. 2026:
 * „nastavení a párování banky bych měl vidět jen já a Bára Šiblová") - kdo
 * se do sekce nedostane, nemá důvod vědět, kdo co zaplatil.
 */
async function adminiIds(): Promise<string[]> {
  const lide = await prisma.user.findMany({ where: { active: true, vidiBanku: true }, select: { id: true } });
  return lide.map((u) => u.id);
}

/**
 * Jedno napojení: stáhnout pohyby, uložit nové a zkusit je spárovat.
 */
async function sesynchronizujNapojeni(napojeni: {
  id: string;
  accountId: string | null;
  issuerCompanyId: string | null;
  lastSyncAt: Date | null;
  requisitionId: string;
  label: string | null;
}): Promise<VysledekSynchronizace> {
  const vysledek: VysledekSynchronizace = { stazeno: 0, nove: 0, sparovano: 0, navrhy: 0, chyby: [] };

  let accountId = napojeni.accountId;
  if (!accountId) {
    // Souhlas mohl být odkliknutý až po založení - zkusíme účet dotáhnout.
    const souhlas = await nactiSouhlas(napojeni.requisitionId);
    accountId = souhlas.accounts[0] ?? null;
    if (!accountId) {
      throw new Error('Souhlas v bance ještě není potvrzený.');
    }
    const ucet = await nactiUcet(accountId);
    await prisma.bankConnection.update({
      where: { id: napojeni.id },
      data: { accountId, iban: ucet.iban ?? null, stav: 'AKTIVNI' },
    });
  }

  const odeDne = new Date();
  odeDne.setDate(
    odeDne.getDate() -
      (napojeni.lastSyncAt
        ? Math.max(PREKRYV_DNU, Math.ceil((Date.now() - napojeni.lastSyncAt.getTime()) / 86400000) + PREKRYV_DNU)
        : PRVNI_STAZENI_DNU),
  );

  const pohyby = await nactiTransakce(accountId, odeDne);
  vysledek.stazeno = pohyby.length;
  if (pohyby.length === 0) return vysledek;

  const faktury = await neuhrazeneFaktury(napojeni.issuerCompanyId);
  const uhrazene: { invoiceId: string; amountMinor: number; currency: Currency; bookedAt: Date }[] = [];

  for (const pohyb of pohyby) {
    const externalId = idPohybu(pohyb);
    const uz = await prisma.bankTransaction.findUnique({
      where: { connectionId_externalId: { connectionId: napojeni.id, externalId } },
      select: { id: true },
    });
    if (uz) continue;

    const text = textPlatby(pohyb);
    const amountMinor = minorZCastky(pohyb.transactionAmount?.amount ?? '0');
    const currency = (pohyb.transactionAmount?.currency ?? 'CZK') as Currency;
    const zaznam = {
      connectionId: napojeni.id,
      externalId,
      bookedAt: datumPohybu(pohyb),
      amountMinor,
      currency,
      variableSymbol: vyctiVariabilniSymbol(text),
      counterpartyName: pohyb.debtorName ?? pohyb.creditorName ?? null,
      counterpartyAccount: pohyb.debtorAccount?.iban ?? pohyb.debtorAccount?.bban ?? null,
      reference: text || null,
    };

    const nalez = najdiFakturuKPlatbe(
      { amountMinor, currency, variableSymbol: zaznam.variableSymbol, reference: text },
      faktury,
    );

    if (nalez.druh === 'presna') {
      await prisma.bankTransaction.create({
        data: { ...zaznam, stav: 'AUTO', invoiceId: nalez.invoiceId, navrhDuvod: nalez.duvod },
      });
      await prisma.invoice.update({
        where: { id: nalez.invoiceId },
        data: { status: 'PAID', paidAt: zaznam.bookedAt, paidAmountMinor: amountMinor },
      });
      // Uhrazená faktura už není ve hře pro další pohyb ze stejného stažení.
      const index = faktury.findIndex((f) => f.id === nalez.invoiceId);
      if (index >= 0) faktury.splice(index, 1);
      uhrazene.push({ invoiceId: nalez.invoiceId, amountMinor, currency, bookedAt: zaznam.bookedAt });
      vysledek.sparovano++;
    } else if (nalez.druh === 'navrh') {
      await prisma.bankTransaction.create({
        data: { ...zaznam, stav: 'NAVRH', navrhInvoiceId: nalez.invoiceId, navrhDuvod: nalez.duvod },
      });
      vysledek.navrhy++;
    } else {
      await prisma.bankTransaction.create({ data: { ...zaznam, stav: 'NOVA', navrhDuvod: nalez.duvod } });
    }
    vysledek.nove++;
  }

  if (uhrazene.length > 0 || vysledek.navrhy > 0) {
    await oznam(uhrazene, vysledek.navrhy);
  }

  return vysledek;
}

/** Zvoneček: co se zaplatilo a kolik věcí čeká na odklik. */
async function oznam(
  uhrazene: { invoiceId: string; amountMinor: number; currency: Currency; bookedAt: Date }[],
  navrhy: number,
) {
  const prijemci = await adminiIds();
  if (prijemci.length === 0) return;

  for (const platba of uhrazene) {
    const faktura = await prisma.invoice.findUnique({
      where: { id: platba.invoiceId },
      select: { number: true, company: { select: { name: true } } },
    });
    await notifyMany(prijemci, {
      kind: 'faktura-uhrazena',
      title: `Uhrazeno: faktura ${faktura?.number ?? ''}`,
      body: `${faktura?.company?.name ?? 'Odběratel'} poslal ${formatMoney(platba.amountMinor, platba.currency)}.`,
      url: '/admin/doklady/faktury',
    });
  }

  if (navrhy > 0) {
    await notifyMany(prijemci, {
      kind: 'banka-navrh',
      title: navrhy === 1 ? 'Platba čeká na spárování' : `${navrhy} platby čekají na spárování`,
      body: 'Částka nebo variabilní symbol nesedí přesně - podívejte se na to.',
      url: '/admin/doklady/banka',
    });
  }
}

/** Všechna napojení naráz. Chyba jednoho účtu nezastaví ostatní. */
export async function sesynchronizujBanku(): Promise<VysledekSynchronizace> {
  const celkem: VysledekSynchronizace = { stazeno: 0, nove: 0, sparovano: 0, navrhy: 0, chyby: [] };

  const napojeni = await prisma.bankConnection.findMany({
    where: { stav: { in: ['AKTIVNI', 'CEKA'] } },
    select: {
      id: true,
      accountId: true,
      issuerCompanyId: true,
      lastSyncAt: true,
      requisitionId: true,
      label: true,
      consentExpiresAt: true,
    },
  });

  for (const n of napojeni) {
    try {
      const d = await sesynchronizujNapojeni(n);
      celkem.stazeno += d.stazeno;
      celkem.nove += d.nove;
      celkem.sparovano += d.sparovano;
      celkem.navrhy += d.navrhy;
      await prisma.bankConnection.update({
        where: { id: n.id },
        data: { lastSyncAt: new Date(), lastSyncError: null, stav: 'AKTIVNI' },
      });
    } catch (err) {
      const zprava = err instanceof Error ? err.message : 'Neznámá chyba.';
      celkem.chyby.push(`${n.label ?? 'účet'}: ${zprava}`);
      // Vypršelý souhlas není chyba k opravování - je to úkol pro člověka.
      const vyprselo = /401|403|expired|EXPIRED/i.test(zprava);
      await prisma.bankConnection.update({
        where: { id: n.id },
        data: { lastSyncError: zprava, ...(vyprselo ? { stav: 'VYPRSELO' } : {}) },
      });
    }
  }

  return celkem;
}

/** Ruční spárování nebo odložení jednoho pohybu (tlačítka v přehledu). */
export async function rozhodniOPohybu(
  id: string,
  akce: 'sparovat' | 'ignorovat' | 'odparovat',
  invoiceId?: string | null,
): Promise<{ ok: true } | { error: string }> {
  const pohyb = await prisma.bankTransaction.findUnique({ where: { id } });
  if (!pohyb) return { error: 'Pohyb nenalezen.' };

  if (akce === 'ignorovat') {
    await prisma.bankTransaction.update({
      where: { id },
      data: { stav: 'IGNOROVANA', invoiceId: null, navrhInvoiceId: null },
    });
    return { ok: true };
  }

  if (akce === 'odparovat') {
    if (pohyb.invoiceId) {
      // Faktura se vrací mezi neuhrazené - odznačení dělá totéž co tlačítko
      // „zrušit úhradu" v detailu faktury.
      await prisma.invoice.update({
        where: { id: pohyb.invoiceId },
        data: { status: 'SENT', paidAt: null, paidAmountMinor: null },
      });
    }
    await prisma.bankTransaction.update({ where: { id }, data: { stav: 'NOVA', invoiceId: null } });
    return { ok: true };
  }

  const cil = invoiceId || pohyb.navrhInvoiceId;
  if (!cil) return { error: 'Vyberte fakturu, ke které platba patří.' };

  const faktura = await prisma.invoice.findUnique({ where: { id: cil }, select: { id: true, status: true } });
  if (!faktura) return { error: 'Faktura nenalezena.' };
  if (faktura.status === 'CANCELLED') return { error: 'Stornovaná faktura se párovat nedá.' };

  await prisma.invoice.update({
    where: { id: cil },
    data: { status: 'PAID', paidAt: pohyb.bookedAt, paidAmountMinor: pohyb.amountMinor },
  });
  await prisma.bankTransaction.update({
    where: { id },
    data: { stav: 'RUCNE', invoiceId: cil, navrhInvoiceId: null },
  });
  return { ok: true };
}
