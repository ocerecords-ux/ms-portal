import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

// Schvaleni nebo odmitnuti nabidky klientem (zadani 6. 9. 2026).
//
// Zamerne BEZ prihlaseni - klient prijde z e-mailu odkazem s jednorazovym
// tokenem. Token je jedina vec, ktera sem pousti: nabidka se hleda vyhradne
// podle nej, zadne ID z pozadavku se nepouziva.
export const dynamic = 'force-dynamic';

const schema = z.object({
  action: z.enum(['approve', 'reject']),
  name: z.string().trim().max(120).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });
    }

    const offer = await prisma.offer.findUnique({
      where: { approvalToken: params.token },
      select: { id: true, status: true },
    });
    if (!offer) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });

    if (offer.status === 'APPROVED') {
      return NextResponse.json({ error: 'Tahle nabídka už je schválená.' }, { status: 409 });
    }

    const now = new Date();
    if (parsed.data.action === 'approve') {
      await prisma.offer.update({
        where: { id: offer.id },
        data: { status: 'APPROVED', approvedAt: now, approvedByName: parsed.data.name || null, rejectedAt: null },
      });
    } else {
      await prisma.offer.update({
        where: { id: offer.id },
        data: { status: 'REJECTED', rejectedAt: now, approvedAt: null, approvedByName: parsed.data.name || null },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/nabidka/[token] selhalo:', err);
    return NextResponse.json({ error: 'Akci se nepodařilo uložit.' }, { status: 500 });
  }
}
