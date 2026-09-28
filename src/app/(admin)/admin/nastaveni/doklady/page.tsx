import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nastaveniSekce } from '@/lib/nastaveniSekci';
import { ZalozkyNastaveni } from '@/components/ZalozkyNastaveni';

/**
 * NASTAVENÍ SEKCE DOKLADY (zadání 28. 9. 2026: „tady nastavíme maily
 * z portálu a jak mají vypadat texty. Upomínky atd.", úprava téhož dne:
 * „tohle dej do záložek - karet").
 *
 * Záložky vedou na obrazovky, kde se to opravdu nastavuje. Kopírovat je sem
 * by znamenalo psát texty na dvou místech - do týdne by se rozešly a nikdo
 * by nepoznal, které odešlo klientovi.
 */
export const dynamic = 'force-dynamic';

export const ZALOZKY_DOKLADU = [
  { href: '/admin/nastaveni/doklady', nazev: 'Přehled' },
  { href: '/admin/doklady/upominky', nazev: 'Upomínky' },
  { href: '/admin/doklady/moje-firmy', nazev: 'Naše firmy' },
  { href: '/admin/doklady/smlouvy/sablony', nazev: 'Vzory smluv' },
];

const POPISY: { nazev: string; popis: string; cesta: string }[] = [
  {
    nazev: 'Upomínky',
    popis:
      'Kolik dní po splatnosti se upomíná, předmět a text upomínky - i s náhledem mailu, jaký klientovi opravdu odejde.',
    cesta: '/admin/doklady/upominky',
  },
  {
    nazev: 'Naše firmy',
    popis:
      'Fakturační údaje firem, ze kterých vystavujeme - hlavička dokladů, bankovní spojení a podpis pod mailem.',
    cesta: '/admin/doklady/moje-firmy',
  },
  {
    nazev: 'Vzory smluv',
    popis: 'Znění smluv s herci, ze kterých se skládá to, co jde k podpisu.',
    cesta: '/admin/doklady/smlouvy/sablony',
  },
];

export default async function NastaveniDokladuPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/projekty');

  const nastaveni = nastaveniSekce('DOKLADY');

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/doklady/nabidky" className="text-muted text-sm font-heading no-underline">
        ← Zpět do dokladů
      </Link>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">{nastaveni?.nadpis}</h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[70ch]">{nastaveni?.popis}</p>
      </div>

      <ZalozkyNastaveni zalozky={ZALOZKY_DOKLADU} />

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

      <p className="text-xs font-body text-muted m-0 max-w-[70ch] border-t border-line pt-4">
        Průvodní texty mailů u nabídky, faktury a smlouvy zatím žijí v kódu a mění se nasazením -
        do nastavení se přesunou, až se rozhodne, které z nich má smysl přepisovat.
      </p>
    </div>
  );
}
