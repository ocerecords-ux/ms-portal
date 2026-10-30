import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { sendOfferEmail } from '@/lib/email';
import { computeTotals } from '@/lib/doklady';
import { najdiPrijemceNabidky } from '@/lib/prijemceNabidky';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';

// Odeslani nabidky klientovi (zadani 6. 9. 2026). Mail nese odkaz se
// schvalovacim tokenem, aby klient nemusel byt prihlaseny.
//
// KOMU: na adresy, ktere ma firma vyplnene zvlast na nabidky (12. 10. 2026);
// kdyz zadne nema, klientovi vedenemu u projektu, a teprve pak na kontakt
// firmy (zadani 17. 9. 2026) - viz lib/prijemceNabidky.ts.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
      include: { issuer: true, company: true, items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!offer) return odpovedChyby('chybaApi.nabidkaNenalezena', 404);

    if (offer.items.length === 0) {
      return odpovedChyby('chybaApi.nabidkaBezPolozek', 400);
    }

    const prijemce = await najdiPrijemceNabidky({
      caflouProjectId: offer.caflouProjectId,
      company: offer.company,
    });
    if (!prijemce) {
      // Nazev firmy je obsah z databaze, takze jde vedle klice jako hodnota.
      return odpovedChybyS(
        offer.caflouProjectId
          ? 'chybaApi.nabidkuNeniKomuPoslatProjektS'
          : 'chybaApi.nabidkuNeniKomuPoslatBezProjektuS',
        { firma: offer.company.name },
        400,
      );
    }
    // Adres může být víc, když je firma má vyplněné zvlášť na nabídky (12. 10. 2026).
    const to = prijemce.emaily.join(', ');

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
      return odpovedChyby('chybaApi.emailBezSmtp', 503);
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
    return odpovedChybyS('chybaApi.odeslaniNezdariloS', { zprava: message }, 500);
  }
}
