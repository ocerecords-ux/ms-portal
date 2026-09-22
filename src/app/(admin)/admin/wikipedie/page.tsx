import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { vychoziKoncept } from '@/lib/wikipedie';
import { PRAZDNE_UDAJE, type UdajeOsoby } from '@/lib/wikipedieUdaje';
import { WikipedieEditor } from './WikipedieEditor';

/**
 * Wikipedie - koncept a hlídání článku o sobě (zadání 22. 9. 2026: „chtěl
 * bych u sebe udělat nějaký modul na wikipedii a editaci mé osoby").
 * Každý tu vidí jen svůj článek.
 */
export const dynamic = 'force-dynamic';

export default async function WikipediePage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/projekty');

  const clanek = await prisma.wikiClanek.findUnique({ where: { userId: session.user.id } }).catch(() => null);
  const verze = clanek
    ? await prisma.wikiVerze
        .findMany({
          where: { clanekId: clanek.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, createdAt: true, autor: true },
        })
        .catch(() => [])
    : [];
  const vychozi = vychoziKoncept(session.user.name || '');

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-muted text-sm font-heading no-underline">
        ← Zpět do administrace
      </Link>
      <div>
        <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">Wikipedie</h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[80ch]">
          Tady se článek o vás píše a ladí. Na Wikipedii ho vložíte sami svým účtem, portál tam nic
          neukládá. Až bude článek venku, doplňte jeho název dole do Hlídání a portál vám každou
          hodinu zvonkem ohlásí, když ho někdo upraví.
        </p>
      </div>
      <WikipedieEditor
        pocatecni={{
          jazyk: clanek?.jazyk ?? 'cs',
          nazev: clanek?.nazev ?? vychozi.nazev,
          wikitext: clanek?.wikitext ?? vychozi.wikitext,
          udaje: {
            ...PRAZDNE_UDAJE,
            jmeno: session.user.name || '',
            ...((clanek?.udaje as Partial<UdajeOsoby> | null) ?? {}),
          } as UdajeOsoby,
          sledovanyNazev: clanek?.sledovanyNazev ?? '',
          maToken: Boolean(clanek?.token),
          cilStranka: clanek?.cilStranka ?? '',
          ulozeno: clanek ? clanek.updatedAt.toISOString() : null,
          posledniKontrola: clanek?.posledniKontrola ? clanek.posledniKontrola.toISOString() : null,
          chybaKontroly: clanek?.chybaKontroly ?? null,
        }}
        verze={verze.map((v) => ({ id: v.id, kdy: v.createdAt.toISOString(), autor: v.autor }))}
      />
    </div>
  );
}
