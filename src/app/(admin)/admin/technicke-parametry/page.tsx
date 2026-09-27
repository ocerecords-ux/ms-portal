import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { nactiProfily, smiSpravovatParametry } from '@/lib/technickeParametryServer';
import { ParametryEditor } from './ParametryEditor';

/**
 * TECHNICKÉ PARAMETRY VÝROBY (zadání 27. 9. 2026: „měnit to můžu hromadně já
 * nebo Peter. Ostatní zvukaři by to neměli mít možnost upravovat").
 *
 * Tohle je to „hromadně": sady se upravují na jednom místě a projekt si je
 * bere podle klienta. Kdo příznak nemá, vidí stránku jen ke čtení - ať se
 * zvukař podívá, co kde platí, aniž by do toho mohl sáhnout.
 */
export const dynamic = 'force-dynamic';

export default async function TechnickeParametryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/projekty');

  const [profily, firmy, smiMenit] = await Promise.all([
    nactiProfily(),
    prisma.company.findMany({
      where: { type: 'KLIENT', active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    smiSpravovatParametry(session.user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-muted text-sm font-heading no-underline">
        ← Zpět do administrace
      </Link>
      <div>
        <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">
          Technické parametry
        </h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[70ch]">
          Jak se co natáčí a v čem se to odevzdává. Každé nakladatelství to má jinak, proto
          se parametry vedou jako sady přiřazené firmám — projekt si sadu vezme podle
          klienta sám. Změna se propíše do všech projektů té firmy naráz.
        </p>
      </div>
      {!smiMenit && (
        <p className="text-sm font-body text-muted m-0 rounded-card border border-line bg-field/40 px-4 py-3">
          Máte to jen ke čtení. Upravovat smí ten, kdo má na kartě zaškrtnuté{' '}
          <strong className="font-heading text-ink">Spravuje technické parametry</strong>.
        </p>
      )}
      <ParametryEditor pocatecni={profily} firmy={firmy} smiMenit={smiMenit} />
    </div>
  );
}
