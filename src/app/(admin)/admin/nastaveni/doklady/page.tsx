import Link from 'next/link';

/**
 * PŘEHLED NASTAVENÍ DOKLADŮ. Hlavička a záložky jsou v layoutu vedle.
 */
export const dynamic = 'force-dynamic';

const POPISY: { nazev: string; popis: string; cesta: string }[] = [
  {
    nazev: 'Upomínky',
    popis:
      'Kolik dní po splatnosti se upomíná, předmět a text upomínky - i s náhledem mailu, jaký klientovi opravdu odejde.',
    cesta: '/admin/nastaveni/doklady/upominky',
  },
  {
    nazev: 'Naše firmy',
    popis:
      'Fakturační údaje firem, ze kterých vystavujeme - hlavička dokladů, bankovní spojení a podpis pod mailem.',
    cesta: '/admin/nastaveni/doklady/moje-firmy',
  },
  {
    nazev: 'Vzory smluv',
    popis: 'Znění smluv s herci, ze kterých se skládá to, co jde k podpisu.',
    cesta: '/admin/nastaveni/doklady/vzory-smluv',
  },
];

export default function NastaveniDokladuPrehled() {
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-col gap-2">
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
      <p className="text-xs font-body text-muted m-0 max-w-[70ch] border-t border-line pt-4">
        Průvodní texty mailů u nabídky, faktury a smlouvy zatím žijí v kódu a mění se nasazením -
        do nastavení se přesunou, až se rozhodne, které z nich má smysl přepisovat.
      </p>
    </div>
  );
}
