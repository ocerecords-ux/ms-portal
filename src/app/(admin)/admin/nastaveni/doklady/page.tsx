import Link from 'next/link';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';

/**
 * PŘEHLED NASTAVENÍ DOKLADŮ. Hlavička a záložky jsou v layoutu vedle.
 */
export const dynamic = 'force-dynamic';

const POPISY: { klicNazvu: string; klicPopisu: string; cesta: string }[] = [
  {
    klicNazvu: 'nastaveniDoklady.upominky',
    klicPopisu: 'nastaveniDoklady.upominkyPopis',
    cesta: '/admin/nastaveni/doklady/upominky',
  },
  {
    klicNazvu: 'nastaveniDoklady.mojeFirmy',
    klicPopisu: 'nastaveniDoklady.mojeFirmyPopis',
    cesta: '/admin/nastaveni/doklady/moje-firmy',
  },
  {
    klicNazvu: 'nastaveniDoklady.vzorySmluv',
    klicPopisu: 'nastaveniDoklady.vzorySmluvPopis',
    cesta: '/admin/nastaveni/doklady/vzory-smluv',
  },
];

export default function NastaveniDokladuPrehled() {
  const jazyk = nactiJazyk();
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-col gap-2">
        {POPISY.map((p) => (
          <Link
            key={p.cesta}
            href={p.cesta}
            className="rounded-card border border-line bg-surface p-4 no-underline transition-colors hover:border-brand-purple"
          >
            <span className="block font-heading font-semibold text-sm text-ink">
              {prelozit(jazyk, p.klicNazvu)}
            </span>
            <span className="block text-xs font-body text-muted mt-1">
              {prelozit(jazyk, p.klicPopisu)}
            </span>
          </Link>
        ))}
      </div>
      <p className="text-xs font-body text-muted m-0 max-w-[70ch] border-t border-line pt-4">
        {prelozit(jazyk, 'nastaveniDoklady.pruvodniTexty')}
      </p>
    </div>
  );
}
