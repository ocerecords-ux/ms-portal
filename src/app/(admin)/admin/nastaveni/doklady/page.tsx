import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nastaveniSekce } from '@/lib/nastaveniSekci';

/**
 * NASTAVENÍ SEKCE DOKLADY (zadání 28. 9. 2026: „tady nastavíme maily
 * z portálu a jak mají vypadat texty. Upomínky atd.").
 *
 * Rozcestník, ne další kopie obrazovek. Upomínky svoje nastavení už mají -
 * kdyby se texty daly psát na dvou místech, do týdne se rozejdou a nikdo
 * nepozná, které odešlo.
 */
export const dynamic = 'force-dynamic';

const POLOZKY: { nadpis: string; popis: string; cesta: string }[] = [
  {
    nadpis: 'Upomínky k fakturám',
    popis:
      'Kolik dní po splatnosti se upomíná, předmět a text upomínky - i s náhledem mailu, jaký klientovi opravdu odejde.',
    cesta: '/admin/doklady/upominky',
  },
  {
    nadpis: 'Naše firmy',
    popis:
      'Fakturační údaje firem, ze kterých vystavujeme - hlavička dokladů, bankovní spojení a podpis pod mailem.',
    cesta: '/admin/doklady/moje-firmy',
  },
  {
    nadpis: 'Vzory smluv',
    popis: 'Znění smluv s herci, ze kterých se skládá to, co jde k podpisu.',
    cesta: '/admin/doklady/smlouvy/sablony',
  },
];

export default async function NastaveniDokladuPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/projekty');

  const nastaveni = nastaveniSekce('DOKLADY');

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/doklady/nabidky" className="text-muted text-sm font-heading no-underline">
        ← Zpět do dokladů
      </Link>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">{nastaveni?.nadpis}</h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[70ch]">{nastaveni?.popis}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {POLOZKY.map((p) => (
          <Link
            key={p.cesta}
            href={p.cesta}
            className="rounded-card border border-line bg-surface p-5 no-underline transition-colors hover:border-brand-purple"
          >
            <span className="block font-heading font-semibold text-sm text-ink">{p.nadpis}</span>
            <span className="block text-xs font-body text-muted mt-1.5">{p.popis}</span>
          </Link>
        ))}
      </div>

      {/* Ať je vidět, co tu ještě není - prázdné místo mate víc než věta. */}
      <p className="text-xs font-body text-muted m-0 max-w-[70ch] border-t border-line pt-4">
        Průvodní texty mailů u nabídky, faktury a smlouvy zatím žijí v kódu a mění se nasazením -
        do nastavení se přesunou, až se rozhodne, které z nich má smysl přepisovat.
      </p>
    </div>
  );
}
