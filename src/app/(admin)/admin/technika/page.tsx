import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { pristupKTechnice, smiNaTechniku } from '@/lib/technikaPristup';
import { TechnikaSprava } from './TechnikaSprava';

/**
 * TECHNIKA (zadání 22. 10. 2026: „potřebuju vytvořit kategorii, kde bude
 * seznam techniky. Bude rozdělen do kategorií… i na studia, kde která
 * technika je").
 *
 * Inventura, ne půjčovna: seznam kusů po kategoriích, u každého výrobce,
 * model, sériové číslo, fotka, poznámka - a hlavně studio, ve kterém stojí.
 * Druhé tlačítko nahoře přepne výpis z kategorií na studia, takže se dá číst
 * i opačně: co je v Brně II.
 */
export const dynamic = 'force-dynamic';

export default async function TechnikaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  /**
   * VEDOUCÍ POBOČKY SEM TAKY PATŘÍ (24. 11. 2026) - viz lib/technikaPristup.ts.
   * Dřív rozhodovala jen zaškrtávátka na kartě; kdo vede studio, má techniku
   * své pobočky zapsat, aniž by mu to někdo musel zvlášť povolovat.
   */
  const pristup = await pristupKTechnice(session.user.id, session.user.role);
  if (!smiNaTechniku(pristup)) redirect('/projekty');

  const [kategorie, kusy, studia] = await Promise.all([
    prisma.technikaKategorie
      .findMany({ orderBy: [{ poradi: 'asc' }, { nazev: 'asc' }] })
      .catch(() => [] as { id: string; nazev: string; poradi: number }[]),
    prisma.technika
      .findMany({
        orderBy: [{ nazev: 'asc' }],
        select: {
          id: true,
          nazev: true,
          kategorieId: true,
          vyrobce: true,
          model: true,
          serioveCislo: true,
          studioId: true,
          poznamka: true,
          foto: true,
          vyrazeno: true,
        },
      })
      .catch(() => []),
    prisma.studio
      .findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, color: true },
      })
      .catch(() => []),
  ]);

  return (
    <TechnikaSprava
      kategorie={(kategorie as { id: string; nazev: string; poradi: number }[]).map((k) => ({
        id: k.id,
        nazev: k.nazev,
        poradi: k.poradi,
      }))}
      kusy={kusy as never}
      studia={studia as never}
      spravce={pristup.spravce}
      mojeStudia={pristup.vedeStudia}
    />
  );
}
