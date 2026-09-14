import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

// RUCNI SCHVALENI NABIDKY (zadani 14. 9. 2026: „potrebuji pridat moznost
// rucne schvalit nabidku").
//
// Klientske schvaleni pres odkaz s tokenem zustava jak bylo - tohle je pro
// pripady, kdy se nabidka odsouhlasi telefonem nebo mailem a do portalu to
// musi nekdo zapsat rucne. Proto se uklada JMENO toho, kdo na strane klienta
// souhlasil, stejne jako u schvaleni odkazem; doklad pak nelze rozlisit podle
// toho, kudy souhlas prisel, coz je zamer - vysledek je stejny.
//
// DELETE schvaleni vraci zpet. Rucne se da kliknout vedle a schvalena nabidka
// je zamcena proti uprave, takze bez teto cesty by se preklep nedal opravit.
export const dynamic = 'force-dynamic';

const schema = z.object({
  jmeno: z.string().trim().max(120).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });
    }

    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, items: { select: { id: true }, take: 1 } },
    });
    if (!offer) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
    if (offer.status === 'APPROVED') {
      return NextResponse.json({ error: 'Tahle nabídka už je schválená.' }, { status: 409 });
    }
    if (offer.items.length === 0) {
      return NextResponse.json({ error: 'Nabídka nemá žádné položky — není co schvalovat.' }, { status: 400 });
    }

    const updated = await prisma.offer.update({
      where: { id: offer.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedByName: parsed.data.jmeno || null,
        rejectedAt: null,
      },
      select: { status: true, approvedAt: true, approvedByName: true, rejectedAt: true },
    });

    return NextResponse.json({ ok: true, offer: updated });
  } catch (err) {
    console.error('POST /api/admin/offers/[id]/schvaleni selhalo:', err);
    return NextResponse.json({ error: 'Schválení se nepodařilo uložit.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, sentAt: true, invoice: { select: { id: true, number: true } } },
    });
    if (!offer) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
    if (offer.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Tahle nabídka schválená není.' }, { status: 409 });
    }
    // Kdyz uz z nabidky visi faktura, schvaleni je podklad k ni - zrusit ho
    // by znamenalo, ze fakturujeme neco, co nikdo neodsouhlasil.
    if (offer.invoice) {
      return NextResponse.json(
        { error: `Z nabídky už je vystavená faktura ${offer.invoice.number} — schválení nejde vzít zpět.` },
        { status: 409 },
      );
    }

    const updated = await prisma.offer.update({
      where: { id: offer.id },
      data: {
        status: offer.sentAt ? 'SENT' : 'DRAFT',
        approvedAt: null,
        approvedByName: null,
      },
      select: { status: true, approvedAt: true, approvedByName: true, rejectedAt: true },
    });

    return NextResponse.json({ ok: true, offer: updated });
  } catch (err) {
    console.error('DELETE /api/admin/offers/[id]/schvaleni selhalo:', err);
    return NextResponse.json({ error: 'Schválení se nepodařilo zrušit.' }, { status: 500 });
  }
}
