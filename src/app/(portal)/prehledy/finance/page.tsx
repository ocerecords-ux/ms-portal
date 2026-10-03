import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { nactiFinance, prvniRokDokladu, type Krok, type Zaklad } from '@/lib/financeServer';
import { FinanceFiltry } from './FinanceFiltry';
import { FinanceGraf } from './FinanceGraf';
import { Pruhy } from './Pruhy';
import { kc } from './format';
import { nactiJazyk } from '@/lib/jazykServer';
import { kodJazyka, prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/**
 * OBRAT A ZISK (zadání 21. 9. 2026: „chci do přehledu novou záložku, kde
 * uvidím celkový obrat a zisk i s grafy a možnostmi výběru").
 *
 * Jen pro admina - jsou to peníze firmy. Výběr (období, firma, co se počítá,
 * po měsících/čtvrtletích) je v adrese, takže jde přehled poslat odkazem.
 * Jak se co počítá, je v lib/financeServer.ts.
 */
export const dynamic = 'force-dynamic';

export default async function FinancePage({
  searchParams,
}: {
  searchParams?: { obdobi?: string; firma?: string; zaklad?: string; krok?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/prehledy');

  const jazyk = nactiJazyk();
  const ted = new Date();
  const letos = ted.getUTCFullYear();
  const obdobi = searchParams?.obdobi === '12m' ? '12m' : String(Number(searchParams?.obdobi) || letos);
  const zaklad: Zaklad = searchParams?.zaklad === 'uhrazeno' ? 'uhrazeno' : 'vystaveno';
  const krok: Krok = searchParams?.krok === 'ctvrtleti' ? 'ctvrtleti' : 'mesic';
  const firma = searchParams?.firma || null;

  const od =
    obdobi === '12m'
      ? new Date(Date.UTC(letos, ted.getUTCMonth() - 11, 1))
      : new Date(Date.UTC(Number(obdobi), 0, 1));
  const doData =
    obdobi === '12m' ? new Date(Date.UTC(letos, ted.getUTCMonth() + 1, 1)) : new Date(Date.UTC(Number(obdobi) + 1, 0, 1));

  const [data, prvniRok, firmy] = await Promise.all([
    nactiFinance({ od, do: doData, firma, zaklad, krok }),
    prvniRokDokladu(),
    prisma.issuerCompany.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], select: { id: true, name: true } }),
  ]);

  const roky: number[] = [];
  for (let r = letos; r >= Math.min(prvniRok, letos); r--) roky.push(r);

  const { souhrn, predchozi } = data;
  const marze = souhrn.obrat > 0 ? Math.round((souhrn.zisk / souhrn.obrat) * 1000) / 10 : null;
  const popisPredchozi =
    obdobi === '12m'
      ? prelozit(jazyk, 'finance.predchozich12')
      : prelozitS(jazyk, 'finance.predchoziRok', { rok: Number(obdobi) - 1 });

  const nicTu = souhrn.faktur === 0 && souhrn.vydaju === 0;
  /**
   * DPH (zadání 30. 9. 2026: „ještě bych v těch přehledech potřeboval vidět,
   * kolik máme odvádět DPH"). Karta se ukáže, jen když nějaká daň je - u
   * neplátce nebo u samých nulových sazeb by to byly tři nuly bez obsahu.
   */
  const jeDph = souhrn.dphVystupni !== 0 || souhrn.dphVstupni !== 0;

  return (
    <div className="flex flex-col gap-5">
      <FinanceFiltry
        obdobi={obdobi}
        roky={roky}
        firma={firma ?? ''}
        firmy={firmy}
        zaklad={zaklad}
        krok={krok}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Dlazdice jazyk={jazyk} nazev={prelozit(jazyk, 'finance.obrat')} hodnota={souhrn.obrat} minule={predchozi.obrat} popisMinule={popisPredchozi}
          pozn={prelozitS(jazyk, `finance.pocetFaktur.${tvarPoctu(souhrn.faktur)}`, { pocet: souhrn.faktur })} />
        <Dlazdice jazyk={jazyk} nazev={prelozit(jazyk, 'finance.naklady')} hodnota={souhrn.naklady} minule={predchozi.naklady} popisMinule={popisPredchozi}
          pozn={prelozitS(jazyk, `finance.pocetVydaju.${tvarPoctu(souhrn.vydaju)}`, { pocet: souhrn.vydaju })} naklad />
        <Dlazdice jazyk={jazyk} nazev={prelozit(jazyk, 'finance.zisk')} hodnota={souhrn.zisk} minule={predchozi.zisk} popisMinule={popisPredchozi} />
        <div className="bg-surface border border-line rounded-card shadow-sm p-4 flex flex-col gap-1">
          <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">{prelozit(jazyk, 'finance.marze')}</span>
          <span className="font-display text-2xl sm:text-3xl text-ink tabular-nums">
            {marze === null ? '—' : `${marze.toLocaleString(kodJazyka(jazyk))} %`}
          </span>
          <span className="text-xs font-body text-muted">{prelozit(jazyk, 'finance.ziskZObratu')}</span>
        </div>
      </div>

      {nicTu ? (
        <p className="bg-surface border border-line rounded-card p-6 text-sm text-muted m-0">
          {prelozit(jazyk, 'finance.nicTu')}
        </p>
      ) : (
        <>
          <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              {prelozit(jazyk, krok === 'mesic' ? 'finance.grafNadpis.mesic' : 'finance.grafNadpis.ctvrtleti')}
            </h2>
            <FinanceGraf useky={data.useky} />
          </section>

          {jeDph && (
            <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4">
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                  {prelozit(jazyk, 'finance.dph')}
                </h2>
                <span className="text-xs font-body text-muted">
                  {prelozit(jazyk, zaklad === 'vystaveno' ? 'finance.dphPodleVystaveni' : 'finance.dphPodleUhrady')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <DphDlazdice
                  jazyk={jazyk}
                  nazev={prelozit(jazyk, 'finance.dphNaVystupu')}
                  hodnota={souhrn.dphVystupni}
                  popis={prelozit(jazyk, 'finance.dphNaVystupuPopis')}
                />
                <DphDlazdice
                  jazyk={jazyk}
                  nazev={prelozit(jazyk, 'finance.dphNaVstupu')}
                  hodnota={souhrn.dphVstupni}
                  popis={prelozit(jazyk, 'finance.dphNaVstupuPopis')}
                />
                <DphDlazdice
                  jazyk={jazyk}
                  nazev={prelozit(jazyk, souhrn.dphOdvod < 0 ? 'finance.dphNadmernyOdpocet' : 'finance.dphKOdvedeni')}
                  hodnota={Math.abs(souhrn.dphOdvod)}
                  popis={prelozit(jazyk, souhrn.dphOdvod < 0 ? 'finance.dphZpatkyOdStatu' : 'finance.dphRozdil')}
                  hlavni
                />
              </div>

              {/* Po měsících (nebo čtvrtletích) - podle toho se platí. */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body border-collapse">
                  <thead>
                    <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                      <th className="text-left py-2 pr-3">
                        {prelozit(jazyk, krok === 'mesic' ? 'finance.mesic' : 'finance.ctvrtletiSloupec')}
                      </th>
                      <th className="text-right py-2 px-3">{prelozit(jazyk, 'finance.dphNaVystupu')}</th>
                      <th className="text-right py-2 px-3">{prelozit(jazyk, 'finance.dphNaVstupu')}</th>
                      <th className="text-right py-2 pl-3">{prelozit(jazyk, 'finance.dphKOdvedeni')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.useky
                      .filter((u) => u.dphVystupni !== 0 || u.dphVstupni !== 0)
                      .map((u) => (
                        <tr key={u.klic} className="border-t border-line">
                          <td className="py-2 pr-3 whitespace-nowrap">{u.popis}</td>
                          <td className="text-right py-2 px-3 tabular-nums whitespace-nowrap">{kc(u.dphVystupni, jazyk)}</td>
                          <td className="text-right py-2 px-3 tabular-nums whitespace-nowrap text-muted">
                            {kc(u.dphVstupni, jazyk)}
                          </td>
                          <td
                            className={`text-right py-2 pl-3 tabular-nums whitespace-nowrap font-heading ${
                              u.dphOdvod < 0 ? 'text-status-done' : 'text-ink'
                            }`}
                          >
                            {kc(u.dphOdvod, jazyk)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-muted font-body m-0">{prelozit(jazyk, 'finance.dphPoznamka')}</p>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
              <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                {prelozit(jazyk, 'finance.obratPodleKlientu')}
              </h2>
              <Pruhy jazyk={jazyk} radky={data.klienti.map((k) => ({ nazev: k.nazev, castka: k.obrat }))} barva="var(--viz-obrat)" />
            </section>
            <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
              <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                {prelozit(jazyk, 'finance.nakladyPodleKategorii')}
              </h2>
              <Pruhy jazyk={jazyk} radky={data.kategorie} barva="var(--viz-naklady)" />
            </section>
          </div>

          {data.projekty.length > 0 && (
            <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
              <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                {prelozit(jazyk, 'finance.projekty')}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body border-collapse">
                  <thead>
                    <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                      <th className="text-left py-2 pr-3">{prelozit(jazyk, 'finance.projekt')}</th>
                      <th className="text-right py-2 px-3">{prelozit(jazyk, 'finance.obrat')}</th>
                      <th className="text-right py-2 px-3">{prelozit(jazyk, 'finance.naklady')}</th>
                      <th className="text-right py-2 px-3">{prelozit(jazyk, 'finance.zisk')}</th>
                      <th className="text-right py-2 pl-3">{prelozit(jazyk, 'finance.marze')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projekty.slice(0, 15).map((p) => (
                      <tr key={p.id} className="border-t border-line">
                        <td className="py-2 pr-3">
                          <Link href={`/projekty/${encodeURIComponent(p.id)}`} className="text-ink no-underline hover:text-brand-purple">
                            {p.nazev}
                          </Link>
                        </td>
                        <td className="text-right py-2 px-3 tabular-nums whitespace-nowrap">{kc(p.obrat, jazyk)}</td>
                        <td className="text-right py-2 px-3 tabular-nums whitespace-nowrap">{kc(p.naklady, jazyk)}</td>
                        <td className={`text-right py-2 px-3 tabular-nums whitespace-nowrap font-heading ${p.zisk < 0 ? 'text-danger' : 'text-ink'}`}>
                          {kc(p.zisk, jazyk)}
                        </td>
                        <td className="text-right py-2 pl-3 tabular-nums text-muted">
                          {p.obrat > 0 ? `${Math.round((p.zisk / p.obrat) * 100)} %` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.projekty.length > 15 && (
                <p className="text-xs text-muted m-0">
                  {prelozitS(jazyk, 'finance.zobrazeno15', { celkem: data.projekty.length })}
                </p>
              )}
            </section>
          )}
        </>
      )}

      <p className="text-xs text-muted font-body m-0">
        {prelozit(jazyk, 'finance.poznamkaMena')}{' '}
        {prelozit(jazyk, zaklad === 'vystaveno' ? 'finance.poznamkaVystaveno' : 'finance.poznamkaUhrazeno')}
      </p>
    </div>
  );
}

/** Který tvar čísla použít - česky tři, anglicky dva (pravidlo 7). */
function tvarPoctu(n: number): 'jedna' | 'nekolik' | 'mnoho' {
  if (n === 1) return 'jedna';
  return n >= 2 && n <= 4 ? 'nekolik' : 'mnoho';
}

/** Dlaždice v kartě DPH - bez srovnání s minulým obdobím, jen číslo a věta. */
function DphDlazdice({
  jazyk,
  nazev,
  hodnota,
  popis,
  hlavni,
}: {
  jazyk: Jazyk;
  nazev: string;
  hodnota: number;
  popis: string;
  hlavni?: boolean;
}) {
  return (
    <div
      className={`rounded-card p-4 flex flex-col gap-1 min-w-0 border ${
        hlavni ? 'border-brand-purple/40 bg-brand-purple/5' : 'border-line bg-field/40'
      }`}
    >
      <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">{nazev}</span>
      <span className="font-display text-2xl text-ink tabular-nums truncate">{kc(hodnota, jazyk)}</span>
      <span className="text-xs font-body text-muted">{popis}</span>
    </div>
  );
}

function Dlazdice({
  jazyk,
  nazev,
  hodnota,
  minule,
  popisMinule,
  pozn,
  naklad,
}: {
  jazyk: Jazyk;
  nazev: string;
  hodnota: number;
  minule: number;
  popisMinule: string;
  pozn?: string;
  naklad?: boolean;
}) {
  const zmena = minule !== 0 ? Math.round(((hodnota - minule) / Math.abs(minule)) * 100) : null;
  // U nákladů je růst špatná zpráva, u obratu a zisku dobrá.
  const dobre = zmena === null ? null : naklad ? zmena <= 0 : zmena >= 0;
  return (
    <div className="bg-surface border border-line rounded-card shadow-sm p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">{nazev}</span>
      <span className={`font-display text-2xl sm:text-3xl tabular-nums truncate ${hodnota < 0 ? 'text-danger' : 'text-ink'}`}>
        {kc(hodnota, jazyk)}
      </span>
      <span className="text-xs font-body text-muted">
        {zmena !== null ? (
          <>
            <span className={dobre ? 'text-status-done' : 'text-danger'}>
              {zmena >= 0 ? '▲' : '▼'} {Math.abs(zmena)} %
            </span>{' '}
            {prelozitS(jazyk, 'finance.protiMinule', { popis: popisMinule })}
          </>
        ) : (
          prelozitS(jazyk, 'finance.bezDat', { popis: popisMinule })
        )}
        {pozn ? ` · ${pozn}` : ''}
      </span>
    </div>
  );
}
