'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * ZÁLOŽKY V NASTAVENÍ SEKCE (zadání 28. 9. 2026: „tohle dej do záložek -
 * karet").
 *
 * Vypadají stejně jako záložky v Dokladech - nastavení je jen další pohled
 * na tutéž sekci, takže se nemá chovat jinak než zbytek portálu.
 *
 * Aktivní je ta záložka, jejíž adresa sedí na začátek cesty; pořadí v seznamu
 * proto musí jít od nejobecnější adresy k nejkonkrétnější, jinak by se
 * podtrhly dvě najednou.
 */
export function ZalozkyNastaveni({
  zalozky,
}: {
  zalozky: { href: string; nazev: string }[];
}) {
  const pathname = usePathname();
  const aktivni = [...zalozky]
    .sort((a, b) => b.href.length - a.href.length)
    .find((z) => pathname === z.href || pathname?.startsWith(`${z.href}/`))?.href;

  return (
    <nav className="flex items-center gap-1 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-line">
      {zalozky.map((z) => (
        <Link
          key={z.href}
          href={z.href}
          className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors no-underline ${
            aktivni === z.href
              ? 'bg-surface border-line text-brand-purple'
              : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {z.nazev}
        </Link>
      ))}
    </nav>
  );
}
