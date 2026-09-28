import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nastaveniSekce } from '@/lib/nastaveniSekci';
import { ZalozkyNastaveni } from '@/components/ZalozkyNastaveni';

/**
 * NASTAVENÍ FIREM - SPOLEČNÁ HLAVIČKA A ZÁLOŽKY (oprava 28. 9. 2026: „když
 * kliknu sem na nějakou záložku, tak se neproklikávám, ale dostanu se na novou
 * stránku. Chci se proklikávat záložkama").
 *
 * Do teď záložky vedly rovnou na obrazovky v administraci, takže po kliknutí
 * zmizely i s nadpisem a člověk se musel vracet zpátky. Teď jsou v layoutu:
 * mění se jen to pod nimi a záložky zůstávají na místě, jako v Dokladech.
 *
 * Obsah jednotlivých záložek se nekopíruje - podstránky vykreslují tytéž
 * komponenty, které pohánějí původní obrazovky. Kdyby se to psalo dvakrát,
 * první změna jedné z nich by je rozešla.
 */
export const dynamic = 'force-dynamic';

const ZALOZKY = [
  { href: '/admin/nastaveni/firmy', nazev: 'Přehled' },
  { href: '/admin/nastaveni/firmy/zpravy-portalu', nazev: 'Zprávy z portálu' },
  { href: '/admin/nastaveni/firmy/ceniky', nazev: 'Ceníky' },
  { href: '/admin/nastaveni/firmy/vzory-nataceni', nazev: 'Vzory natáčení' },
];

export default async function NastaveniFiremLayout({ children }: { children: React.ReactNode }) {
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
      {children}
    </div>
  );
}
