import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { rozdilyPozvanky } from '@/lib/pozvankaUdaju';
import { ZpracovaniZadosti } from './ZpracovaniZadosti';

/**
 * JEDNA ŽÁDOST O ÚDAJE (zadání 16. 9. 2026).
 *
 * Ukazuje se to podstatné: co se od dnešního stavu liší. Pole, které se
 * nezměnilo, tu vůbec není — jinak by se v patnácti řádcích ztratil ten jeden,
 * o který jde.
 */
export const dynamic = 'force-dynamic';

export default async function ZadostPage({ params }: { params: { id: string } }) {
  const zadost = await prisma.pozvankaUdaju.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
      vytvoril: { select: { name: true } },
    },
  });
  if (!zadost) notFound();

  const rozdily = zadost.data ? await rozdilyPozvanky(zadost) : [];
  const kdo = zadost.user?.name || zadost.company?.name || zadost.jmeno || '(bez jména)';
  const odkazNaKartu = zadost.user
    ? `/admin/users/${zadost.user.id}`
    : zadost.company
      ? `/admin/companies/${zadost.company.id}`
      : null;

  return (
    <section className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href="/admin/udaje" className="text-sm font-heading text-muted no-underline">
          ← Žádosti o údaje
        </Link>
        <h1 className="font-display text-3xl text-ink m-0 mt-2">{kdo}</h1>
        <p className="text-sm font-body text-muted m-0 mt-1">
          {zadost.druh === 'HEREC' ? 'Herec' : 'Firma'}
          {zadost.vytvoril?.name ? ` · vyžádal(a) ${zadost.vytvoril.name}` : ''}
          {` · platí do ${zadost.platiDo.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' })}`}
          {odkazNaKartu ? ' · ' : ''}
        </p>
        {odkazNaKartu && (
          <Link href={odkazNaKartu} className="text-sm font-heading text-brand-purple no-underline">
            Otevřít kartu v portálu
          </Link>
        )}
      </div>

      {zadost.vzkazOdNej && (
        <div className="bg-field border border-line rounded-card p-4">
          <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">Vzkaz od něj</p>
          <p className="text-sm font-body text-ink m-0 mt-1 whitespace-pre-wrap">{zadost.vzkazOdNej}</p>
        </div>
      )}

      <ZpracovaniZadosti
        id={zadost.id}
        stav={zadost.stav}
        token={zadost.token}
        email={zadost.email}
        vyplneno={zadost.vyplnenoAt ? zadost.vyplnenoAt.toISOString() : null}
        rozdily={rozdily}
      />
    </section>
  );
}
