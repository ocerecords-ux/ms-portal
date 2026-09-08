import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { documentHash } from '@/lib/contractsServer';
import { ContractPaper } from '@/app/(admin)/admin/doklady/smlouvy/ContractPaper';
import { ContractSigning } from './ContractSigning';

/**
 * Podpis smlouvy protistranou (zadani 8. 9. 2026). Veřejná stránka — člověk
 * sem přijde z e-mailu odkazem s tokenem, nikam se nepřihlašuje a nikam
 * neopisuje žádný ověřovací kód. Smlouva se hledá VÝHRADNĚ podle tokenu.
 */
export const dynamic = 'force-dynamic';

export default async function PublicContractPage({ params }: { params: { token: string } }) {
  const contract = await prisma.contract.findUnique({
    where: { accessToken: params.token },
    include: {
      issuer: { select: { name: true } },
      signatures: { orderBy: { signedAt: 'asc' } },
    },
  });
  if (!contract) notFound();

  const podepsanoJimi = contract.signatures.some((s) => s.role === 'PROTISTRANA');

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-10 py-6 flex items-center gap-3 sm:gap-4">
        <span className="font-body text-brand-green font-semibold text-2xl sm:text-3xl">MS portal</span>
        <span className="w-px h-8 sm:h-10 bg-white/40" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-12 sm:h-14 w-auto" />
      </header>

      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8 sm:py-12 flex flex-col gap-6">
        <div>
          <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">
            Smlouva k podpisu · {contract.issuer.name}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0 mt-1">{contract.title}</h1>
          <p className="text-muted text-sm mt-2 font-body m-0">
            Přečtěte si smlouvu a podepište se dole — myší, nebo prstem na mobilu. Přihlašovat se
            nemusíte a žádný kód nikam neopisujete.
          </p>
        </div>

        <ContractPaper
          title={contract.title}
          number={contract.number}
          body={contract.body}
          signatures={contract.signatures.map((s) => ({
            role: s.role as 'MEDIASPACE' | 'PROTISTRANA',
            name: s.name,
            email: s.email,
            imageData: s.imageData,
            signedAt: s.signedAt.toISOString(),
            ip: s.ip,
            documentHash: s.documentHash,
          }))}
          currentHash={documentHash(contract.body)}
        />

        <ContractSigning
          token={params.token}
          status={contract.status}
          signerName={contract.signerName}
          alreadySigned={podepsanoJimi}
          completedAt={contract.completedAt ? contract.completedAt.toISOString() : null}
          rejectedAt={contract.rejectedAt ? contract.rejectedAt.toISOString() : null}
          issuerName={contract.issuer.name}
        />
      </div>
    </main>
  );
}
