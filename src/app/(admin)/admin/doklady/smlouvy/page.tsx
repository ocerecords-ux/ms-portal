import Link from 'next/link';
import { prisma } from '@/lib/db';
import { CONTRACT_STATUS_CLASSES, CONTRACT_STATUS_LABELS } from '@/lib/contracts';
import { ensureContractTemplates } from '@/lib/contractsServer';
import { listProjectOptions } from '@/lib/projectOptions';
import { NewContractForm } from './NewContractForm';
import { SmlouvyTabulka, type SmlouvaRadek } from './SmlouvyTabulka';

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

  const radkyTabulky: SmlouvaRadek[] = contracts.map((c) => ({
    id: c.id,
    nazev: c.title,
    cislo: c.number,
    projekt: c.projectName || null,
    podepisujici: c.signerName,
    podepisujiciDoplnek: c.company?.name ?? c.signerEmail,
    vytvoreno: formatDate(c.createdAt),
    vytvorenoMs: c.createdAt ? new Date(c.createdAt).getTime() : null,
    podepsalaMediaspace: c.signatures.some((s) => s.role === 'MEDIASPACE'),
    podepsalaProtistrana: c.signatures.some((s) => s.role === 'PROTISTRANA'),
    stav: CONTRACT_STATUS_LABELS[c.status] ?? c.status,
    stavTrida: CONTRACT_STATUS_CLASSES[c.status] ?? 'bg-field text-muted',
  }));

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

      <SmlouvyTabulka radky={radkyTabulky} />
    </div>
  );
}
