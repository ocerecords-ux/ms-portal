'use client';

import { useState } from 'react';
import { budgetUsedPercent, type Budget } from '@/lib/budget';
import { kodJazyka, type Jazyk } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '../../components/JazykProvider';
import { NakladyProjektu, type NakladovaPolozka } from './NakladyProjektu';

// Částky podle jazyka (dávka 7b) - britsky „1,234 Kč", česky „1 234 Kč".
const czk = (v: number, jazyk: Jazyk) =>
  `${Math.round(v).toLocaleString(kodJazyka(jazyk))} Kč`;

/**
 * Rozpocet audioknihy (zadani 6. 9. 2026) - vidi ho jen Zuzo-labuzo.
 *
 * DVE ODDELENE VECI (zadani 14. 9. 2026):
 *
 * 1. ROZPOCET NA VYROBU - nataceni, strih, bonus. Pocita se z normostran
 *    a proti nemu stoji vykazy zvukaru. Tenhle rozpocet se NEMENI a nic
 *    dalsiho do nej nesmi: „tyto polozky by nemely ovlivnovat rozpocet na
 *    vyrobu ... aby nam to neovlivnovalo, jak rozpocet tece."
 *
 * 2. CELKOVY ROZPOCET - jen u firem, pro ktere delame audioknihy NA KLIC
 *    (zaskrtavatko na karte firmy). Tam platime i herce a obcas jednorazove
 *    veci jako preposlech nebo upravu textu. Od castky, kterou fakturujeme,
 *    se odectou naklady na vyrobu a zvlast tyhle dalsi polozky; co zbyde,
 *    je zisk z knihy.
 *
 * Nataceni a strih zustavaji v celkovem rozpoctu na samostatnych radcich -
 * aby bylo videt, co z nich odchazi, a neslily se s polozkami do jednoho
 * cisla.
 *
 * OPRAVY (zadani 30. 9. 2026: "udelejme ve vykazech dalsi druh prace -
 * Opravy ... bude se to pocitat do rozpoctu"). Rozpocet na vyrobu se kvuli nim
 * NEZVEDA - pocita se z normostran a tech pretacenim neubyva ani nepribyva -
 * ale cerpaji ho, takze se projevi na cerpani i na tom, ze kniha pretekla.
 * V celkovem rozpoctu maji vlastni radek, protoze na rozdil od vsech ostatnich
 * radku nejsou z planu, ale ze skutecnych vykazu.
 *
 * ODKUD JE FAKTUROVANA CASTKA: z cenove nabidky u projektu (zadani
 * 14. 9. 2026: „castka, kterou pak fakturujeme, je znama z cenove nabidky
 * u projektu"). Kdyz nabidka neni, bere se z vystavene faktury, a teprve
 * kdyz neni ani ta, zbyva odhad z normostran krat sazba firmy - to je ale
 * jen odhad a je to u cisla napsane.
 */
