import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { sendInvoiceEmail } from '@/lib/email';
import { computeTotals } from '@/lib/doklady';

// Odeslani faktury odberateli (zadani 6. 9. 2026). Mail jde na e-mail vedeny
// u firmy a nese vsechno, co klient potrebuje k zaplaceni - castku, ucet,
// variabilni symbol a splatnost.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
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

    const to = invoice.company.contactEmail;
    if (!to) {
      return NextResponse.json(
        { error: `Firma „${invoice.company.name}" nemá vyplněný kontaktní e-mail — doplňte ho v Firmy.` },
        { status: 400 },
      );
    }
    if (!invoice.bankAccount) {
      return NextResponse.json(
        { error: 'Faktura nemá vybraný bankovní účet — bez něj klient neví, kam platit.' },
        { status: 400 },
      );
    }

    const totals = computeTotals(invoice.items);

    const result = await sendInvoiceEmail({
      to,
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
      accountNumber: invoice.bankAccount.accountNumber,
      iban: invoice.bankAccount.iban,
    });

    if (!result.sent) {
      return NextResponse.json({ error: 'E-mail se nepodařilo odeslat — není nastavené SMTP.' }, { status: 503 });
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: invoice.status === 'DRAFT' ? 'SENT' : invoice.status, sentAt: new Date() },
    });

    return NextResponse.json({ ok: true, to });
  } catch (err) {
    console.error('POST /api/admin/invoices/[id]/send selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Odeslání se nezdařilo (${message}).` }, { status: 500 });
  }
}
