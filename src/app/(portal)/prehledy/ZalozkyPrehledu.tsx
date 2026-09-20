'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Záložky sekce Přehledy (zadání 20. 9. 2026: „z něj pak uděláme záložku, ne
 * toto") - místo rozcestníku s kartami se přepíná nahoře, stejně jako na
 * detailu projektu. Další přehledy se sem přidají jedním řádkem.
 */
export const ZALOZKY_PREHLEDU: { href: string; label: string }[] = [
  { href: '/prehledy/kapacita', label: 'Kapacita studií' },
];

export function ZalozkyPrehledu() {
  const cesta = usePathname();
  return (
    <nav className="flex items-center gap-1 flex-wrap border-b border-line">
      {ZALOZKY_PREHLEDU.map((z) => {
        const aktivni = cesta === z.href || cesta.startsWith(`${z.href}/`);
        return (
          <Link
            key={z.href}
            href={z.href}
            aria-current={aktivni ? 'page' : undefined}
            className={`px-4 py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 no-underline transition-colors ${
              aktivni ? 'bg-surface border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {z.label}
          </Link>
        );
      })}
    </nav>
  );
}
