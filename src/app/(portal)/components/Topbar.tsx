'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { isExternalHref, type NavItem } from '@/lib/menu';

// Polozky listy uz nejsou napevno tady - skladaji se z tabulky MenuItem a
// admin je meni v /admin/menu (zadani 6. 9. 2026). Vychozi sada zustava v
// src/lib/menu.ts (DEFAULT_MENU_ITEMS) a pouzije se, dokud je tabulka prazdna.
export function Topbar({
  userLabel,
  isAdmin,
  items,
}: {
  userLabel: string;
  isAdmin?: boolean;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-10 py-5 flex items-center justify-between flex-wrap gap-4">
      {/* Branding "MS portal | [logo]" podle noveho referencniho mockupu
          uzivatele (12. 9. 2026: "to animované logo je strašně malé...mělo
          by to vypadat cca takto: MS portal | (animované logo Mediaspace)")
          - "by" nahrazeno svislou oddelovaci carou a logo znatelne zvetseno
          (drive vetsi nez napis MS portal, drive bylo h-7/h-8). Jeste dal
          zvetseno 5. 9. 2026 (drive h-11/h-14) - uzivatel chtel logo jeste
          o neco vetsi. */}
      <Link href="/projekty" className="flex items-center gap-3 sm:gap-4 no-underline">
        <span className="font-body text-brand-green font-semibold text-2xl sm:text-3xl">MS portal</span>
        <span className="w-px h-8 sm:h-10 bg-white/40" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-12 sm:h-16 w-auto" />
      </Link>

      <nav className="flex items-center gap-6 sm:gap-10 flex-wrap font-heading text-sm font-medium">
        {items.map((item, index) => {
          const external = isExternalHref(item.href);
          // "/admin" (Firmy) by jinak jako prefix odpovidal i "/admin/users" -
          // proto je Firmy aktivni jen presne na /admin nebo na detailu firmy.
          const active =
            external || !pathname
              ? false
              : item.href === '/admin'
                ? pathname === '/admin' || pathname.startsWith('/admin/companies')
                : pathname.startsWith(item.href);
          const className = `pb-2 border-b-2 transition-colors ${
            active ? 'text-brand-green border-brand-green' : 'text-white/90 border-transparent hover:text-white'
          }`;

          if (external) {
            return (
              <a
                key={`${item.href}-${index}`}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className={className}
              >
                {item.label}
              </a>
            );
          }

          return (
            <Link
              key={`${item.href}-${index}`}
              href={item.href}
              // "/projekty" tahá při každém zobrazení živá data z Caflou
              // (viz projekty/page.tsx) - výchozí automatický prefetch by ho
              // natahoval při každém vykreslení Topbaru (item je porad ve
              // viewportu), coz spolu s dalsimi odkazy zbytecne zvysovalo
              // riziko kolize/rate-limitu na Caflou API (zprava uzivatele
              // 5. 9. 2026: "Projekty se nepodařilo načíst z Caflou").
              prefetch={item.href === '/projekty' ? false : undefined}
              className={className}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-heading text-brand-green bg-white/10 border border-white/20 rounded-pill px-3.5 py-2"
        >
          {userLabel}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5">
            <path d="M5 8l5 5 5-5" />
          </svg>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-lg border border-line py-1 min-w-[160px] z-10">
            <Link href="/muj-ucet" className="block w-full text-left px-4 py-2 text-sm font-body text-ink hover:bg-field no-underline">
              Můj účet
            </Link>
            {isAdmin && (
              <Link href="/admin" className="block w-full text-left px-4 py-2 text-sm font-body text-ink hover:bg-field no-underline">
                Administrace
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full text-left px-4 py-2 text-sm font-body text-ink hover:bg-field"
            >
              Odhlásit se
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
