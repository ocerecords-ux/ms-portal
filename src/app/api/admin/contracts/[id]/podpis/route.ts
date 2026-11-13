import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import {
  documentHash,
  posliPodepsanouSmlouvu,
  signatureContext,
  validSignatureImage,
} from '@/lib/contractsServer';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';

// Podpis za Mediaspace. Podepisuje prihlaseny clovek, takze jmeno bereme ze
// session - nedava smysl ho psat rucne.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

    const telo = await req.json().catch(() => ({}));
    if (!validSignatureImage(telo?.imageData)) {
      return odpovedChyby('chybaApi.chybiPodpis', 400);
    }

    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      include: { signatures: true },
    });
    if (!contract) return odpovedChyby('chybaApi.smlouvaNenalezena', 404);
    if (contract.status === 'CANCELLED' || contract.status === 'REJECTED') {
      return odpovedChyby('chybaApi.smlouvuNejdePodepsat', 409);
    }
    if (!contract.body.trim()) {
      return odpovedChyby('chybaApi.smlouvaBezTextu', 400);
    }
    if (contract.signatures.some((s) => s.role === 'MEDIASPACE')) {
      return odpovedChyby('chybaApi.smlouvaPodepsanaZaNas', 409);
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

    // Podepsano obema stranami -> mail s odkazem i PDF (zadani 14. 9. 2026).
    if (contract.signatures.some((s) => s.role === 'PROTISTRANA')) {
      await posliPodepsanouSmlouvu(contract.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/contracts/[id]/podpis selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return odpovedChybyS('chybaApi.podpisNeulozenS', { zprava: message }, 500);
  }
}
