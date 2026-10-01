import { prisma } from '@/lib/db';
import { nahledDokladu, pdfFaktury } from '@/lib/dokladNahledServer';
import { renderObjednavkaPdf } from '@/lib/dokladPdf';
import { cisloObjednavky } from '@/lib/dokladyKlientaServer';
import { popisObjednavky } from '@/lib/objednavkaKlientaServer';

/**
 * PDF dokladu, který si klient otevře z přehledu projektů (zadání 1. 10. 2026).
 *
 * Faktura a nabídka se kreslí TÝMŽ kódem jako u nás v administraci - klient
 * musí dostat přesně to, co jsme vystavili, ne vlastní „klientskou" variantu,
 * která by se časem rozešla. Objednávka vlastní PDF neměla, viz
 * renderObjednavkaPdf.
 *
 * KAŽDÉ ČTENÍ SE PTÁ NA FIRMU. Ověření práv nesmí zůstat jen v routě: tahle
 * funkce se jednou zavolá i odjinud a pak by se na něj zapomnělo.
 */
export type VysledekPdf =
  | { ok: true; pdf: Buffer; nazev: string }
  | { ok: false; message: string; stav: number };

export async function pdfDokladuKlienta(
  druh: 'nabidka' | 'faktura' | 'objednavka',
  id: string,
  companyId: string,
  nazevFirmy: string,
): Promise<VysledekPdf> {
  if (druh === 'faktura') {
    const faktura = await prisma.invoice.findFirst({
      where: { id, companyId, status: { in: ['SENT', 'PAID'] } },
      select: { id: true },
    });
    if (!faktura) return { ok: false, message: 'Faktura nenalezena.', stav: 404 };
    const vysledek = await pdfFaktury(faktura.id);
    return vysledek.ok ? vysledek : { ok: false, message: vysledek.message, stav: 409 };
  }

  if (druh === 'nabidka') {
    const n = await prisma.offer.findFirst({
      where: { id, companyId, status: { in: ['SENT', 'APPROVED', 'REJECTED'] } },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!n) return { ok: false, message: 'Nabídka nenalezena.', stav: 404 };
    const naDen = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
    const vysledek = await nahledDokladu({
      druh: 'NABIDKA',
      id: n.id,
      issuerCompanyId: n.issuerCompanyId,
      companyId: n.companyId,
      currency: n.currency,
      issueDate: naDen(n.issueDate),
      validUntil: naDen(n.validUntil),
      subject: n.subject,
      note: n.note,
      projectName: n.projectName,
      // Nabídka režim DPH nedrží (na rozdíl od faktury) - bere se výchozí.
      jazyk: n.jazyk === 'EN' ? 'en' : 'cs',
      slevaProcent: n.slevaProcent,
      slevaMinor: n.slevaMinor,
      slevaPopis: n.slevaPopis,
      items: n.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unit: i.unit,
        unitPriceMinor: i.unitPriceMinor,
        vatRate: i.vatRate,
      })),
    });
    if (!vysledek.ok) return { ok: false, message: vysledek.message, stav: 409 };
    return {
      ok: true,
      pdf: vysledek.pdf,
      nazev: `Nabidka-${n.number.replace(/[^\w.-]+/g, '-')}.pdf`,
    };
  }

  const o = await prisma.order.findFirst({
    where: { id, companyId },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  if (!o) return { ok: false, message: 'Objednávka nenalezena.', stav: 404 };

  const obsah = popisObjednavky({
    kind: String(o.kind),
    title: o.title,
    pageCount: o.pageCount,
    deadline: o.deadline,
    note: o.note,
    preferredNarrator: o.preferredNarrator,
    sluzby: o.sluzby,
    vystupy: o.vystupy,
    attachmentName: o.attachmentName,
    autorKnihy: o.autorKnihy,
    prekladatelKnihy: o.prekladatelKnihy,
    nakladatelstviKnihy: o.nakladatelstviKnihy,
    uvodKnihy: o.uvodKnihy,
    zaverKnihy: o.zaverKnihy,
  });

  const cislo = cisloObjednavky(o.id);
  return {
    ok: true,
    pdf: renderObjednavkaPdf({
      cislo,
      firma: nazevFirmy || '—',
      objednal: o.createdBy?.name || o.createdBy?.email || null,
      datum: o.createdAt,
      nazev: o.title,
      // Název je v hlavičce bloku zvlášť, v seznamu by se opakoval.
      radky: obsah.radky.filter((r) => r.popis !== 'Název'),
      bloky: obsah.bloky,
      jazyk: 'cs',
    }),
    nazev: `Objednavka-${cislo}.pdf`,
  };
}
