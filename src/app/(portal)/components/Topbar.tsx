'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

const NAV = [
  { href: '/projekty', label: 'Projekty' },
  { href: '/objednavka', label: 'Objednávka audioknihy' },
  { href: '/nahravky', label: 'Nahrávky' },
];

export function Topbar({ userLabel, isAdmin }: { userLabel: string; isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-10 py-5 flex items-center justify-between flex-wrap gap-4">
      {/* Nazev "MS Portal" je hlavni, dobre citelny prvek brandingu; animovane
          logo je vedle nej v citelne velikosti jako znacka, ne miniaturni
          doplnek - "by Mediaspace" je psany text (zpetna vazba 4. 9. 2026:
          predchozi verze s drobnym logem pusobila malo a neupraveně). */}
      <Link href="/projekty" className="flex items-center gap-3 no-underline">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-10 sm:h-12 w-auto shrink-0" />
        <div className="flex flex-col leading-none">
          <span className="font-display text-brand-green font-semibold tracking-tight">
            <span className="text-2xl sm:text-3xl">MS</span>
            <span className="text-base sm:text-lg ml-1">Portal</span>
          </span>
          <span className="text-white/50 font-body text-[11px] sm:text-xs uppercase tracking-wider mt-1.5">
            by Mediaspace
          </span>
        </div>
      </Link>

      <nav className="flex items-center gap-6 sm:gap-10 flex-wrap font-heading text-sm font-medium">
        {NAV.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`pb-2 border-b-2 transition-colors ${
                active ? 'text-brand-green border-brand-green' : 'text-white/90 border-transparent hover:text-white'
              }`}
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
