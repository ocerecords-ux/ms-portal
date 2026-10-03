import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { nactiJazyk } from '@/lib/jazykServer';
import { formatDatum, kodJazyka, prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/**
 * HONORÁŘE HERCE (zadání 19. 9. 2026: „uděláme jim tam ještě sekci Honoráře,
 * kde uvidí Navrhnuto, Čeká na proplacení, Zaplaceno").
 *
 * Zdrojem je SMLOUVA s hercem a z ní založený výdaj (lib/contractsServer.ts
 * → zalozVydajZeSmlouvy):
 *  - NAVRHNUTO          smlouva je odeslaná a čeká na podpis herce (SENT),
 *  - ČEKÁ NA PROPLACENÍ smlouva je podepsaná, výdaj ještě není zaplacený,
 *  - ZAPLACENO          výdaj ze smlouvy je označený jako zaplacený.
 * Rozpracovanou (DRAFT), odmítnutou a zrušenou smlouvu herec nevidí.
 *
 * Herec vidí VÝHRADNĚ své smlouvy - podle účtu (actorUserId) nebo podle
 * e-mailu, na který smlouva šla. Nikdy podle parametru z prohlížeče.
 */
export const dynamic = 'force-dynamic';

type Castka = { minor: number; mena: string } | null;
type Polozka = {
  id: string;
  projekt: string;
  cislo: string;
  castka: Castka;
  /** Když se odměna nedá vyjádřit číslem („5 000 Kč za natáčecí den"). */
  castkaText: string | null;
  datum: string | null;
  /** Stránka smlouvy - k podpisu, nebo podepsaná i s doložkou (19. 9. 2026). */
  odkaz: string;
  kPodpisu: boolean;
};

function penize(c: Castka, jazyk: Jazyk): string {
  if (!c) return '–';
  const hodnota = c.minor / 100;
  return new Intl.NumberFormat(kodJazyka(jazyk), {
    style: 'currency',
    currency: c.mena,
    maximumFractionDigits: Number.isInteger(hodnota) ? 0 : 2,
  }).format(hodnota);
}

function datum(d: Date | null | undefined, jazyk: Jazyk): string | null {
  return d ? formatDatum(jazyk, d) : null;
}

/** Součet po měnách - „12 000 Kč + 300 €". */
function soucet(polozky: Polozka[], jazyk: Jazyk): string {
  const mapa = new Map<string, number>();
  for (const p of polozky) if (p.castka) mapa.set(p.castka.mena, (mapa.get(p.castka.mena) ?? 0) + p.castka.minor);
  if (mapa.size === 0)
    return prelozit(jazyk, polozky.length > 0 ? 'honorare.vizSmlouvy' : 'honorare.nula');
  return Array.from(mapa.entries())
    .map(([mena, minor]) => penize({ minor, mena }, jazyk))
    .join(' + ');
}

/** Který tvar čísla použít - česky tři, anglicky dva (pravidlo 7). */
function tvarSmluv(n: number): 'jedna' | 'nekolik' | 'mnoho' {
  if (n === 1) return 'jedna';
  return n >= 2 && n <= 4 ? 'nekolik' : 'mnoho';
}

export default async function HonorarePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'HEREC') redirect('/projekty');

  const jazyk = nactiJazyk();
  const email = session.user.email?.trim();
  const smlouvy = await prisma.contract.findMany({
    where: {
      status: { in: ['SENT', 'SIGNED'] },
      OR: [
        { actorUserId: session.user.id },
        ...(email ? [{ signerEmail: { equals: email, mode: 'insensitive' as const } }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      number: true,
      title: true,
      projectName: true,
      status: true,
      odmenaText: true,
      accessToken: true,
      sentAt: true,
      completedAt: true,
      vydajId: true,
    },
  });

  const vydajIds = smlouvy.map((s) => s.vydajId).filter((v): v is string => !!v);
  const vydaje = vydajIds.length
    ? await prisma.expense.findMany({
        where: { id: { in: vydajIds } },
        select: { id: true, amountExVatMinor: true, vatRate: true, currency: true, paid: true, paidAt: true, dueDate: true },
      })
    : [];
  const vydajPodleId = new Map(vydaje.map((v) => [v.id, v]));

  const navrhnuto: Polozka[] = [];
  const ceka: Polozka[] = [];
  const zaplaceno: Polozka[] = [];

  for (const s of smlouvy) {
    const vydaj = s.vydajId ? vydajPodleId.get(s.vydajId) : undefined;
    // Herec dostane částku včetně DPH (když ji má) - to mu přijde na účet.
    const castka: Castka =
      vydaj && vydaj.amountExVatMinor > 0
        ? { minor: Math.round(vydaj.amountExVatMinor * (1 + vydaj.vatRate / 100)), mena: vydaj.currency }
        : null;
    const zaklad = {
      id: s.id,
      projekt: s.projectName || s.title,
      cislo: s.number,
      castka,
      castkaText: castka ? null : s.odmenaText?.trim() || null,
      // Smlouva je dostupna vzdy - i podepsana (zadani 19. 9. 2026: „meli by
      // se tam dostat i na smlouvy podepsane").
      odkaz: `/smlouva/${s.accessToken}`,
      kPodpisu: s.status === 'SENT',
    };

    if (s.status === 'SENT') {
      navrhnuto.push({ ...zaklad, datum: datum(s.sentAt, jazyk) });
    } else if (vydaj?.paid) {
      zaplaceno.push({ ...zaklad, datum: datum(vydaj.paidAt, jazyk) });
    } else {
      ceka.push({ ...zaklad, datum: datum(vydaj?.dueDate ?? null, jazyk) });
    }
  }

  const sekce = [
    {
      klic: 'navrhnuto',
      nadpis: prelozit(jazyk, 'honorare.navrhnuto'),
      popis: prelozit(jazyk, 'honorare.navrhnutoPopis'),
      datumPopis: prelozit(jazyk, 'honorare.odeslano'),
      polozky: navrhnuto,
      barva: 'text-status-progress',
      prazdne: prelozit(jazyk, 'honorare.navrhnutoPrazdne'),
    },
    {
      klic: 'ceka',
      nadpis: prelozit(jazyk, 'honorare.ceka'),
      popis: prelozit(jazyk, 'honorare.cekaPopis'),
      datumPopis: prelozit(jazyk, 'honorare.splatnost'),
      polozky: ceka,
      barva: 'text-brand-purpleDeep dark:text-brand-purpleLight',
      prazdne: prelozit(jazyk, 'honorare.cekaPrazdne'),
    },
    {
      klic: 'zaplaceno',
      nadpis: prelozit(jazyk, 'honorare.zaplaceno'),
      popis: prelozit(jazyk, 'honorare.zaplacenoPopis'),
      datumPopis: prelozit(jazyk, 'honorare.zaplaceno'),
      polozky: zaplaceno,
      barva: 'text-brand-greenDeep',
      prazdne: prelozit(jazyk, 'honorare.zaplacenoPrazdne'),
    },
  ];

  return (
    <section className="flex flex-col gap-8">
      <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">{prelozit(jazyk, 'honorare.nadpis')}</h1>

      {/* Tri souhrny nahore - na prvni pohled, kolik je v kterem stavu. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {sekce.map((s) => (
          <a
            key={s.klic}
            href={`#${s.klic}`}
            className="bg-surface border border-line rounded-card p-4 no-underline hover:bg-surfaceSoft transition-colors"
          >
            <p className="m-0 text-xs font-heading uppercase tracking-wide text-muted">{s.nadpis}</p>
            <p className={`m-0 mt-1 font-display text-2xl ${s.barva}`}>{soucet(s.polozky, jazyk)}</p>
            <p className="m-0 mt-1 text-xs font-body text-muted">
              {prelozitS(jazyk, `honorare.pocetSmluv.${tvarSmluv(s.polozky.length)}`, {
                pocet: s.polozky.length,
              })}
            </p>
          </a>
        ))}
      </div>

      {sekce.map((s) => (
        <div key={s.klic} id={s.klic} className="scroll-mt-24">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">{s.nadpis}</h2>
          <p className="text-xs font-body text-muted m-0 mt-1 mb-3">{s.popis}</p>
          <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
            {s.polozky.length === 0 ? (
              <p className="m-0 px-4 py-6 text-center text-sm font-body text-muted">{s.prazdne}</p>
            ) : (
              <ul className="list-none m-0 p-0">
                {s.polozky.map((p) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_9rem_9rem_7rem] items-center gap-x-4 gap-y-1 px-4 py-3 border-t border-line first:border-t-0"
                  >
                    <div className="min-w-0">
                      <p className="m-0 font-heading font-semibold text-sm text-ink">{p.projekt}</p>
                      <p className="m-0 text-xs font-body text-muted">
                        {prelozitS(jazyk, 'honorare.smlouvaCislo', { cislo: p.cislo })}
                      </p>
                    </div>
                    <p className="m-0 text-right font-heading font-semibold text-sm text-ink tabular-nums">
                      {p.castka ? penize(p.castka, jazyk) : p.castkaText || '–'}
                    </p>
                    <p className="m-0 text-xs font-body text-muted sm:text-right">
                      {p.datum ? prelozitS(jazyk, 'honorare.datumSPopisem', { popis: s.datumPopis, datum: p.datum }) : ''}
                    </p>
                    <div className="text-right">
                      {p.kPodpisu ? (
                        <Link
                          href={p.odkaz}
                          className="inline-block text-xs font-heading font-semibold rounded-pill bg-brand-purple text-white px-4 py-2 no-underline"
                        >
                          {prelozit(jazyk, 'honorare.podepsat')}
                        </Link>
                      ) : (
                        <Link
                          href={p.odkaz}
                          target="_blank"
                          className="inline-block text-xs font-heading font-semibold rounded-pill border border-line text-ink px-4 py-2 no-underline hover:bg-surfaceSoft"
                        >
                          {prelozit(jazyk, 'honorare.smlouvaOdkaz')}
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
