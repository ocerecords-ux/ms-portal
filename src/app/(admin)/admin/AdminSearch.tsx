'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Hledani v seznamech administrace (zadani 6. 9. 2026: "U všech uživatelů a
 * firem by mělo fungovat vyhledávání"). Zapisuje se do adresy jako ?q=,
 * takze filtr prezije obnoveni stranky i sdileny odkaz. Filtruje se na
 * serveru - viz stranky, ktere tenhle komponent pouzivaji.
 */
export function AdminSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get('q') ?? '';
  const [value, setValue] = useState(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  useEffect(() => {
    // Malá prodleva, aby se při psaní neposílal dotaz po každém písmenu.
    const timer = setTimeout(() => {
      if (value === initial) return;
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      if (value.trim()) params.set('q', value.trim());
      else params.delete('q');
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-72 max-w-full rounded-lg border border-line bg-white pl-9 pr-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
    </div>
  );
}
