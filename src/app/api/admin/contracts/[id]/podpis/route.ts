import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { documentHash, signatureContext, validSignatureImage } from '@/lib/contractsServer';

// Podpis za Mediaspace. Podepisuje prihlaseny clovek, takze jmeno bereme ze
// session - nedava smysl ho psat rucne.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const telo = await req.json().catch(() => ({}));
    if (!validSignatureImage(telo?.imageData)) {
      return NextResponse.json({ error: 'Chybí podpis — podepište se do rámečku.' }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      include: { signatures: true },
    });
    if (!contract) return NextResponse.json({ error: 'Smlouva nenalezena.' }, { status: 404 });
    if (contract.status === 'CANCELLED' || contract.status === 'REJECTED') {
      return NextResponse.json({ error: 'Tuhle smlouvu už nejde podepsat.' }, { status: 409 });
    }
    if (!contract.body.trim()) {
      return NextResponse.json({ error: 'Smlouva nemá žádný text.' }, { status: 400 });
    }
    if (contract.signatures.some((s) => s.role === 'MEDIASPACE')) {
      return NextResponse.json({ error: 'Za Mediaspace je smlouva už podepsaná.' }, { status: 409 });
    }

    const hash = documentHash(contract.body);
    const ctx = signatureContext(req.headers);

    await prisma.$transaction(async (tx) => {
      await tx.contractSignature.create({
        data: {
          contractId: contract.id,
          role: 'MEDIASPACE',
          name: session.user.name || session.user.email,
          email: session.user.email,
          imageData: telo.imageData,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          documentHash: hash,
        },
      });
      const hotovo = contract.signatures.some((s) => s.role === 'PROTISTRANA');
      await tx.contract.update({
        where: { id: contract.id },
        data: {
          bodyHash: contract.bodyHash ?? hash,
          ...(hotovo ? { status: 'SIGNED', completedAt: new Date() } : {}),
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/contracts/[id]/podpis selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Podpis se nepodařilo uložit (${message}).` }, { status: 500 });
  }
}
