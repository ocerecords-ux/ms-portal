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
  const popisPredchozi = obdobi === '12m' ? 'předchozích 12 měsíců' : `rok ${Number(obdobi) - 1}`;

  const nicTu = souhrn.faktur === 0 && souhrn.vydaju === 0;

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
        <Dlazdice nazev="Obrat" hodnota={souhrn.obrat} minule={predchozi.obrat} popisMinule={popisPredchozi}
          pozn={`${souhrn.faktur} ${souhrn.faktur === 1 ? 'faktura' : souhrn.faktur >= 2 && souhrn.faktur <= 4 ? 'faktury' : 'faktur'}`} />
        <Dlazdice nazev="Náklady" hodnota={souhrn.naklady} minule={predchozi.naklady} popisMinule={popisPredchozi}
          pozn={`${souhrn.vydaju} ${souhrn.vydaju === 1 ? 'výdaj' : souhrn.vydaju >= 2 && souhrn.vydaju <= 4 ? 'výdaje' : 'výdajů'}`} naklad />
        <Dlazdice nazev="Zisk" hodnota={souhrn.zisk} minule={predchozi.zisk} popisMinule={popisPredchozi} />
        <div className="bg-surface border border-line rounded-card shadow-sm p-4 flex flex-col gap-1">
          <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">Marže</span>
          <span className="font-display text-2xl sm:text-3xl text-ink tabular-nums">
            {marze === null ? '—' : `${marze.toLocaleString('cs-CZ')} %`}
          </span>
          <span className="text-xs font-body text-muted">zisk z obratu</span>
        </div>
      </div>

      {nicTu ? (
        <p className="bg-surface border border-line rounded-card p-6 text-sm text-muted m-0">
          Za vybrané období tu nejsou žádné faktury ani výdaje.
        </p>
      ) : (
        <>
          <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              Obrat, náklady a zisk {krok === 'mesic' ? 'po měsících' : 'po čtvrtletích'}
            </h2>
            <FinanceGraf useky={data.useky} />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
              <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                Obrat podle klientů
              </h2>
              <Pruhy radky={data.klienti.map((k) => ({ nazev: k.nazev, castka: k.obrat }))} barva="var(--viz-obrat)" />
            </section>
            <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
              <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                Náklady podle kategorií
              </h2>
              <Pruhy radky={data.kategorie} barva="var(--viz-naklady)" />
            </section>
          </div>

          {data.projekty.length > 0 && (
            <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
              <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                Projekty
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body border-collapse">
                  <thead>
                    <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                      <th className="text-left py-2 pr-3">Projekt</th>
                      <th className="text-right py-2 px-3">Obrat</th>
                      <th className="text-right py-2 px-3">Náklady</th>
                      <th className="text-right py-2 px-3">Zisk</th>
                      <th className="text-right py-2 pl-3">Marže</th>
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
                        <td className="text-right py-2 px-3 tabular-nums whitespace-nowrap">{kc(p.obrat)}</td>
                        <td className="text-right py-2 px-3 tabular-nums whitespace-nowrap">{kc(p.naklady)}</td>
                        <td className={`text-right py-2 px-3 tabular-nums whitespace-nowrap font-heading ${p.zisk < 0 ? 'text-danger' : 'text-ink'}`}>
                          {kc(p.zisk)}
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
                <p className="text-xs text-muted m-0">Zobrazeno 15 projektů s největším obratem z {data.projekty.length}.</p>
              )}
            </section>
          )}
        </>
      )}

      <p className="text-xs text-muted font-body m-0">
        Vše bez DPH, v korunách (cizí měny kurzem ČNB ze dne dokladu).{' '}
        {zaklad === 'vystaveno'
          ? 'Obrat = odeslané a uhrazené faktury podle data zdanitelného plnění; náklady = zařazené výdaje podle data dokladu.'
          : 'Jen uhrazené faktury a výdaje podle data úhrady - peníze, které opravdu přišly a odešly.'}
      </p>
    </div>
  );
}

function Dlazdice({
  nazev,
  hodnota,
  minule,
  popisMinule,
  pozn,
  naklad,
}: {
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
        {kc(hodnota)}
      </span>
      <span className="text-xs font-body text-muted">
        {zmena !== null ? (
          <>
            <span className={dobre ? 'text-status-done' : 'text-danger'}>
              {zmena >= 0 ? '▲' : '▼'} {Math.abs(zmena)} %
            </span>{' '}
            proti {popisMinule}
          </>
        ) : (
          `za ${popisMinule} bez dat`
        )}
        {pozn ? ` · ${pozn}` : ''}
      </span>
    </div>
  );
}
