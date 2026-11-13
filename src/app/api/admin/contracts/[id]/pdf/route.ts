import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { documentHash } from '@/lib/contractsServer';
import { nazevSouboruSmlouvy, smlouvaPdf } from '@/lib/smlouvaPdf';
import { odpovedChybyVJazyce } from '@/lib/chybyApi';
import { nactiJazyk } from '@/lib/jazykServer';

/**
 * Smlouva ke stažení jako PDF (zadání 14. 9. 2026: „u podepsaných smluv oboji.
 * Odkaz i pdf").
 *
 * Stejný dokument, jaký chodí v příloze mailu po podpisu obou stran. Jde
 * stáhnout i dřív - nepodepsaná místa jsou v něm prostě prázdná, což se hodí
 * pro kontrolu sazby ještě před odesláním.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const jazyk = nactiJazyk();
  const session = await requireAdmin();
  if (!session) return odpovedChybyVJazyce(jazyk, 'chybaApi.bezOpravneni', 403);

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: { issuer: { select: { name: true } }, signatures: { orderBy: { signedAt: 'asc' } } },
  });
  if (!contract) return odpovedChybyVJazyce(jazyk, 'chybaApi.smlouvaNenalezena', 404);

  const pdf = smlouvaPdf({
    number: contract.number,
    title: contract.title,
    body: contract.body,
    currentHash: documentHash(contract.body),
    issuerName: contract.issuer?.name ?? null,
    podpisy: contract.signatures.map((s) => ({
      role: s.role,
      name: s.name,
      email: s.email,
      signedAt: s.signedAt,
      ip: s.ip,
      documentHash: s.documentHash,
      imageData: s.imageData,
    })),
  });

  // Uint8Array, ne Buffer - NextResponse ho jinak neprijme (stejne jako
  // u ostatnich PDF rout).
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nazevSouboruSmlouvy(contract.number)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
