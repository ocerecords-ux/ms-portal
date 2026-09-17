import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { sendOfferEmail } from '@/lib/email';
import { computeTotals } from '@/lib/doklady';
import { najdiPrijemceNabidky } from '@/lib/prijemceNabidky';

// Odeslani nabidky klientovi (zadani 6. 9. 2026). Mail nese odkaz se
// schvalovacim tokenem, aby klient nemusel byt prihlaseny.
//
// KOMU: klientovi vedenemu u projektu, a teprve kdyz projekt klienta nema,
// na kontakt firmy (zadani 17. 9. 2026) - viz lib/prijemceNabidky.ts.
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

    const prijemce = await najdiPrijemceNabidky({
      caflouProjectId: offer.caflouProjectId,
      company: offer.company,
    });
    if (!prijemce) {
      return NextResponse.json(
        {
          error: offer.caflouProjectId
            ? `Nabídku není komu poslat — projekt nemá vyplněného klienta s e-mailem a firma „${offer.company.name}" nemá kontaktní e-mail.`
            : `Nabídku není komu poslat — není navázaná na projekt a firma „${offer.company.name}" nemá kontaktní e-mail.`,
        },
        { status: 400 },
      );
    }
    const to = prijemce.email;

    const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const totals = computeTotals(offer.items, offer);

    // Mail posila MANAZER PROJEKTU (zadani 13. 9. 2026). Kdyz nabidka na
    // projekt navazana neni (nebo projekt manazera nema), podepise se ten,
    // kdo nabidku odesila - jeho odpoved klient stejne ceka.
    // KDO JE POD NABIDKOU PODEPSANY (zadani 13. 9. 2026: „melo by se to menit
    // podle toho, kdo je manazer projektu a kdo je prihlaseny"). Prednost ma
    // manazer projektu; kdyz projekt manazera nema (nebo nabidka na projekt
    // navazana neni), podepise se ten, kdo ji prave posila. Ulozi se k nabidce,
    // aby se jmeno v "Od", podpis v mailu a jmeno na strance nerozesly.
    const meta = offer.caflouProjectId
      ? await prisma.projectMeta.findUnique({
          where: { caflouProjectId: offer.caflouProjectId },
          select: { managerUserId: true },
        })
      : null;
    const odeslalUserId = meta?.managerUserId || session.user.id;
    const odesilatel = await prisma.user.findUnique({
      where: { id: odeslalUserId },
      select: { name: true, email: true, phone: true, maFotku: true },
    });

    const senderName = odesilatel?.name || session.user.name || null;
    const senderEmail = odesilatel?.email || session.user.email || null;
    const senderPhone = odesilatel?.phone || null;
    // Fotka se v mailu stahuje odkazem proti tokenu nabidky - viz
    // /api/nabidka/[token]/fotka. Bez fotky se v podpisu ukaze jen jmeno.
    const senderPhotoUrl = odesilatel?.maFotku
      ? `${baseUrl}/api/nabidka/${offer.approvalToken}/fotka`
      : null;

    const result = await sendOfferEmail({
      to,
      // Osloveni podle toho, komu to opravdu jde - u klienta projektu jeho
      // jmeno, u firmy jeji kontaktni osoba.
      contactName: prijemce.jmeno,
      companyName: offer.company.name,
      issuerName: offer.issuer.name,
      number: offer.number,
      subject: offer.subject,
      currency: offer.currency,
      totalIncVat: totals.incVat,
      totalExVat: totals.exVat,
      validUntil: offer.validUntil,
      offerUrl: `${baseUrl}/nabidka/${offer.approvalToken}`,
      projectName: offer.projectName,
      senderName,
      senderEmail,
      senderPhone,
      senderPhotoUrl,
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
      data: {
        status: offer.status === 'APPROVED' ? 'APPROVED' : 'SENT',
        sentAt: new Date(),
        odeslalUserId,
      },
    });

    return NextResponse.json({ ok: true, to });
  } catch (err) {
    console.error('POST /api/admin/offers/[id]/send selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Odeslání se nezdařilo (${message}).` }, { status: 500 });
  }
}
