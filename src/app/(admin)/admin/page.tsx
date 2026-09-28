import Link from 'next/link';
import { prisma } from '@/lib/db';
import { NewCompanyForm } from './NewCompanyForm';
import { COMPANY_TYPE_TABS } from '@/lib/roles';
import { AdminSearch } from './AdminSearch';
import { FirmyTabulka, type FirmaRadek } from './FirmyTabulka';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';
import { OzubeneKolo } from '@/components/OzubeneKolo';
import { nastaveniSekce } from '@/lib/nastaveniSekci';

// Firmy se od 5. 9. 2026 deli na zalozky Klienti / Dodavatele (zadani:
// "sekci Firmy bych rozdělil na Klienti a Dodavatele") - stejny vzor jako
// zalozky na /admin/users, jen podle CompanyType misto role.
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: { tab?: string; q?: string };
}) {
  const jazyk = nactiJazyk();
  const activeTab = COMPANY_TYPE_TABS.find((t) => t.key === searchParams?.tab) ?? COMPANY_TYPE_TABS[0];
  // Hledani napric nazvem, IC, kodem i kontaktem (zadani 6. 9. 2026).
  const q = searchParams?.q?.trim() || '';

  const [companies, typeCounts] = await Promise.all([
    prisma.company.findMany({
      where: {
        type: activeTab.type,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { code: { contains: q, mode: 'insensitive' as const } },
                { ic: { contains: q, mode: 'insensitive' as const } },
                { contactName: { contains: q, mode: 'insensitive' as const } },
                { contactEmail: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true, orders: true } } },
    }),
    prisma.company.groupBy({ by: ['type'], _count: { type: true } }),
  ]);

  const countFor = (type: string) => typeCounts.find((t) => t.type === type)?._count.type ?? 0;

  // Popisky zalozek jsou v lib/roles.ts cesky (bere si je i /admin/users),
  // proto se prekladaji tady podle klice zalozky, ne podle textu.
  const popisekZalozky = (key: string) =>
    prelozit(jazyk, key === 'dodavatele' ? 'firmy.zalozkaDodavatele' : 'firmy.zalozkaKlienti');

  const radkyFirem: FirmaRadek[] = companies.map((c) => ({
    id: c.id,
    kod: c.code || null,
    nazev: c.name,
    sazba: c.ratePerPage ?? null,
    uzivatelu: c._count.users,
    objednavek: c._count.orders,
    kontaktniOsoba: c.contactName || null,
    telefonEmail: [c.contactPhone, c.contactEmail].filter(Boolean).join(' / ') || null,
    ic: c.ic || null,
  }));

  return (
    <section className="flex flex-col gap-8">
      {/* HLAVIČKA JE JEN NADPIS A KOLEČKO (zadání 28. 9. 2026: „a z těch firem
          teď můžeme dát ty zprávy z portálu apod. co teď máme v tom
          nastavení"). Do teď tu vedle sebe stálo šest tlačítek na věci, kam
          člověk chodí jednou za čas - Vzory zpráv, Vzory natáčení, Technické
          parametry, Wikipedie, Zprávy z portálu a Caflou. Sebraly půl řádku
          nad seznamem firem, kvůli kterému sem člověk přišel. Teď jsou pod
          ozubeným kolem, viz lib/nastaveniSekci.ts. */}
      <div className="flex items-center gap-3">
        <h1 className="hidden sm:block font-display text-3xl text-ink m-0">{prelozit(jazyk, 'firmy.nadpis')}</h1>
        <OzubeneKolo
          cesta={nastaveniSekce('FIRMY')?.cesta ?? '/admin/nastaveni/firmy'}
          popis={prelozit(jazyk, 'firmy.nastaveniSekce')}
        />
      </div>

      <div className="flex items-end justify-between gap-4 flex-wrap border-b border-line">
        <div className="flex items-center gap-1">
        {COMPANY_TYPE_TABS.map((tab) => {
          const active = tab.key === activeTab.key;
          return (
            <Link
              key={tab.key}
              href={`/admin?tab=${tab.key}`}
              className={`px-4 py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors ${
                active ? 'bg-surface border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {popisekZalozky(tab.key)} <span className="tabular-nums">({countFor(tab.type)})</span>
            </Link>
          );
        })}
        </div>
        <div className="mb-2">
          <AdminSearch placeholder={prelozit(jazyk, 'firmy.hledatPlaceholder')} />
        </div>
      </div>

      {/* Vlastni ramecek nepridavame - RaditelnaTabulka uz ho ma. */}
      <FirmyTabulka
        key={activeTab.key}
        radky={radkyFirem}
        druh={activeTab.type === 'KLIENT' ? 'klienti' : 'dodavatele'}
        prazdno={prelozit(
          jazyk,
          q
            ? 'firmy.hledaniPrazdne'
            : activeTab.type === 'KLIENT'
              ? 'firmy.zadnyKlient'
              : 'firmy.zadnyDodavatel',
        )}
      />

      {/* key vynuti remount pri prepnuti zalozky Klienti/Dodavatele - stejny
          bug jako u /admin/users NewUserForm (5. 9. 2026): bez key si
          klientsky komponent drzi puvodni useState(type) z prvniho mountu. */}
      <div className="max-w-3xl w-full">
        <NewCompanyForm key={activeTab.key} defaultType={activeTab.type} />
      </div>
    </section>
  );
}
