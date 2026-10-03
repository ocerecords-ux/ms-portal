import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nazevDruhuPrace } from '@/lib/timesheets';
import { nactiKnihyPrehled, prvniRokVykazu, type DruhFiltr, type Kniha } from '@/lib/knihyPrehledServer';
import { KnihyFiltry } from '../KnihyFiltry';
import { GrafPrace } from '../GrafPrace';
import { GrafKnih } from '../GrafKnih';
import { BARVY, datum, hodiny, kc, pocetKnih } from '../format';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/**
 * PODROBNÝ ROZPAD (zadání 28. 9. 2026 pro Petera, zjednodušeno tentýž den:
 * „ten přehled Knihy a rozpočty bych potřeboval zjednodušit. Něco podobného,
 * jako mám palubovku. Jasné ukazatele.").
 *
 * Hlavní záložka je od té chvíle přehled s budíky - tohle je to, co bylo
 * předtím: filtry, grafy, tabulka lidí a výpis výkazů. Zůstává schválně:
 * budíky řeknou, ŽE něco teče, tohle je místo, kde se dá dohledat proč
 * v libovolném období, ne jen za tenhle a minulý měsíc.
 *
 * Čtyři otázky, čtyři části stránky:
 *   1. Kolik nás to za období stálo a za co - dlaždice a graf po měsících.
 *   2. Kdo na tom dělal - tabulka lidí, klik přepne filtr na jednoho a vypíše
 *      jeho výkazy.
 *   3. Jak si stojí jednotlivé knihy proti rozpočtu a kolik na nich zbylo -
 *      tabulka s čerpáním, tržbou, náklady a ziskem.
 *   4. Co se kdy odevzdalo - graf a jmenný seznam po měsících.
 *
 * Jen pro admina (Žůžo-labůžo): jsou to mzdové údaje celého týmu a marže knih.
 * Jak se co počítá a proč, je v lib/knihyPrehledServer.ts.
 */
export const dynamic = 'force-dynamic';

const DRUHY = ['RECORDING', 'EDITING', 'OTHER'];

/** Rozsah období z výběru v adrese. `do` je první den PO období. */
function rozsah(obdobi: string, od: string, doData: string): { od: Date; do: Date } {
  const ted = new Date();
  const rok = ted.getUTCFullYear();
  const mesic = ted.getUTCMonth();
  const prvniDen = (r: number, m: number) => new Date(Date.UTC(r, m, 1));

  if (obdobi === 'minuly') return { od: prvniDen(rok, mesic - 1), do: prvniDen(rok, mesic) };
  if (obdobi === '3m') return { od: prvniDen(rok, mesic - 2), do: prvniDen(rok, mesic + 1) };
  if (obdobi === '12m') return { od: prvniDen(rok, mesic - 11), do: prvniDen(rok, mesic + 1) };
  if (/^\d{4}$/.test(obdobi)) return { od: prvniDen(Number(obdobi), 0), do: prvniDen(Number(obdobi) + 1, 0) };
  if (obdobi === 'vlastni') {
    const zacatek = /^\d{4}-\d{2}-\d{2}$/.test(od) ? new Date(`${od}T00:00:00Z`) : prvniDen(rok, mesic);
    // „Do" se zadává včetně toho dne, uvnitř se počítá bez něj - proto +1 den.
    const konec = /^\d{4}-\d{2}-\d{2}$/.test(doData)
      ? new Date(new Date(`${doData}T00:00:00Z`).getTime() + 86400000)
      : prvniDen(rok, mesic + 1);
    return konec > zacatek ? { od: zacatek, do: konec } : { od: zacatek, do: new Date(zacatek.getTime() + 86400000) };
  }
  return { od: prvniDen(rok, mesic), do: prvniDen(rok, mesic + 1) };
}

