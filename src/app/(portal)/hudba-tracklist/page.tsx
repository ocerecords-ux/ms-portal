import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { HudbaOdKlienta } from '@/app/hudba/[token]/HudbaOdKlienta';
import { TracklistOdKlienta } from '@/app/hudba/[token]/TracklistOdKlienta';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { prelozit } from '@/lib/jazyk';
import { nactiJazyk } from '@/lib/jazykServer';
import { nactiTracklist } from '@/lib/tracklistServer';
import { coUzJeVlozeno, zajistiVyzvu } from '@/lib/vyzvaHudbaServer';

/**
 * HUDBA A TRACKLIST OD KLIENTA - V PORTÁLU (zadání 20. 11. 2026: „aby klienti,
 * kteří nám dodávají tracklist i hudbu, měli možnost vložit tracklist i hudbu
 * přímo na svém profilu v portálu už klidně dříve než tři dny před první
 * frekvencí", oprava: „klientka Veronika z Melvil nemůže vložit nebo upravovat
 * tu hudbu u projektu").
 *
 * PROČ VLASTNÍ STRÁNKA: do detailu projektu se klient vůbec nedostane -
 * /projekty/<id> pouští jen interní účty a klienta vrací na seznam. Záložka
 * v kartě projektu tedy byla pro klienta neviditelná. Tohle je jeho vlastní
 * místo: seznam knih, u kterých od něj něco potřebujeme, a u vybrané rovnou
 * stejné vkládání jako za odkazem z mailu.
 *
 * Je to TÁŽ OBRAZOVKA jako /hudba/<token>, takže vložené soubory i tracklist
 * padají na stejné místo a výzva pozná, že je hotovo.
 */
export const dynamic = 'force-dynamic';

export default async function HudbaTracklistPage({
  searchParams,
}: {
  searchParams: { projekt?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/prihlaseni');
  const jazyk = nactiJazyk();
  const t = (k: string) => prelozit(jazyk, k);

  /**
   * KTERÉ KNIHY SEM PATŘÍ (oprava 20. 11. 2026: „je to tam, ale Veronika to
   * pořád nevidí").
   *
   * Nestačí se ptát firmy ze session - klientský účet nemusí mít firmu
   * vyplněnou vůbec a u starších zakázek drží projekt jen její jméno textem.
   * Bere se proto všechno, kde je člověk veden jako klient, i všechno jeho
   * firmy, a teprve u každé knihy se kouká, jestli od ní hudbu nebo tracklist
   * chceme.
   */
  const companyId = session.user.companyId;
  const firma = companyId
    ? ((await prisma.company
        .findUnique({ where: { id: companyId }, select: { name: true } })
        .catch(() => null)) as { name: string } | null)
    : null;

  type Radek = {
    caflouProjectId: string;
    name: string | null;
    company: { hudbuDodavaKlient: boolean; tracklistOdKlienta: boolean } | null;
  };

  const vsechny = (await prisma.projectMeta
    .findMany({
      where: {
        finished: false,
        name: { not: null },
        OR: [
          { klientUserId: session.user.id },
          ...(companyId ? [{ companyId }] : []),
          ...(firma?.name
            ? [{ companyId: null, companyName: { equals: firma.name, mode: 'insensitive' as const } }]
            : []),
        ],
      },
      select: {
        caflouProjectId: true,
        name: true,
        company: { select: { hudbuDodavaKlient: true, tracklistOdKlienta: true } },
      },
      orderBy: { name: 'asc' },
    })
    .catch(() => [])) as Radek[];

  const knihy = vsechny.filter(
    (k) => k.company?.hudbuDodavaKlient === true || k.company?.tracklistOdKlienta === true,
  );

  if (knihy.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-3xl text-ink m-0">{t('hudbaKlientSekce.nadpis')}</h1>
        <p className="text-sm font-body text-muted m-0">{t('hudbaKlientSekce.zadne')}</p>
      </div>
    );
  }

  const vybrany = knihy.find((k) => k.caflouProjectId === searchParams.projekt) ?? knihy[0];
  const dodavaHudbu = vybrany.company?.hudbuDodavaKlient === true;
  const dodavaTracklist = vybrany.company?.tracklistOdKlienta === true;
  const token = await zajistiVyzvu(vybrany.caflouProjectId, {
    email: session.user.email ?? '',
    jmeno: session.user.name ?? null,
  });
  const uzJe = await coUzJeVlozeno(vybrany.caflouProjectId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl text-ink m-0">{t('hudbaKlientSekce.nadpis')}</h1>
        <p className="text-sm font-body text-muted m-0 max-w-2xl">
          {t('hudbaKlientSekce.popis')}
        </p>
      </div>

      {/* SEZNAM KNIH. U každé je vidět, co už dorazilo - ať klient nemusí
          klikat dovnitř, aby zjistil, kde ještě něco chybí. */}
      <nav className="flex flex-wrap gap-2">
        {knihy.map((k) => {
          const aktivni = k.caflouProjectId === vybrany.caflouProjectId;
          return (
            <Link
              key={k.caflouProjectId}
              href={`/hudba-tracklist?projekt=${encodeURIComponent(k.caflouProjectId)}`}
              className={`rounded-card border px-4 py-2.5 font-heading font-semibold text-sm no-underline transition-colors ${
                aktivni
                  ? 'border-brand-purple bg-tint text-brand-purpleDark'
                  : 'border-line bg-surface text-ink hover:bg-field'
              }`}
            >
              {k.name ?? k.caflouProjectId}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-card border border-line bg-surface p-5 flex flex-col gap-6">
        <h2 className="font-display text-2xl text-ink m-0">
          {vybrany.name ?? vybrany.caflouProjectId}
        </h2>

        {token ? (
          <>
            {dodavaHudbu && (
              <HudbaOdKlienta token={token} jazyk={jazyk} uzVlozeno={uzJe.hudba} />
            )}
            {dodavaTracklist && (
              <div className="border-t border-line pt-6">
                <TracklistOdKlienta
                  token={token}
                  caflouProjectId={vybrany.caflouProjectId}
                  nazevProjektu={vybrany.name ?? ''}
                  pocatecni={await nactiTracklist(vybrany.caflouProjectId)}
                  jazyk={jazyk}
                />
              </div>
            )}
          </>
        ) : (
          <p className="text-sm font-body text-muted m-0">{t('hudbaKlientSekce.zadne')}</p>
        )}
      </div>
    </div>
  );
}
