import Link from 'next/link';
import { prisma } from '@/lib/db';
import { extractDriveFolderId } from '@/lib/googleDrive';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';
import { SlozkyManager } from './SlozkyManager';

/**
 * SLOŽKY NA DISKU (zadání 30. 9. 2026: „máme na disku složky: Klientská zóna,
 * Dokumenty, Marketing. Potřebuju, ať někteří uživatelé nevidí některé
 * složky. Teď vidí všechno").
 *
 * Tady se složky zakládají; komu se která ukáže, se zaškrtává na kartě účtu.
 * Schválně oddělené: složek je pár a mění se zřídka, lidí je hodně.
 */
export const dynamic = 'force-dynamic';

export default async function SlozkyPage() {
  const jazyk = nactiJazyk();
  const slozky = await prisma.diskovaSlozka.findMany({
    orderBy: [{ poradi: 'asc' }, { nazev: 'asc' }],
    select: {
      id: true,
      nazev: true,
      popis: true,
      driveUrl: true,
      poradi: true,
      aktivni: true,
      _count: { select: { uzivatele: true } },
    },
  });

  type Radek = {
    id: string;
    nazev: string;
    popis: string | null;
    driveUrl: string;
    poradi: number;
    aktivni: boolean;
    _count: { uzivatele: number };
  };

  return (
    <section className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl text-ink m-0">{prelozit(jazyk, 'slozky.nadpis')}</h1>
        <p className="text-sm font-body text-muted m-0 mt-2">
          {prelozit(jazyk, 'slozky.uvodPred')}
          <Link href="/admin/users" className="text-brand-purple underline">
            {prelozit(jazyk, 'slozky.uvodOdkaz')}
          </Link>
          {prelozit(jazyk, 'slozky.uvodZa')}
        </p>
      </div>

      {/* Tohle není planá opatrnost: kdo si otevře Disk přímo v Googlu, uvidí
          všechno, co má jeho účet nasdílené - bez ohledu na tenhle seznam.
          Když se do Disku chodí pod jedním společným účtem, nejde to na
          Googlu rozlišit vůbec a musí mít každý účet vlastní. */}
      <div className="bg-surface rounded-card border border-line shadow-sm p-5">
        <p className="text-sm font-body text-ink m-0">
          {prelozit(jazyk, 'slozky.varovaniPred')}
          <strong>{prelozit(jazyk, 'slozky.varovaniTucne')}</strong>
          {prelozit(jazyk, 'slozky.varovaniZa')}
        </p>
      </div>

      <SlozkyManager
        slozky={(slozky as Radek[]).map((s) => ({
          id: s.id,
          nazev: s.nazev,
          popis: s.popis,
          driveUrl: s.driveUrl,
          poradi: s.poradi,
          aktivni: s.aktivni,
          pocetLidi: s._count.uzivatele,
          // Když z odkazu nejde vyčíst složka, nikomu se neukáže - a musí být
          // vidět proč, ne aby se to hledalo v přístupech.
          odkazSedi: Boolean(extractDriveFolderId(s.driveUrl)),
        }))}
      />
    </section>
  );
}
