import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ensureContractTemplates } from '@/lib/contractsServer';
import { TemplateManager } from './TemplateManager';

// Sablony smluv - text s poli {{jmeno}}, {{projekt}}... Pri zalozeni smlouvy
// se pole doplni z databaze a dal uz je z toho obycejny text.
export const dynamic = 'force-dynamic';

export default async function ContractTemplatesPage() {
  await ensureContractTemplates();

  const templates = await prisma.contractTemplate.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/doklady/smlouvy" className="text-muted text-sm font-heading no-underline">
        ← Zpět na smlouvy
      </Link>

      <TemplateManager
        templates={templates.map((t) => ({ id: t.id, name: t.name, body: t.body, active: t.active }))}
      />
    </div>
  );
}
