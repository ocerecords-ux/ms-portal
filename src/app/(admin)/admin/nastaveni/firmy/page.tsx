import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nastaveniSekce } from '@/lib/nastaveniSekci';
import { ZalozkyNastaveni } from '@/components/ZalozkyNastaveni';

/**
 * NASTAVENÍ SEKCE FIRMY (zadání 28. 9. 2026: „a z těch firem teď můžeme dát
 * ty zprávy z portálu apod., co teď máme v tom nastavení").
 *
 * Administrace byla dlouho jeden seznam dvaceti dlaždic, ve kterém se hledalo
 * podle názvu. Ozubené kolo u sekce to rozděluje: co patří k firmám a co
 * z portálu odchází nám, je tady - texty zpráv klientovi zůstávají
 * u Projektů, upomínky u Dokladů.
 */
export const dynamic = 'force-dynamic';

const ZALOZKY = [
  { href: '/admin/nastaveni/firmy', nazev: 'Přehled' },
  { href: '/admin/zpravy-portalu', nazev: 'Zprávy z portálu' },
  { href: '/admin/ceniky', nazev: 'Ceníky' },
  { href: '/admin/vzory-nataceni', nazev: 'Vzory natáčení' },
  { href: '/admin/wikipedie', nazev: 'Wikipedie' },
  { href: '/admin/caflou-firmy', nazev: 'Firmy z Caflou' },
];

const POPISY: { nazev: string; popis: string; cesta: string }[] = [
  {
    nazev: 'Zprávy z portálu',
    popis:
      'Co portál posílá nám - bonusy ke schválení a měsíční přehled výkazů zvukařům. Dá se zapnout, vypnout a je vidět, co už odešlo.',
    cesta: '/admin/zpravy-portalu',
  },
  {
    nazev: 'Ceníky',
    popis: 'Sazby za normostranu a položky, ze kterých se skládají nabídky a rozpočty.',
    cesta: '/admin/ceniky',
  },
  {
    nazev: 'Vzory natáčení',
    popis: 'Předlohy natáčecích textů, ze kterých se skládá dokument k natáčení.',
    cesta: '/admin/vzory-nataceni',
  },
  {
    nazev: 'Wikipedie',
    popis: 'Koncept článku o nás a hlídání změn.',
    cesta: '/admin/wikipedie',
  },
  {
    nazev: 'Firmy z Caflou',
    popis: 'Párování našich firem s tím, co je vedené v Caflou.',
    cesta: '/admin/caflou-firmy',
  },
];

export default async function NastaveniFiremPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/projekty');

  const nastaveni = nastaveniSekce('FIRMY');

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin" className="text-muted text-sm font-heading no-underline">
        ← Zpět na firmy
      </Link>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">{nastaveni?.nadpis}</h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[70ch]">{nastaveni?.popis}</p>
      </div>

      <ZalozkyNastaveni zalozky={ZALOZKY} />

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
    </div>
  );
}