function proPole(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function RozpadPage({
  searchParams,
}: {
  searchParams?: { obdobi?: string; od?: string; do?: string; kdo?: string; druh?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/prehledy');

  const jazyk = nactiJazyk();
  const obdobi = searchParams?.obdobi || 'tento';
  const kdo = searchParams?.kdo || '';
  const druh = DRUHY.includes(searchParams?.druh ?? '') ? (searchParams!.druh as string) : '';
  const { od, do: doData } = rozsah(obdobi, searchParams?.od ?? '', searchParams?.do ?? '');

  const [data, prvniRok] = await Promise.all([
    nactiKnihyPrehled({ od, do: doData, kdo: kdo || null, druh: (druh || null) as DruhFiltr, jazyk }),
    prvniRokVykazu(),
  ]);

  const letos = new Date().getUTCFullYear();
  const roky: number[] = [];
  for (let r = letos; r >= Math.min(prvniRok, letos); r--) roky.push(r);

  const { souhrn } = data;
  const vybranyClovek = kdo ? (data.zvukari.find((z) => z.id === kdo)?.jmeno ?? null) : null;
  // Poslední den období - „do" je první den po něm.
  const posledniDen = new Date(doData.getTime() - 86400000);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/prehledy/knihy"
        className="self-start text-sm font-heading font-semibold text-brand-purple no-underline hover:underline"
      >
        {prelozit(jazyk, 'rozpad.zpetNaUkazatele')}
      </Link>

      <KnihyFiltry
        obdobi={obdobi}
        od={searchParams?.od || proPole(od)}
        do={searchParams?.do || proPole(posledniDen)}
        roky={roky}
        kdo={kdo}
        zvukari={data.zvukari}
        druh={druh}
      />

      <p className="text-xs font-body text-muted m-0">
        {prelozitS(jazyk, 'rozpad.obdobi', { od: datum(od, jazyk), do: datum(posledniDen, jazyk) })}
        {vybranyClovek ? prelozitS(jazyk, 'rozpad.jenClovek', { jmeno: vybranyClovek }) : ''}
        {druh
          ? prelozitS(jazyk, 'rozpad.jenDruh', {
              druh: nazevDruhuPrace(druh as Parameters<typeof nazevDruhuPrace>[0], jazyk),
            })
          : ''}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Dlazdice
          nazev={prelozit(jazyk, 'rozpad.mzdoveNaklady')}
          hodnota={kc(souhrn.castka, jazyk)}
          pozn={prelozitS(jazyk, `rozpad.pocetVykazu.${tvarPoctu(souhrn.vykazu)}`, {
            pocet: souhrn.vykazu,
          })}
        />
        <Dlazdice
          nazev={prelozit(jazyk, 'rozpad.odpracovano')}
          hodnota={hodiny(souhrn.hodiny, jazyk)}
          pozn={prelozitS(jazyk, 'rozpad.lidi', { pocet: data.lide.length })}
        />
        <Dlazdice
          nazev={prelozit(jazyk, 'rozpad.nataceniStrih')}
          hodnota={`${Math.round(souhrn.nataceni.hodiny)} / ${Math.round(souhrn.strih.hodiny)} h`}
          pozn={`${kc(souhrn.nataceni.castka, jazyk)} / ${kc(souhrn.strih.castka, jazyk)}`}
        />
        <Dlazdice
          nazev={prelozit(jazyk, 'rozpad.odevzdaneKnihy')}
          hodnota={String(souhrn.knih)}
          pozn={
            souhrn.knih === 0
              ? prelozit(jazyk, 'rozpad.zaObdobiZadna')
              : pocetKnih(souhrn.knih, jazyk)
          }
        />
      </div>

      <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {prelozit(jazyk, 'rozpad.mzdyPoMesicich')}
        </h2>
        <GrafPrace mesice={data.mesice} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {prelozit(jazyk, 'rozpad.knihyPoMesicich')}
          </h2>
          <GrafKnih mesice={data.mesice} />
        </section>

        <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {prelozit(jazyk, 'rozpad.coSeOdevzdalo')}
          </h2>
          {data.odevzdane.length === 0 ? (
            <p className="text-sm text-muted m-0">{prelozit(jazyk, 'rozpad.zadnaKniha')}</p>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-3">
              {data.odevzdane.map((m) => (
                <li key={m.klic} className="flex flex-col gap-1">
                  <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">
                    {prelozitS(jazyk, 'rozpad.mesicKnih', {
                      mesic: m.popis,
                      knih: pocetKnih(m.knihy.length, jazyk),
                    })}
                  </span>
                  <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
                    {m.knihy.map((k) => (
                      <li key={k.id} className="text-sm font-body flex items-baseline gap-2">
                        <Link
                          href={`/projekty/${encodeURIComponent(k.id)}`}
                          className="text-ink no-underline hover:text-brand-purple truncate"
                        >
                          {k.nazev}
                        </Link>
                        <span className="text-xs text-muted whitespace-nowrap ml-auto">
                          {datum(k.datum, jazyk)}
                          {k.odhad ? ' *' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {data.odevzdane.some((m) => m.knihy.some((k) => k.odhad)) && (
            <p className="text-xs text-muted m-0">{prelozit(jazyk, 'rozpad.poznamkaOdhadu')}</p>
          )}
        </section>
      </div>

      <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {prelozit(jazyk, 'rozpad.kdoNaTomDelal')}
        </h2>
        {data.lide.length === 0 ? (
          <p className="text-sm text-muted m-0">{prelozit(jazyk, 'rozpad.nikdoNevykazal')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body border-collapse">
              <thead>
                <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                  <th className="text-left py-2 pr-3">{prelozit(jazyk, 'rozpad.clovek')}</th>
                  <th className="text-right py-2 px-3">{prelozit(jazyk, 'rozpad.hodin')}</th>
                  <th className="text-right py-2 px-3">{prelozit(jazyk, 'knihy.nataceni')}</th>
                  <th className="text-right py-2 px-3">{prelozit(jazyk, 'knihy.strih')}</th>
                  <th className="text-right py-2 px-3">{prelozit(jazyk, 'knihy.opravy')}</th>
                  <th className="text-right py-2 px-3">{prelozit(jazyk, 'knihy.ostatni')}</th>
                  <th className="text-right py-2 px-3">{prelozit(jazyk, 'rozpad.projektu')}</th>
                  <th className="text-right py-2 pl-3">{prelozit(jazyk, 'knihy.celkem')}</th>
                </tr>
              </thead>
              <tbody>
                {data.lide.map((c) => (
                  <tr key={c.id} className={`border-t border-line ${kdo === c.id ? 'bg-tint' : ''}`}>
                    <td className="py-2 pr-3">
                      <Link
                        href={`?${new URLSearchParams({
                          ...(obdobi !== 'tento' ? { obdobi } : {}),
                          ...(searchParams?.od ? { od: searchParams.od } : {}),
                          ...(searchParams?.do ? { do: searchParams.do } : {}),
                          ...(druh ? { druh } : {}),
                          ...(kdo === c.id ? {} : { kdo: c.id }),
                        }).toString()}`}
                        className="text-ink no-underline hover:text-brand-purple font-heading font-semibold"
                      >
                        {c.jmeno}
                      </Link>
                    </td>
                    <td className="text-right py-2 px-3 tabular-nums">{hodiny(c.hodiny, jazyk)}</td>
                    <td className="text-right py-2 px-3 tabular-nums">{kc(c.nataceni, jazyk)}</td>
                    <td className="text-right py-2 px-3 tabular-nums">{kc(c.strih, jazyk)}</td>
                    <td className="text-right py-2 px-3 tabular-nums">{kc(c.opravy, jazyk)}</td>
                    <td className="text-right py-2 px-3 tabular-nums">{kc(c.ostatni, jazyk)}</td>
                    <td className="text-right py-2 px-3 tabular-nums text-muted">{c.projektu}</td>
                    <td className="text-right py-2 pl-3 tabular-nums font-heading font-semibold">{kc(c.castka, jazyk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted m-0">{prelozit(jazyk, 'rozpad.poznamkaJmena')}</p>
      </section>

      <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {prelozit(jazyk, 'rozpad.knihyNadpis')}
        </h2>
        {data.knihy.length === 0 ? (
          <p className="text-sm text-muted m-0">{prelozit(jazyk, 'rozpad.knihyPrazdne')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body border-collapse">
              <thead>
                <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                  <th className="text-left py-2 pr-3">{prelozit(jazyk, 'rozpad.kniha')}</th>
                  <th className="text-right py-2 px-3">{prelozit(jazyk, 'rozpad.ns')}</th>
                  <th className="text-right py-2 px-3">{prelozit(jazyk, 'knihy.rozpocet')}</th>
                  <th className="text-left py-2 px-3 min-w-[120px]">{prelozit(jazyk, 'knihy.vycerpano')}</th>
                  <th className="text-right py-2 px-3">{prelozit(jazyk, 'knihy.trzba')}</th>
                  <th className="text-right py-2 px-3">{prelozit(jazyk, 'knihy.naklady')}</th>
                  <th className="text-right py-2 px-3">{prelozit(jazyk, 'finance.zisk')}</th>
                  <th className="text-right py-2 pl-3">{prelozit(jazyk, 'finance.marze')}</th>
                </tr>
              </thead>
              <tbody>
                {data.knihy.map((k) => (
                  <RadekKnihy key={k.id} kniha={k} jazyk={jazyk} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted m-0">{prelozit(jazyk, 'rozpad.poznamkaKnih')}</p>
      </section>

      {(kdo || druh) && (
        <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {vybranyClovek
              ? prelozitS(jazyk, 'rozpad.vykazyClovek', { jmeno: vybranyClovek })
              : prelozit(jazyk, 'rozpad.vykazy')}
          </h2>
          {data.vykazy.length === 0 ? (
            <p className="text-sm text-muted m-0">{prelozit(jazyk, 'rozpad.zadnyVykaz')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body border-collapse">
                <thead>
                  <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                    <th className="text-left py-2 pr-3">{prelozit(jazyk, 'rozpad.datum')}</th>
                    {!kdo && <th className="text-left py-2 px-3">{prelozit(jazyk, 'knihy.kdo')}</th>}
                    <th className="text-left py-2 px-3">{prelozit(jazyk, 'rozpad.druh')}</th>
                    <th className="text-left py-2 px-3">{prelozit(jazyk, 'finance.projekt')}</th>
                    <th className="text-right py-2 px-3">{prelozit(jazyk, 'rozpad.hodin')}</th>
                    <th className="text-right py-2 pl-3">{prelozit(jazyk, 'rozpad.castka')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vykazy.slice(0, 200).map((v) => (
                    <tr key={v.id} className="border-t border-line">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{datum(v.datum, jazyk)}</td>
                      {!kdo && <td className="py-1.5 px-3">{v.jmeno}</td>}
                      <td className="py-1.5 px-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block w-2 h-2 rounded-sm shrink-0"
                            style={{
                              backgroundColor:
                                v.druh === 'RECORDING'
                                  ? BARVY.nataceni
                                  : v.druh === 'EDITING'
                                    ? BARVY.strih
                                    : v.druh === 'REPAIRS'
                                      ? BARVY.opravy
                                      : BARVY.ostatni,
                            }}
                          />
                          {nazevDruhuPrace(v.druh, jazyk)}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 truncate max-w-[280px]">
                        {v.projektId ? (
                          <Link
                            href={`/projekty/${encodeURIComponent(v.projektId)}`}
                            className="text-ink no-underline hover:text-brand-purple"
                          >
                            {v.projekt || v.projektId}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-right py-1.5 px-3 tabular-nums">{hodiny(v.minut / 60, jazyk)}</td>
                      <td className="text-right py-1.5 pl-3 tabular-nums">{kc(v.castka, jazyk)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.vykazy.length > 200 && (
            <p className="text-xs text-muted m-0">
              {prelozitS(jazyk, 'rozpad.prvnich200', { celkem: data.vykazy.length })}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/** Který tvar čísla použít - česky tři, anglicky dva (pravidlo 7). */
function tvarPoctu(n: number): 'jedna' | 'nekolik' | 'mnoho' {
  if (n === 1) return 'jedna';
  return n >= 2 && n <= 4 ? 'nekolik' : 'mnoho';
}

function RadekKnihy({ kniha: k, jazyk }: { kniha: Kniha; jazyk: Jazyk }) {
  const procent = k.rozpocet > 0 ? Math.round((k.vycerpano / k.rozpocet) * 100) : null;
  const prekroceno = procent !== null && procent > 100;
  const marze = k.trzba > 0 ? Math.round((k.zisk / k.trzba) * 100) : null;

  return (
    <tr className="border-t border-line">
      <td className="py-2 pr-3">
        <Link
          href={`/projekty/${encodeURIComponent(k.id)}`}
          className="text-ink no-underline hover:text-brand-purple font-heading font-semibold"
        >
          {k.nazev}
        </Link>
        {k.klient && <span className="block text-xs text-muted truncate">{k.klient}</span>}
      </td>
      <td className="text-right py-2 px-3 tabular-nums text-muted">{k.normostran}</td>
      <td className="text-right py-2 px-3 tabular-nums whitespace-nowrap">{kc(k.rozpocet, jazyk)}</td>
      <td className="py-2 px-3">
        <span className="flex items-center gap-2">
          <span className="block h-2 flex-1 min-w-[56px] rounded-full bg-field overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.min(100, procent ?? 0)}%`,
                backgroundColor: prekroceno ? 'rgb(var(--c-danger))' : BARVY.nataceni,
              }}
            />
          </span>
          <span
            className={`text-xs tabular-nums whitespace-nowrap ${prekroceno ? 'text-danger font-heading font-semibold' : 'text-muted'}`}
          >
            {procent === null ? '—' : `${procent} %`}
          </span>
        </span>
        <span className="block text-xs text-muted tabular-nums">{kc(k.vycerpano, jazyk)}</span>
      </td>
      <td className="text-right py-2 px-3 tabular-nums whitespace-nowrap">
        {k.trzba > 0 ? `${k.trzbaOdhad ? '~' : ''}${kc(k.trzba, jazyk)}` : '—'}
      </td>
      <td className="text-right py-2 px-3 tabular-nums whitespace-nowrap">{kc(k.naklady, jazyk)}</td>
      <td
        className={`text-right py-2 px-3 tabular-nums whitespace-nowrap font-heading font-semibold ${k.zisk < 0 ? 'text-danger' : 'text-ink'}`}
      >
        {k.trzba > 0 ? kc(k.zisk, jazyk) : '—'}
      </td>
      <td className="text-right py-2 pl-3 tabular-nums text-muted">{marze === null ? '—' : `${marze} %`}</td>
    </tr>
  );
}

function Dlazdice({ nazev, hodnota, pozn }: { nazev: string; hodnota: string; pozn?: string }) {
  return (
    <div className="bg-surface border border-line rounded-card shadow-sm p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">{nazev}</span>
      <span className="font-display text-2xl sm:text-3xl text-ink tabular-nums truncate">{hodnota}</span>
      {pozn && <span className="text-xs font-body text-muted truncate">{pozn}</span>}
    </div>
  );
}
