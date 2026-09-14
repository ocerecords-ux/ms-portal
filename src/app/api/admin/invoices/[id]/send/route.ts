import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { sendInvoiceEmail } from '@/lib/email';
import { cisloUctuSKodem, computeTotals } from '@/lib/doklady';
import { pdfFaktury } from '@/lib/dokladNahledServer';

/**
 * Odeslani faktury odberateli (zadani 6. 9. 2026). Mail nese vsechno, co klient
 * potrebuje k zaplaceni - castku, ucet, variabilni symbol, splatnost a PDF
 * s QR platbou.
 *
 * KOMU (zadani 13. 9. 2026): faktura jde na e-mail vedeny u FIRMY - tam byva
 * ucetni odberatele. Jestli ji ma dostat i KLIENT PROJEKTU (clovek, ktery ma
 * u nich ten projekt na starost), se nastavuje u FIRMY zaskrtavatkem - ne pri
 * kazdem odeslani. U kazde faktury se pak vezme klient z projektu, ke kteremu
 * je navazana, takze vyjde vzdycky ten spravny.
 *
 * Jina adresa nez tyhle dve se dosadit neda; posilat faktury kamkoliv neni
 * potreba a je to zbytecna dira.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        issuer: true,
        company: true,
        bankAccount: true,
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Faktura nenalezena.' }, { status: 404 });
    if (invoice.items.length === 0) {
      return NextResponse.json({ error: 'Faktura nemá žádné položky.' }, { status: 400 });
    }

    const volba = (await req.json().catch(() => null)) as
      | { firme?: unknown; klientovi?: unknown }
      | null;
    const chceFirmu = volba?.firme === undefined ? true : volba.firme === true;
    // Vychozi je nastaveni firmy; telo pozadavku ho muze prebit (jednorazove
    // odeslani jen nekomu), ale bezne se nic neposila a plati karta firmy.
    const chceKlienta =
      volba?.klientovi === undefined ? invoice.company.fakturyKlientovi : volba.klientovi === true;

    const mailFirmy = invoice.company.contactEmail?.trim() || null;
    const meta = invoice.caflouProjectId
      ? await prisma.projectMeta.findUnique({
          where: { caflouProjectId: invoice.caflouProjectId },
          select: { klient: { select: { email: true } } },
        })
      : null;
    const mailKlienta = meta?.klient?.email?.trim() || null;

    const prijemci = [chceFirmu ? mailFirmy : null, chceKlienta ? mailKlienta : null].filter(
      (m): m is string => Boolean(m),
    );
    // Duplicita nastane, kdyz je klient projektu zaroven kontaktem firmy.
    const [to, ...kopie] = [...new Set(prijemci)];
    if (!to) {
      return NextResponse.json(
        {
          error: chceKlienta && !chceFirmu
            ? 'Projekt nemá přiřazeného klienta — komu fakturu poslat?'
            : `Firma „${invoice.company.name}" nemá vyplněný kontaktní e-mail — doplňte ho v Firmy.`,
        },
        { status: 400 },
      );
    }
    if (!invoice.bankAccount) {
      return NextResponse.json(
        { error: 'Faktura nemá vybraný bankovní účet — bez něj klient neví, kam platit.' },
        { status: 400 },
      );
    }

    const totals = computeTotals(invoice.items, invoice);

    // Faktura jde klientovi i jako PDF - je na nem QR platba (zadani 13. 9.
    // 2026). Kdyz se PDF nepodari vykreslit, mail odejde bez nej: text v nem
    // ma vsechno potrebne k zaplaceni a je lepsi fakturu poslat nez neposlat.
    const dokument = await pdfFaktury(invoice.id).catch((err) => {
      console.error('PDF faktury se nepodarilo vyrobit:', err);
      return { ok: false as const, message: 'PDF se nepodařilo vyrobit.' };
    });
    if (!dokument.ok) console.error('PDF faktury se nepridava:', dokument.message);

    const result = await sendInvoiceEmail({
      to,
      cc: kopie,
      contactName: invoice.company.contactName,
      companyName: invoice.company.name,
      issuerName: invoice.issuer.name,
      number: invoice.number,
      subject: invoice.subject,
      currency: invoice.currency,
      totalExVat: totals.exVat,
      totalIncVat: totals.incVat,
      dueDate: invoice.dueDate,
      variableSymbol: invoice.variableSymbol,
      accountLabel: invoice.bankAccount.label,
      accountNumber: cisloUctuSKodem(invoice.bankAccount.accountNumber, invoice.bankAccount.bankName),
      iban: invoice.bankAccount.iban,
      pdf: dokument.ok ? { nazev: dokument.nazev, obsah: dokument.pdf } : null,
    });

    if (!result.sent) {
      return NextResponse.json({ error: 'E-mail se nepodařilo odeslat — není nastavené SMTP.' }, { status: 503 });
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: invoice.status === 'DRAFT' ? 'SENT' : invoice.status, sentAt: new Date() },
    });

    return NextResponse.json({ ok: true, to, kopie, sPrilohou: dokument.ok });
  } catch (err) {
    console.error('POST /api/admin/invoices/[id]/send selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Odeslání se nezdařilo (${message}).` }, { status: 500 });
  }
}
