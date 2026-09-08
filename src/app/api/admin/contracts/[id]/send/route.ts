import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { sendContractEmail } from '@/lib/email';
import { documentHash } from '@/lib/contractsServer';

// Odeslani smlouvy k podpisu. Odkaz nese jednorazovy token - podepisujici se
// nikam neprihlasuje a nikam nezadava zadny kod (zadani 8. 9. 2026).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      include: { issuer: true, signatures: true },
    });
    if (!contract) return NextResponse.json({ error: 'Smlouva nenalezena.' }, { status: 404 });
    if (!contract.body.trim()) {
      return NextResponse.json({ error: 'Smlouva nemá žádný text.' }, { status: 400 });
    }
    if (contract.status === 'SIGNED') {
      return NextResponse.json({ error: 'Smlouva je už podepsaná.' }, { status: 409 });
    }
    if (contract.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Zrušenou smlouvu nelze poslat.' }, { status: 409 });
    }

    const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const result = await sendContractEmail({
      to: contract.signerEmail,
      signerName: contract.signerName,
      issuerName: contract.issuer.name,
      number: contract.number,
      title: contract.title,
      projectName: contract.projectName,
      alreadySignedByUs: contract.signatures.some((s) => s.role === 'MEDIASPACE'),
      contractUrl: `${baseUrl}/smlouva/${contract.accessToken}`,
    });

    if (!result.sent) {
      return NextResponse.json({ error: 'E-mail se nepodařilo odeslat — není nastavené SMTP.' }, { status: 503 });
    }

    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        // Otisk se zamkne v okamziku odeslani - od ted uz je jasne, co druha
        // strana dostala k podpisu.
        bodyHash: contract.bodyHash ?? documentHash(contract.body),
        rejectedAt: null,
        rejectedReason: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/contracts/[id]/send selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Odeslání se nezdařilo (${message}).` }, { status: 500 });
  }
}
