import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { WORK_TYPE_LABELS } from '@/lib/timesheets';
import { nactiKnihyPrehled, prvniRokVykazu, type DruhFiltr, type Kniha } from '@/lib/knihyPrehledServer';
import { KnihyFiltry } from '../KnihyFiltry';
import { GrafPrace } from '../GrafPrace';
import { GrafKnih } from '../GrafKnih';
import { BARVY, datum, hodiny, kc, pocetKnih } from '../format';

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

  const obdobi = searchParams?.obdobi || 'tento';
  const kdo = searchParams?.kdo || '';
  const druh = DRUHY.includes(searchParams?.druh ?? '') ? (searchParams!.druh as string) : '';
  const { od, do: doData } = rozsah(obdobi, searchParams?.od ?? '', searchParams?.do ?? '');

  const [data, prvniRok] = await Promise.all([
    nactiKnihyPrehled({ od, do: doData, kdo: kdo || null, druh: (druh || null) as DruhFiltr }),
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
        ← Zpět na ukazatele
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
        Období {datum(od)} – {datum(posledniDen)}
        {vybranyClovek ? ` · jen ${vybranyClovek}` : ''}
        {druh ? ` · jen ${WORK_TYPE_LABELS[druh as keyof typeof WORK_TYPE_LABELS]}` : ''}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Dlazdice
          nazev="Mzdové náklady"
          hodnota={kc(souhrn.castka)}
          pozn={`${souhrn.vykazu} ${souhrn.vykazu === 1 ? 'výkaz' : souhrn.vykazu >= 2 && souhrn.vykazu <= 4 ? 'výkazy' : 'výkazů'}`}
        />
        <Dlazdice nazev="Odpracováno" hodnota={hodiny(souhrn.hodiny)} pozn={`${data.lide.length} lidí`} />
        <Dlazdice
          nazev="Natáčení / střih"
          hodnota={`${Math.round(souhrn.nataceni.hodiny)} / ${Math.round(souhrn.strih.hodiny)} h`}
          pozn={`${kc(souhrn.nataceni.castka)} / ${kc(souhrn.strih.castka)}`}
        />
        <Dlazdice
          nazev="Odevzdané knihy"
          hodnota={String(souhrn.knih)}
          pozn={souhrn.knih === 0 ? 'za období žádná' : pocetKnih(souhrn.knih)}
        />
      </div>

      <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Mzdové náklady po měsících
        </h2>
        <GrafPrace mesice={data.mesice} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Odevzdané knihy po měsících
          </h2>
          <GrafKnih mesice={data.mesice} />
        </section>

        <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Co se odevzdalo
          </h2>
          {data.odevzdane.length === 0 ? (
            <p className="text-sm text-muted m-0">Za vybrané období se neodevzdala žádná kniha.</p>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-3">
              {data.odevzdane.map((m) => (
                <li key={m.klic} className="flex flex-col gap-1">
                  <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">
                    {m.popis} · {pocetKnih(m.knihy.length)}
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
                          {datum(k.datum)}
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
            <p className="text-xs text-muted m-0">
              * Datum z pole Termín dokončení - kniha se odevzdala dřív, než portál vedl historii projektů.
            </p>
          )}
        </section>
      </div>

      <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Kdo na tom dělal
        </h2>
        {data.lide.length === 0 ? (
          <p className="text-sm text-muted m-0">Za vybrané období nikdo nic nevykázal.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body border-collapse">
              <thead>
                <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                  <th className="text-left py-2 pr-3">Člověk</th>
                  <th className="text-right py-2 px-3">Hodin</th>
                  <th className="text-right py-2 px-3">Natáčení</th>
                  <th className="text-right py-2 px-3">Střih</th>
                  <th className="text-right py-2 px-3">Ostatní</th>
                  <th className="text-right py-2 px-3">Projektů</th>
                  <th className="text-right py-2 pl-3">Celkem</th>
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
                    <td className="text-right py-2 px-3 tabular-nums">{hodiny(c.hodiny)}</td>
                    <td className="text-right py-2 px-3 tabular-nums">{kc(c.nataceni)}</td>
                    <td className="text-right py-2 px-3 tabular-nums">{kc(c.strih)}</td>
                    <td className="text-right py-2 px-3 tabular-nums">{kc(c.ostatni)}</td>
                    <td className="text-right py-2 px-3 tabular-nums text-muted">{c.projektu}</td>
                    <td className="text-right py-2 pl-3 tabular-nums font-heading font-semibold">{kc(c.castka)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted m-0">Kliknutím na jméno se přehled i výkazy zúží jen na něj.</p>
      </section>

      <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Knihy: rozpočet, čerpání a zisk
        </h2>
        {data.knihy.length === 0 ? (
          <p className="text-sm text-muted m-0">
            Za vybrané období se na žádné knize nepracovalo ani se žádná neodevzdala.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body border-collapse">
              <thead>
                <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                  <th className="text-left py-2 pr-3">Kniha</th>
                  <th className="text-right py-2 px-3">NS</th>
                  <th className="text-right py-2 px-3">Rozpočet</th>
                  <th className="text-left py-2 px-3 min-w-[120px]">Vyčerpáno</th>
                  <th className="text-right py-2 px-3">Tržba</th>
                  <th className="text-right py-2 px-3">Náklady</th>
                  <th className="text-right py-2 px-3">Zisk</th>
                  <th className="text-right py-2 pl-3">Marže</th>
                </tr>
              </thead>
              <tbody>
                {data.knihy.map((k) => (
                  <RadekKnihy key={k.id} kniha={k} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted m-0">
          Rozpočet i čerpání jsou za CELOU knihu, ne za období - strop se počítá na knihu, ne na měsíc. Tržba jsou
          vydané faktury na projekt; kde ještě žádná není, je to odhad z normostran a sazby klienta (označený ~).
          Náklady = výkazy zvukařů za celou knihu plus zařazené výdaje navázané na projekt.
        </p>
      </section>

      {(kdo || druh) && (
        <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Výkazy {vybranyClovek ? `– ${vybranyClovek}` : ''}
          </h2>
          {data.vykazy.length === 0 ? (
            <p className="text-sm text-muted m-0">Za vybrané období tu žádný výkaz není.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body border-collapse">
                <thead>
                  <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                    <th className="text-left py-2 pr-3">Datum</th>
                    {!kdo && <th className="text-left py-2 px-3">Kdo</th>}
                    <th className="text-left py-2 px-3">Druh</th>
                    <th className="text-left py-2 px-3">Projekt</th>
                    <th className="text-right py-2 px-3">Hodin</th>
                    <th className="text-right py-2 pl-3">Částka</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vykazy.slice(0, 200).map((v) => (
                    <tr key={v.id} className="border-t border-line">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{datum(v.datum)}</td>
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
                                    : BARVY.ostatni,
                            }}
                          />
                          {WORK_TYPE_LABELS[v.druh]}
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
                      <td className="text-right py-1.5 px-3 tabular-nums">{hodiny(v.minut / 60)}</td>
                      <td className="text-right py-1.5 pl-3 tabular-nums">{kc(v.castka)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.vykazy.length > 200 && (
            <p className="text-xs text-muted m-0">
              Zobrazeno prvních 200 výkazů z {data.vykazy.length}. Zužte období nebo druh práce.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function RadekKnihy({ kniha: k }: { kniha: Kniha }) {
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
      <td className="text-right py-2 px-3 tabular-nums whitespace-nowrap">{kc(k.rozpocet)}</td>
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
        <span className="block text-xs text-muted tabular-nums">{kc(k.vycerpano)}</span>
      </td>
      <td className="text-right py-2 px-3 tabular-nums whitespace-nowrap">
        {k.trzba > 0 ? `${k.trzbaOdhad ? '~' : ''}${kc(k.trzba)}` : '—'}
      </td>
      <td className="text-right py-2 px-3 tabular-nums whitespace-nowrap">{kc(k.naklady)}</td>
      <td
        className={`text-right py-2 px-3 tabular-nums whitespace-nowrap font-heading font-semibold ${k.zisk < 0 ? 'text-danger' : 'text-ink'}`}
      >
        {k.trzba > 0 ? kc(k.zisk) : '—'}
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