export function ProjectBudget({
  budget,
  spent,
  revenue,
  ratePerPage,
  hoursLogged,
  caflouProjectId,
  pocatecniPolozky,
  jmenaHercu,
  naKlic,
  cenaZDokladu,
  zdrojCeny,
  vykazanoOpravy = 0,
}: {
  budget: Budget;
  /** Uz vykazane penize podle vykazu zvukaru. */
  spent: number;
  /** Cena zakazky z normostran x sazba firmy, null kdyz sazba chybi. */
  revenue: number | null;
  ratePerPage: number | null;
  hoursLogged: number;
  caflouProjectId: string;
  pocatecniPolozky: NakladovaPolozka[];
  /** Jména herců jako našeptávač u položek (zadání 14. 9. 2026). */
  jmenaHercu: string[];
  /** Delame pro tuhle firmu audioknihy na klic? (Company.audioknihyNaKlic) */
  naKlic: boolean;
  /** Cena z nabidky, nebo z faktury - viz zdrojCeny. */
  cenaZDokladu: number | null;
  zdrojCeny: 'nabidka' | 'faktura' | null;
  /**
   * Uz vykazane OPRAVY (zadani 30. 9. 2026). Do rozpoctu na vyrobu nevstupuji
   * - ten se pocita z normostran a pretacenim se normostrany nemeni - ale
   * cerpaji ho (jsou soucasti `spent`) a v celkovem rozpoctu ukrajuji ze zisku.
   */
  vykazanoOpravy?: number;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const [polozky, setPolozky] = useState(pocatecniPolozky.reduce((s, p) => s + p.castka, 0));

  const percent = budgetUsedPercent(spent, budget.total);
  const over = spent > budget.total;
  const remaining = budget.total - spent;

  // Co budeme fakturovat. Nabidka/faktura ma prednost pred odhadem z normostran.
  const fakturujeme = cenaZDokladu ?? revenue;
  const popisCeny =
    zdrojCeny === 'nabidka'
      ? t('rozpocet.zCenoveNabidky')
      : zdrojCeny === 'faktura'
        ? t('rozpocet.zVystaveneFaktury')
        : revenue != null
          ? t('rozpocet.odhadZNormostran')
          : '—';
  // Opravy se odectou SKUTECNE vykazane, ne z rozpoctu - zadny nemaji.
  const zisk = fakturujeme != null ? fakturujeme - budget.total - polozky - vykazanoOpravy : null;

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">{t('rozpocet.nadpis')}</h2>
        <span className="text-xs font-body text-muted">
          {t('rozpocet.souhrnNormostrany', {
            pocet: budget.pageCount,
            frekvence: budget.sessions,
            cena: czk(budget.unitPrice, jazyk),
          })}
        </span>
      </div>

      <table className="w-full text-sm font-heading">
        <tbody>
          <tr>
            <td className="py-1 text-ink">{t('rozpocet.nataceni')}</td>
            <td className="py-1 text-muted tabular-nums whitespace-nowrap">
              {budget.sessions} × {czk(budget.unitPrice, jazyk)}
            </td>
            <td className="py-1 text-ink tabular-nums text-right">
              {czk(budget.recordingCost, jazyk)}
            </td>
          </tr>
          <tr>
            <td className="py-1 text-ink">{t('rozpocet.strih')}</td>
            <td className="py-1 text-muted tabular-nums whitespace-nowrap">
              {budget.editingUnits} × {czk(budget.unitPrice, jazyk)}
            </td>
            <td className="py-1 text-ink tabular-nums text-right">
              {czk(budget.editingCost, jazyk)}
            </td>
          </tr>
          <tr>
            <td className="py-1 text-ink">{t('rozpocet.bonus')}</td>
            <td className="py-1 text-muted tabular-nums whitespace-nowrap">
              {budget.pageCount} × {czk(budget.bonus / (budget.pageCount || 1), jazyk)}
            </td>
            <td className="py-1 text-ink tabular-nums text-right">{czk(budget.bonus, jazyk)}</td>
          </tr>
          <tr className="border-t border-line">
            {/* Drive "Naklady celkem". Prejmenovano 14. 9. 2026, at je na prvni
                pohled jasne, ze dalsi polozky sem NEPATRI. */}
            <td className="pt-2 text-ink font-semibold">{t('rozpocet.nakladyNaVyrobu')}</td>
            <td></td>
            <td className="pt-2 text-ink tabular-nums text-right font-semibold">
              {czk(budget.total, jazyk)}
            </td>
          </tr>
        </tbody>
      </table>

      <div>
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">
            {t('rozpocet.cerpani')}
          </span>
          <span className={`text-sm font-heading font-semibold tabular-nums ${over ? 'text-danger' : 'text-ink'}`}>
            {t('rozpocet.zCelkem', {
              cast: czk(spent, jazyk),
              celek: czk(budget.total, jazyk),
              procent: percent,
            })}
          </span>
        </div>
        <div className="h-2.5 w-full rounded-pill bg-line overflow-hidden">
          <div
            className={`h-full rounded-pill ${over ? 'bg-red-500' : percent >= 80 ? 'bg-status-progress' : 'bg-brand-green'}`}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
        <p className="text-xs font-body text-muted mt-1.5 m-0">
          {hoursLogged > 0
            ? t('rozpocet.vykazanoHodin', {
                hodiny: hoursLogged.toLocaleString(kodJazyka(jazyk), { maximumFractionDigits: 1 }),
              })
            : t('rozpocet.zadneVykazy')}{' '}
          {over
            ? t('rozpocet.prekroceno', { castka: czk(spent - budget.total, jazyk) })
            : t('rozpocet.zbyva', { castka: czk(remaining, jazyk) })}{' '}
          {vykazanoOpravy > 0 &&
            t('rozpocet.opravyVCerpani', { castka: czk(vykazanoOpravy, jazyk) })}
        </p>
      </div>

      {/* Firma, pro kterou nedelame na klic: platime jen vyrobu, takze zisk
          je prosty rozdil ceny zakazky a vyroby - jako doted. */}
      {!naKlic && (
        <div className="border-t border-line pt-4 mt-auto">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">
              {t('rozpocet.zisk')}
            </span>
            {revenue == null ? (
              <span className="text-sm font-body text-muted">{t('rozpocet.bezSazby')}</span>
            ) : (
              <span className="text-sm font-heading text-ink tabular-nums">
                {czk(revenue, jazyk)} − {czk(budget.total, jazyk)} ={' '}
                <strong className={revenue - budget.total >= 0 ? 'text-brand-greenDeep' : 'text-danger'}>
                  {czk(revenue - budget.total, jazyk)}
                </strong>
              </span>
            )}
          </div>
          {revenue != null && ratePerPage != null && (
            <p className="text-xs font-body text-muted mt-1 m-0">
              {t('rozpocet.cenaZakazkyVzorec', {
                pocet: budget.pageCount,
                sazba: czk(ratePerPage, jazyk),
              })}
            </p>
          )}
        </div>
      )}

      {naKlic && (
        <>
          <NakladyProjektu
            caflouProjectId={caflouProjectId}
            pocatecni={pocatecniPolozky}
            onZmena={setPolozky}
            jmena={jmenaHercu}
            nadpis={t('rozpocet.dalsiPolozky')}
            napoveda={t('rozpocet.dalsiPolozkyNapoveda')}
          />

          <div className="border-t border-line pt-4 mt-auto">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">
              {t('rozpocet.celkovyRozpocet')}
            </span>
            <table className="w-full text-sm font-heading mt-2">
              <tbody>
                <tr>
                  <td className="py-1 text-ink">{t('rozpocet.fakturujeme')}</td>
                  <td className="py-1 text-muted whitespace-nowrap">{popisCeny}</td>
                  <td className="py-1 text-ink tabular-nums text-right">
                    {fakturujeme == null ? '—' : czk(fakturujeme, jazyk)}
                  </td>
                </tr>
                {/* Nataceni a strih zvlast (zadani 14. 9. 2026) - at je videt,
                    co z ceny ukrajuje vyroba a co az dalsi polozky. */}
                <tr>
                  <td className="py-1 text-muted">− {t('rozpocet.nataceni')}</td>
                  <td></td>
                  <td className="py-1 text-muted tabular-nums text-right">
                    {czk(budget.recordingCost, jazyk)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-muted">− {t('rozpocet.strih')}</td>
                  <td></td>
                  <td className="py-1 text-muted tabular-nums text-right">
                    {czk(budget.editingCost, jazyk)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-muted">− {t('rozpocet.bonus')}</td>
                  <td></td>
                  <td className="py-1 text-muted tabular-nums text-right">{czk(budget.bonus, jazyk)}</td>
                </tr>
                {/* Opravy jsou jediny radek teto tabulky, ktery neni z rozpoctu,
                    ale ze skutecnych vykazu - rozpoctovy radek pro ne neexistuje.
                    Proto se ukazuje, jen kdyz se nejaka oprava opravdu vykazala. */}
                {vykazanoOpravy > 0 && (
                  <tr>
                    <td className="py-1 text-muted">− {t('rozpocet.opravy')}</td>
                    <td className="py-1 text-muted whitespace-nowrap">{t('rozpocet.opravyZVykazu')}</td>
                    <td className="py-1 text-muted tabular-nums text-right">
                      {czk(vykazanoOpravy, jazyk)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="py-1 text-muted">− {t('rozpocet.dalsiPolozky')}</td>
                  <td></td>
                  <td className="py-1 text-muted tabular-nums text-right">{czk(polozky, jazyk)}</td>
                </tr>
                <tr className="border-t border-line">
                  <td className="pt-2 text-ink font-semibold">{t('rozpocet.ziskZKnihy')}</td>
                  <td></td>
                  <td className="pt-2 tabular-nums text-right font-semibold">
                    {zisk == null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className={zisk >= 0 ? 'text-brand-greenDeep' : 'text-danger'}>
                        {czk(zisk, jazyk)}
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
            {fakturujeme == null && (
              <p className="text-xs font-body text-muted mt-1.5 m-0">{t('rozpocet.bezCehoFakturovat')}</p>
            )}
            {fakturujeme != null && zdrojCeny == null && (
              <p className="text-xs font-body text-muted mt-1.5 m-0">
                {t('rozpocet.zatimOdhad', {
                  pocet: budget.pageCount,
                  sazba: czk(ratePerPage ?? 0, jazyk),
                })}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
