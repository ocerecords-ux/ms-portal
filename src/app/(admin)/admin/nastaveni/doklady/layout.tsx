import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nastaveniSekce } from '@/lib/nastaveniSekci';
import { ZalozkyNastaveni } from '@/components/ZalozkyNastaveni';

/**
 * NASTAVENÍ DOKLADŮ - SPOLEČNÁ HLAVIČKA A ZÁLOŽKY (oprava 28. 9. 2026:
 * „chci se proklikávat záložkama"). Stejný princip jako u Firem: mění se jen
 * obsah pod záložkami, obrazovky se nekopírují.
 */
export const dynamic = 'force-dynamic';

const ZALOZKY = [
  { href: '/admin/nastaveni/doklady', nazev: 'Přehled' },
  { href: '/admin/nastaveni/doklady/upominky', nazev: 'Upomínky' },
  { href: '/admin/nastaveni/doklady/moje-firmy', nazev: 'Naše firmy' },
  { href: '/admin/nastaveni/doklady/vzory-smluv', nazev: 'Vzory smluv' },
];

export default async function NastaveniDokladuLayout({ children }: { children: React.ReactNode }) {
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
      <ZalozkyNastaveni sekce="nastaveni-doklady" zalozky={ZALOZKY} />
      {children}
    </div>
  );
}
