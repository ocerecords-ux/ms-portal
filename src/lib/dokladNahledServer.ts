import { prisma } from '@/lib/db';
import { cisloUctuSKodem, expandNumberFormat } from '@/lib/doklady';
import { renderDokladPdf, type DokladData, type PolozkaDokladu, type RezimDph } from '@/lib/dokladPdf';
import { ibanZTuzemskehoUctu } from '@/lib/pdf/qrPlatba';

/**
 * Náhled faktury nebo nabídky z ROZEPSANÝCH hodnot (zadání 10. 9. 2026:
 * „když dám založit novou fakturu, bude to vypadat stejně jako v záložce
 * Rodného listu — vlevo tabulka na vyplnění, napravo rovnou náhled PDF").
 *
 * Nic se neukládá. Doklad, který ještě nemá číslo, dostane do náhledu příští
 * číslo z řady - aby bylo vidět, jak bude vypadat, ne prázdné místo.
 */

export type RozepsanyDoklad = {
  druh: 'FAKTURA' | 'NABIDKA';
  /** ID dokladu, když už existuje - jen kvůli číslu a vydavateli. */
  id?: string | null;
  issuerCompanyId?: string | null;
  companyId?: string | null;
  bankAccountId?: string | null;
  currency?: string | null;
  issueDate?: string | null;
  taxDate?: string | null;
  dueDate?: string | null;
  validUntil?: string | null;
  subject?: string | null;
  note?: string | null;
  variableSymbol?: string | null;
  projectName?: string | null;
  rezimDph?: RezimDph | null;
  jazyk?: 'cs' | 'en' | null;
  /** Sleva na dokladu (zadání 14. 9. 2026) - v náhledu musí být vidět taky. */
  slevaProcent?: number | null;
  slevaMinor?: number | null;
  slevaPopis?: string | null;
  items?: {
    description?: string | null;
    quantity?: number | null;
    unit?: string | null;
    unitPriceMinor?: number | null;
    vatRate?: number | null;
  }[];
};

