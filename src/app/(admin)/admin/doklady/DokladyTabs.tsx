'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Zalozky sekce Doklady. Vlastni klientska komponenta jen kvuli tomu, aby se
// dala zvyraznit aktivni zalozka (usePathname).
const TABS = [
  { href: '/admin/doklady/nabidky', label: 'Nabídky' },
  { href: '/admin/doklady/faktury', label: 'Faktury' },
  { href: '/admin/doklady/vydaje', label: 'Výdaje' },
  // Smlouvy s elektronickym podpisem (zadani 8. 9. 2026).
  { href: '/admin/doklady/smlouvy', label: 'Smlouvy' },
  { href: '/admin/doklady/moje-firmy', label: 'Moje firmy' },
];

export function DokladyTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 flex-wrap border-b border-line">
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors no-underline ${
              active ? 'bg-white border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
