import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';

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
      select: {
        id: true,
        status: true,
        number: true,
        subject: true,
        caflouProjectId: true,
        projectName: true,
        // Kdo nabidku poslal - zaloha, kdyz projekt manazera nema.
        odeslalUserId: true,
        company: { select: { name: true } },
      },
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

    void zvonekManazerovi({
      id: offer.id,
      cislo: offer.number,
      nazev: offer.projectName || offer.subject || offer.number,
      caflouProjectId: offer.caflouProjectId,
      odeslalUserId: offer.odeslalUserId,
      firma: offer.company?.name ?? null,
      schvaleno: parsed.data.action === 'approve',
      kdo: parsed.data.name || null,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/nabidka/[token] selhalo:', err);
    return NextResponse.json({ error: 'Akci se nepodařilo uložit.' }, { status: 500 });
  }
}

/**
 * ZVONEČEK MANAŽEROVI PROJEKTU (zadání 17. 9. 2026: „když někdo schválí
 * nabídku, mělo by mi to vyskočit na zvonečku na liště. Ale tomu, kdo je
 * manažer daného projektu, na který je nabídka navázaná").
 *
 * Schválená nabídka je pokyn k práci a odmítnutá je důvod zavolat klientovi -
 * do teď se obojí dalo poznat jen tím, že si někdo otevřel Doklady.
 *
 * KOMU: manažerovi projektu, na který je nabídka navázaná. Když nabídka
 * projekt nemá (nebo projekt nemá manažera), dostane to ten, kdo ji odeslal -
 * jinak by se o tom nedozvěděl nikdo. Nikdy se to neposílá dvakrát témuž
 * člověku, protože je to jen jeden příjemce.
 *
 * Nikdy nevyhazuje: zvoneček nesmí shodit schválení nabídky, na které klient
 * právě klepl.
 */
async function zvonekManazerovi(n: {
  id: string;
  cislo: string;
  /** Čím je nabídka v seznamu poznat - název projektu, jinak předmět. */
  nazev: string;
  caflouProjectId: string | null;
  odeslalUserId: string | null;
  firma: string | null;
  schvaleno: boolean;
  kdo: string | null;
}): Promise<void> {
  try {
    const meta = n.caflouProjectId
      ? await prisma.projectMeta.findUnique({
          where: { caflouProjectId: n.caflouProjectId },
          select: { managerUserId: true },
        })
      : null;
    const prijemce = meta?.managerUserId || n.odeslalUserId;
    if (!prijemce) return;

    await notify({
      userId: prijemce,
      kind: n.schvaleno ? 'nabidka-schvalena' : 'nabidka-odmitnuta',
      title: `${n.schvaleno ? 'Schválená' : 'Odmítnutá'} nabídka: ${n.nazev}`,
      body: [
        n.firma,
        n.kdo ? `${n.schvaleno ? 'schválil(a)' : 'odmítl(a)'} ${n.kdo}` : null,
        n.cislo,
      ]
        .filter(Boolean)
        .join(' · '),
      url: `/admin/doklady/nabidky/${n.id}`,
    });
  } catch (err) {
    console.error('Zvonecek o schvaleni nabidky selhal:', err);
  }
}