function den(hodnota: string | null | undefined): Date | null {
  if (!hodnota) return null;
  const d = new Date(`${hodnota}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Vydavatel dokladu: podle zadaného ID, jinak výchozí firma. */
async function najdiVydavatele(id: string | null | undefined) {
  if (id) {
    const podleId = await prisma.issuerCompany.findUnique({ where: { id } });
    if (podleId) return podleId;
  }
  return prisma.issuerCompany.findFirst({
    where: { active: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function nahledDokladu(
  rozepsane: RozepsanyDoklad,
): Promise<{ ok: true; pdf: Buffer } | { ok: false; message: string }> {
  const vydavatel = await najdiVydavatele(rozepsane.issuerCompanyId);
  if (!vydavatel) {
    return { ok: false, message: 'Není nastavená žádná fakturační firma (Doklady → Moje firmy).' };
  }

  const odberatel = rozepsane.companyId
    ? await prisma.company.findUnique({ where: { id: rozepsane.companyId } })
    : null;

  const ucet = rozepsane.bankAccountId
    ? await prisma.bankAccount.findUnique({ where: { id: rozepsane.bankAccountId } })
    : null;

  // Číslo: u uloženého dokladu jeho vlastní, u nového příští z řady. Řada se
  // tím NEPOSOUVÁ - číslo se přiděluje až při uložení.
  let cislo = '';
  if (rozepsane.id) {
    const ulozeny =
      rozepsane.druh === 'FAKTURA'
        ? await prisma.invoice.findUnique({ where: { id: rozepsane.id }, select: { number: true } })
        : await prisma.offer.findUnique({ where: { id: rozepsane.id }, select: { number: true } });
    cislo = ulozeny?.number ?? '';
  }
  if (!cislo) {
    cislo =
      rozepsane.druh === 'FAKTURA'
        ? expandNumberFormat(vydavatel.invoiceNumberFormat, vydavatel.invoiceNextNumber)
        : expandNumberFormat(vydavatel.offerNumberFormat, vydavatel.offerNextNumber);
  }

  const polozky: PolozkaDokladu[] = (rozepsane.items ?? [])
    .filter((i) => (i.description ?? '').trim() || (i.unitPriceMinor ?? 0) !== 0)
    .map((i) => ({
      description: (i.description ?? '').trim() || '—',
      quantity: Number(i.quantity) || 0,
      unit: i.unit || null,
      unitPriceMinor: Math.round(Number(i.unitPriceMinor) || 0),
      vatRate: Number.isFinite(Number(i.vatRate)) ? Number(i.vatRate) : 21,
    }));

  const data: DokladData = {
    druh: rozepsane.druh,
    cislo,
    variabilniSymbol: rozepsane.variableSymbol || cislo.replace(/\D/g, '') || null,
    dodavatel: {
      name: vydavatel.name,
      ic: vydavatel.ic,
      dic: vydavatel.dic,
      street: vydavatel.addressStreet,
      city: vydavatel.addressCity,
      zip: vydavatel.addressZip,
      country: vydavatel.addressCountry,
      email: vydavatel.email,
      phone: vydavatel.phone,
    },
    dodavatelPlatceDph: vydavatel.vatPayer,
    odberatel: {
      name: odberatel?.name ?? '—',
      ic: odberatel?.ic ?? null,
      dic: odberatel?.dic ?? null,
      street: odberatel?.addressStreet ?? null,
      city: odberatel?.addressCity ?? null,
      zip: odberatel?.addressZip ?? null,
      country: odberatel?.addressCountry ?? null,
    },
    polozky,
    mena: rozepsane.currency || 'CZK',
    datumVystaveni: den(rozepsane.issueDate) ?? new Date(),
    datumPlneni: den(rozepsane.taxDate),
    datumSplatnosti: den(rozepsane.dueDate),
    platnostDo: den(rozepsane.validUntil),
    predmet: rozepsane.subject || null,
    poznamka: rozepsane.note || null,
    projekt: rozepsane.projectName || null,
    platba:
      rozepsane.druh === 'FAKTURA' && ucet
        ? {
            ucet: cisloUctuSKodem(ucet.accountNumber, ucet.bankName),
            // IBAN se dopočítá z tuzemského tvaru účtu, když u účtu vyplněný
            // není (zadání 13. 9. 2026: „potřebuju na faktury dostat QR kód,
            // myslím, že ho tam nedostaneme bez IBANU"). QR platba IBAN
            // vyžaduje, ale číslo účtu ho jednoznačně určuje - není důvod ho
            // po nikom chtít znovu. Když tvar účtu nesedí, zůstane null
            // a QR se prostě nevykreslí.
            iban: ucet.iban?.trim() || ibanZTuzemskehoUctu(ucet.accountNumber ?? '', ucet.bankName),
            swift: ucet.swift,
            banka: ucet.bankName,
          }
        : null,
    rezimDph: rozepsane.rezimDph ?? 'STANDARD',
    jazyk: rozepsane.jazyk === 'en' ? 'en' : 'cs',
    sleva: {
      slevaProcent: rozepsane.slevaProcent ?? 0,
      slevaMinor: rozepsane.slevaMinor ?? 0,
      slevaPopis: rozepsane.slevaPopis ?? null,
    },
  };

  return { ok: true, pdf: renderDokladPdf(data) };
}

/** Datum pro náhled - ten si ho převede zpátky na den v Praze. */
function naDen(hodnota: Date | null): string | null {
  return hodnota ? hodnota.toISOString().slice(0, 10) : null;
}

/**
 * PDF už uložené faktury - k odeslání klientovi (zadání 13. 9. 2026).
 *
 * Kreslí ho tentýž kód jako náhled v editoru, takže klient dostane přesně to,
 * co bylo vidět při vystavování - včetně QR platby.
 */
export async function pdfFaktury(
  invoiceId: string,
): Promise<{ ok: true; pdf: Buffer; nazev: string } | { ok: false; message: string }> {
  const faktura = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!faktura) return { ok: false, message: 'Faktura nenalezena.' };

  const vysledek = await nahledDokladu({
    druh: 'FAKTURA',
    id: faktura.id,
    issuerCompanyId: faktura.issuerCompanyId,
    companyId: faktura.companyId,
    bankAccountId: faktura.bankAccountId,
    currency: faktura.currency,
    issueDate: naDen(faktura.issueDate),
    taxDate: naDen(faktura.taxDate),
    dueDate: naDen(faktura.dueDate),
    subject: faktura.subject,
    note: faktura.note,
    variableSymbol: faktura.variableSymbol,
    projectName: faktura.projectName,
    rezimDph: faktura.rezimDph,
    jazyk: faktura.jazyk === 'EN' ? 'en' : 'cs',
    // Sleva jde do RozepsanyDoklad po jednotlivych polich - do DokladData se
    // slozi az v nahledDokladu.
    slevaProcent: faktura.slevaProcent,
    slevaMinor: faktura.slevaMinor,
    slevaPopis: faktura.slevaPopis,
    items: faktura.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      unitPriceMinor: i.unitPriceMinor,
      vatRate: i.vatRate,
    })),
  });

  if (!vysledek.ok) return vysledek;
  // Nazev souboru bez lomitek - cislo faktury je muze obsahovat.
  return { ok: true, pdf: vysledek.pdf, nazev: `Faktura-${faktura.number.replace(/[^\w.-]+/g, '-')}.pdf` };
}
