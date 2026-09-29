import Link from 'next/link';

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

const POPISY: { nazev: string; popis: string; cesta: string }[] = [
  {
    nazev: 'Zprávy z portálu',
    popis:
      'Co portál posílá nám - bonusy ke schválení a měsíční přehled výkazů zvukařům. Dá se zapnout, vypnout a je vidět, co už odešlo.',
    cesta: '/admin/nastaveni/firmy/zpravy-portalu',
  },
  {
    nazev: 'Ceníky',
    popis: 'Sazby za normostranu a položky, ze kterých se skládají nabídky a rozpočty.',
    cesta: '/admin/nastaveni/firmy/ceniky',
  },
  {
    nazev: 'Vzory natáčení',
    popis: 'Předlohy natáčecích textů, ze kterých se skládá dokument k natáčení.',
    cesta: '/admin/nastaveni/firmy/vzory-nataceni',
  },
];

export default function NastaveniFiremPrehled() {
  return (
    <div className="flex flex-col gap-2 max-w-3xl">
      {POPISY.map((p) => (
        <Link
          key={p.cesta}
          href={p.cesta}
          className="rounded-card border border-line bg-surface p-4 no-underline transition-colors hover:border-brand-purple"
        >
          <span className="block font-heading font-semibold text-sm text-ink">{p.nazev}</span>
          <span className="block text-xs font-body text-muted mt-1">{p.popis}</span>
        </Link>
      ))}
    </div>
  );
}
