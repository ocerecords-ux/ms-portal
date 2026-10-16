import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { documentHash } from '@/lib/contractsServer';
import { nazevSouboruSmlouvy, smlouvaPdf } from '@/lib/smlouvaPdf';

/**
 * SMLOUVA JAKO PDF PRO PROTISTRANU (zadání 16. 10. 2026: „po kliknutí na
 * smlouvu by se měla otevřít v tom samém okně v náhledu a měla by se dát
 * stáhnout v pdf").
 *
 * Herec v Honorářích měl do teď jen odkaz na stránku smlouvy, která se
 * otevírala na další záložce - a stáhnout si ji nemohl vůbec. PDF je přitom
 * to, co si člověk zakládá do účetnictví.
 *
 * KDO SE SMÍ DÍVAT: ten, kdo má token. Stejné pravidlo jako u stránky
 * /smlouva/[token] - odkaz chodí mailem a nikdo se nikam nepřihlašuje. Token
 * je jediné, podle čeho se smlouva hledá; z adresy nejde odvodit žádná jiná.
 *
 * Je to tentýž dokument, jaký chodí v příloze mailu po podpisu obou stran
 * (viz lib/smlouvaPdf.ts) - u nepodepsané smlouvy jsou místa na podpis prostě
 * prázdná.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const contract = await prisma.contract.findUnique({
    where: { accessToken: params.token },
    include: { issuer: { select: { name: true } }, signatures: { orderBy: { signedAt: 'asc' } } },
  });
  if (!contract) return NextResponse.json({ error: 'Smlouva nenalezena.' }, { status: 404 });

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

  // `?stahnout=1` = rovnou do souboru, jinak se PDF ukáže v náhledu
  // (v okně Honorářů běží v <iframe>, viz honorare/NahledSmlouvy.tsx).
  const stahnout = req.nextUrl.searchParams.get('stahnout') === '1';

  // Uint8Array, ne Buffer - NextResponse ho jinak neprijme (stejne jako
  // u ostatnich PDF rout).
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${stahnout ? 'attachment' : 'inline'}; filename="${nazevSouboruSmlouvy(contract.number)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
