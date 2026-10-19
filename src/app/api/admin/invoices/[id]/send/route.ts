import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { odesliFakturu } from '@/lib/fakturaOdeslaniServer';

/**
 * Odeslani faktury odberateli (zadani 6. 9. 2026).
 *
 * Tohle je UŽ JEN OBÁLKA: oprávnění, rozbalení volby z těla požadavku a
 * převod výsledku na HTTP kódy. Komu faktura jde, co se k ní přiloží
 * (PDF s QR platbou, rodný list u spotů) a jak se zapíše odeslání, řeší
 * lib/fakturaOdeslaniServer.ts - protože totéž potřebuje i automatika
 * u reklam (19. 10. 2026) a opsaná druhá verze posílání ostrých faktur
 * klientům je to poslední, co chceme mít v portálu dvakrát.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const volba = (await req.json().catch(() => null)) as
      | { firme?: unknown; klientovi?: unknown }
      | null;

    const vysledek = await odesliFakturu({
      invoiceId: params.id,
      odeslal: { id: session.user.id, jmeno: session.user.name || session.user.email || null },
      firme: volba?.firme === undefined ? undefined : volba.firme === true,
      klientovi: volba?.klientovi === undefined ? undefined : volba.klientovi === true,
    });

    if (!vysledek.ok) {
      return NextResponse.json({ error: vysledek.error }, { status: vysledek.status });
    }

    return NextResponse.json({
      ok: true,
      to: vysledek.to,
      kopie: vysledek.kopie,
      sPrilohou: vysledek.sPrilohou,
      sRodnymListem: vysledek.sRodnymListem,
      // Zůstává kvůli starším voláním; projekt se po faktuře sám neukončuje.
      projektUkoncen: false,
      nabidnoutUkonceni: vysledek.nabidnoutUkonceni,
      caflouProjectId: vysledek.caflouProjectId,
      projectName: vysledek.projectName,
    });
  } catch (err) {
    console.error('POST /api/admin/invoices/[id]/send selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Odeslání se nezdařilo (${message}).` }, { status: 500 });
  }
}
