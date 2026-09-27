'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

// Zalozky sekce Doklady. Vlastni klientska komponenta jen kvuli tomu, aby se
// dala zvyraznit aktivni zalozka (usePathname).
const TABS = [
  { href: '/admin/doklady/nabidky', klic: 'doklady.zalozkaNabidky' },
  { href: '/admin/doklady/faktury', klic: 'doklady.zalozkaFaktury' },
  // Upominky na faktury po splatnosti (zadani 25. 9. 2026).
  { href: '/admin/doklady/upominky', klic: 'doklady.zalozkaUpominky' },
  { href: '/admin/doklady/vydaje', klic: 'doklady.zalozkaVydaje' },
  // Smlouvy s elektronickym podpisem (zadani 8. 9. 2026).
  { href: '/admin/doklady/smlouvy', klic: 'doklady.zalozkaSmlouvy' },
  { href: '/admin/doklady/moje-firmy', klic: 'doklady.zalozkaMojeFirmy' },
];

/**
 * `banka` = vidí tenhle člověk sekci Banka? Párování plateb a napojení účtu
 * vidí jen ten, kdo to má dovolené u účtu (zadání 17. 9. 2026: „nastavení
 * a párování banky bych měl vidět jen já a Bára Šiblová").
 */
export function DokladyTabs({ banka = false }: { banka?: boolean }) {
  const t = usePreklad();
  const pathname = usePathname();
  const zalozky = banka
    ? [...TABS.slice(0, 4), { href: '/admin/doklady/banka', klic: 'doklady.zalozkaBanka' }, ...TABS.slice(4)]
    : TABS;
  return (
    // Na telefonu jeden posuvny radek (21. 9. 2026), od tabletu se lamou.
    <nav className="flex items-center gap-1 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-line">
      {zalozky.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors no-underline ${
              active ? 'bg-surface border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t(tab.klic)}
          </Link>
        );
      })}
    </nav>
  );
}
