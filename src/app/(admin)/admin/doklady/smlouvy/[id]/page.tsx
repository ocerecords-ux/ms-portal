import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { documentHash } from '@/lib/contractsServer';
import { listProjectOptions } from '@/lib/projectOptions';
import { ContractEditor } from './ContractEditor';

// Detail smlouvy - text, podpis za Mediaspace a odeslani protistrane.
export const dynamic = 'force-dynamic';

export default async function ContractDetailPage({ params }: { params: { id: string } }) {
  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      issuer: { select: { name: true } },
      signatures: { orderBy: { signedAt: 'asc' } },
    },
  });
  if (!contract) notFound();

  const [companies, projects] = await Promise.all([
    prisma.company.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    listProjectOptions(),
  ]);

  const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/doklady/smlouvy" className="text-muted text-sm font-heading no-underline">
        ← Zpět na smlouvy
      </Link>

      <ContractEditor
        contract={{
          id: contract.id,
          number: contract.number,
          title: contract.title,
          body: contract.body,
          status: contract.status,
          companyId: contract.companyId ?? '',
          signerName: contract.signerName,
          signerEmail: contract.signerEmail,
          caflouProjectId: contract.caflouProjectId ?? '',
          projectName: contract.projectName,
          issuerName: contract.issuer.name,
          sentAt: contract.sentAt ? contract.sentAt.toISOString() : null,
          completedAt: contract.completedAt ? contract.completedAt.toISOString() : null,
          rejectedAt: contract.rejectedAt ? contract.rejectedAt.toISOString() : null,
          rejectedReason: contract.rejectedReason,
          signUrl: `${baseUrl}/smlouva/${contract.accessToken}`,
          currentHash: documentHash(contract.body),
          signatures: contract.signatures.map((s) => ({
            role: s.role as 'MEDIASPACE' | 'PROTISTRANA',
            name: s.name,
            email: s.email,
            imageData: s.imageData,
            signedAt: s.signedAt.toISOString(),
            ip: s.ip,
            documentHash: s.documentHash,
          })),
        }}
        companies={companies}
        projects={projects.map((p) => ({ id: p.id, label: p.label, finished: p.finished }))}
      />
    </div>
  );
}
