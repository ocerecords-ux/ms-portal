import Link from 'next/link';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';

/**
 * PŘEHLED NASTAVENÍ FIREM.
 *
 * CO SEM NEPATŘÍ (28. 9. 2026): Wikipedie - koncept článku si píše každý sám
 * a má ho v Mém účtu, s firmami nemá nic společného. A Firmy z Caflou -
 * Caflou už není napojené, takže párování nemá co párovat.
 *
 * Hlavička a záložky jsou v layoutu vedle - tady zůstává jen rozcestník pro
 * toho, kdo přišel poprvé a neví, co která záložka skrývá.
 */
export const dynamic = 'force-dynamic';

const POPISY: { klicNazvu: string; klicPopisu: string; cesta: string }[] = [
  {
    klicNazvu: 'nastaveniFirmy.zpravy',
    klicPopisu: 'nastaveniFirmy.zpravyPopis',
    cesta: '/admin/nastaveni/firmy/zpravy-portalu',
  },
  {
    klicNazvu: 'nastaveniFirmy.ceniky',
    klicPopisu: 'nastaveniFirmy.cenikyPopis',
    cesta: '/admin/nastaveni/firmy/ceniky',
  },
  {
    klicNazvu: 'nastaveniFirmy.vzoryNataceni',
    klicPopisu: 'nastaveniFirmy.vzoryNataceniPopis',
    cesta: '/admin/nastaveni/firmy/vzory-nataceni',
  },
];

export default function NastaveniFiremPrehled() {
  const jazyk = nactiJazyk();
  return (
    <div className="flex flex-col gap-2 max-w-3xl">
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
  );
}
