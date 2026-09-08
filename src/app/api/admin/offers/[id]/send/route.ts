import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { sendOfferEmail } from '@/lib/email';
import { computeTotals } from '@/lib/doklady';

// Odeslani nabidky klientovi (zadani 6. 9. 2026). Mail jde na e-mail vedeny u
// firmy a nese odkaz se schvalovacim tokenem, aby klient nemusel byt prihlaseny.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
      include: { issuer: true, company: true, items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!offer) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });

    if (offer.items.length === 0) {
      return NextResponse.json({ error: 'Nabídka nemá žádné položky.' }, { status: 400 });
    }

    const to = offer.company.contactEmail;
    if (!to) {
      return NextResponse.json(
        { error: `Firma „${offer.company.name}" nemá vyplněný kontaktní e-mail — doplňte ho v Firmy.` },
        { status: 400 },
      );
    }

    const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const totals = computeTotals(offer.items);

    const result = await sendOfferEmail({
      to,
      contactName: offer.company.contactName,
      companyName: offer.company.name,
      issuerName: offer.issuer.name,
      number: offer.number,
      subject: offer.subject,
      currency: offer.currency,
      totalIncVat: totals.incVat,
      totalExVat: totals.exVat,
      validUntil: offer.validUntil,
      offerUrl: `${baseUrl}/nabidka/${offer.approvalToken}`,
    });

    if (!result.sent) {
      return NextResponse.json(
        { error: 'E-mail se nepodařilo odeslat — není nastavené SMTP.' },
        { status: 503 },
      );
    }

    await prisma.offer.update({
      where: { id: offer.id },
      // Odeslana nabidka uz ceka na klienta. Odmitnutou muze poslat znovu
      // (treba po uprave), schvalenou uz neprepisujeme.
      data: { status: offer.status === 'APPROVED' ? 'APPROVED' : 'SENT', sentAt: new Date() },
    });

    return NextResponse.json({ ok: true, to });
  } catch (err) {
    console.error('POST /api/admin/offers/[id]/send selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Odeslání se nezdařilo (${message}).` }, { status: 500 });
  }
}
