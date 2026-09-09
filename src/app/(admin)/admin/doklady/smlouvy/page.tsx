import Link from 'next/link';
import { prisma } from '@/lib/db';
import { CONTRACT_STATUS_CLASSES, CONTRACT_STATUS_LABELS } from '@/lib/contracts';
import { ensureContractTemplates } from '@/lib/contractsServer';
import { listProjectOptions } from '@/lib/projectOptions';
import { NewContractForm } from './NewContractForm';

// Smlouvy s elektronickym podpisem (zadani 8. 9. 2026: "chtel bych udelat
// vlastni podepisovani smluv, jak to ma treba Signi. Ale bez kodu
// potvrzovacich.")
export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'rozpracovane', label: 'Rozpracované', statuses: ['DRAFT'] },
  { key: 'k-podpisu', label: 'Čekají na podpis', statuses: ['SENT'] },
  { key: 'podepsane', label: 'Podepsané', statuses: ['SIGNED'] },
  { key: 'ostatni', label: 'Odmítnuté a zrušené', statuses: ['REJECTED', 'CANCELLED'] },
] as const;

function formatDate(date: Date | null): string {
  return date ? new Intl.DateTimeFormat('cs-CZ').format(date) : '—';
}

export default async function ContractsPage({ searchParams }: { searchParams: { tab?: string } }) {
  await ensureContractTemplates();

  const activeTab = TABS.find((t) => t.key === searchParams?.tab) ?? TABS[0];

  const [contracts, issuers, companies, templates, counts] = await Promise.all([
    prisma.contract.findMany({
      where: { status: { in: activeTab.statuses as never } },
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
      include: { signatures: { select: { role: true } }, company: { select: { name: true } } },
    }),
    prisma.issuerCompany.findMany({
      where: { active: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    }),
    prisma.company.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, contactName: true, contactEmail: true },
    }),
    prisma.contractTemplate.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.contract.groupBy({ by: ['status'], _count: true }),
  ]);

  const projects = await listProjectOptions();

  const countFor = (statuses: readonly string[]) =>
    counts.filter((c) => statuses.includes(c.status)).reduce((sum, c) => sum + c._count, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {TABS.map((tab) => {
            const active = tab.key === activeTab.key;
            return (
              <Link
                key={tab.key}
                href={`/admin/doklady/smlouvy?tab=${tab.key}`}
                className={`px-4 py-2 text-sm font-heading font-semibold rounded-pill no-underline transition-colors ${
                  active ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {tab.label} <span className="tabular-nums opacity-80">({countFor(tab.statuses)})</span>
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/doklady/smlouvy/sablony"
            className="text-xs font-heading font-semibold text-brand-purple no-underline border border-brand-purple rounded-pill px-4 py-1.5 hover:bg-tint transition-colors"
          >
            Šablony smluv
          </Link>
          <NewContractForm
            issuers={issuers}
            companies={companies}
            templates={templates}
            projects={projects.map((p) => ({ id: p.id, label: p.label, finished: p.finished }))}
          />
        </div>
      </div>

      <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="bg-bar text-white font-heading text-xs">
                <th className="text-left px-4 py-3.5">Název</th>
                <th className="text-left px-4 py-3.5 whitespace-nowrap">Podepisující</th>
                <th className="text-left px-4 py-3.5 whitespace-nowrap">Vytvořeno</th>
                <th className="text-left px-4 py-3.5 whitespace-nowrap">Podpisy</th>
                <th className="text-left px-4 py-3.5 whitespace-nowrap">Stav</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm font-body">
                    Tady zatím nic není.
                  </td>
                </tr>
              )}
              {contracts.map((c) => {
                const nase = c.signatures.some((s) => s.role === 'MEDIASPACE');
                const druha = c.signatures.some((s) => s.role === 'PROTISTRANA');
                return (
                  <tr key={c.id} className="border-t border-line hover:bg-surfaceSoft">
                    <td className="px-4 py-3.5 text-sm font-heading font-semibold">
                      <Link
                        href={`/admin/doklady/smlouvy/${c.id}`}
                        className="text-ink hover:text-brand-purple no-underline"
                      >
                        {c.title}
                      </Link>
                      <span className="block text-xs text-muted font-body">
                        <span className="tabular-nums">{c.number}</span>
                        {c.projectName ? ` · ${c.projectName}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading text-muted whitespace-nowrap">
                      {c.signerName}
                      <span className="block text-xs font-body">{c.company?.name ?? c.signerEmail}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-heading whitespace-nowrap">
                      <span className={nase ? 'text-status-done' : 'text-muted'}>
                        {nase ? '✓' : '○'} Mediaspace
                      </span>
                      <span className={`block ${druha ? 'text-status-done' : 'text-muted'}`}>
                        {druha ? '✓' : '○'} protistrana
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${
                          CONTRACT_STATUS_CLASSES[c.status] ?? 'bg-field text-muted'
                        }`}
                      >
                        {CONTRACT_STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
