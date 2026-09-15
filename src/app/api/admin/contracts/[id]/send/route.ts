import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { sendContractEmail } from '@/lib/email';
import { documentHash, podepisZaNas, signatureContext } from '@/lib/contractsServer';

/**
 * Odeslani smlouvy k podpisu. Odkaz nese jednorazovy token - podepisujici se
 * nikam neprihlasuje a nikam nezadava zadny kod (zadani 8. 9. 2026).
 *
 * SMLOUVA ODCHAZI UZ PODEPSANA OD NAS (zadani 15. 9. 2026: „ve chvili, kdy
 * posilame smlouvu k podpisu, je z nasi strany uz za Karolinu podepsana").
 * Drive musel nekdo z Mediaspace kliknout na podpis zvlast - a kdyz na to
 * zapomnel, smlouva visela podepsana jen hercem. Ted se nas podpis pripoji
 * sam tesne pred odeslanim, takze podpisem druhe strany je smlouva hotova.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

    // Nas podpis se pripoji PRED odeslanim - mail pak rovnou rekne, ze od nas
    // uz smlouva podepsana je.
    const podepsalZaNas = await podepisZaNas(contract.id, signatureContext(req.headers));
    const nasePodpisy = podepsalZaNas || contract.signatures.some((s) => s.role === 'MEDIASPACE');

    const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const result = await sendContractEmail({
      to: contract.signerEmail,
      signerName: contract.signerName,
      issuerName: contract.issuer.name,
      number: contract.number,
      title: contract.title,
      projectName: contract.projectName,
      alreadySignedByUs: Boolean(nasePodpisy),
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

    return NextResponse.json({
      ok: true,
      podepsalZaNas,
      // Kdyz nikdo nema zaskrtnute „podepisuje smlouvy", at je to videt -
      // jinak by se tise posilaly smlouvy bez naseho podpisu.
      bezNasehoPodpisu: !nasePodpisy,
    });
  } catch (err) {
    console.error('POST /api/admin/contracts/[id]/send selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Odeslání se nezdařilo (${message}).` }, { status: 500 });
  }
}
