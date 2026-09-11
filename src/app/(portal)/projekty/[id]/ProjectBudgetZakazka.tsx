const czk = (v: number) => `${Math.round(v).toLocaleString('cs-CZ')} Kč`;

/**
 * Rozpočet projektu, který se nepočítá z normostran (zadání 11. 9. 2026:
 * „rozpočet dej do každé karty projektu, bude se to akorát lišit tím, jestli
 * je to audiokniha nebo reklama").
 *
 * U audioknihy portál rozpočet SPOČÍTÁ — normostrany × sazby, viz
 * ProjectBudget. U reklamy žádné normostrany nejsou a cena se s klientem
 * dohodne, takže se bere z toho, co je na papíře: z vystavené faktury, a
 * dokud žádná není, z nabídky. Proti tomu stojí, co nás to zatím stálo —
 * výkazy zvukařů a výdaje navázané na projekt.
 *
 * Všechno bez DPH: daň projektu nevydělá ani nesežere.
 */
export function ProjectBudgetZakazka({
  cena,
  zdrojCeny,
  spent,
  hoursLogged,
  vydaje,
}: {
  /** Cena zakázky bez DPH v korunách; null = není z čeho ji vzít. */
  cena: number | null;
  zdrojCeny: 'faktura' | 'nabidka' | null;
  /** Vykázané peníze podle výkazů zvukařů. */
  spent: number;
  hoursLogged: number;
  /** Výdaje navázané na projekt (honoráře, studio…), bez DPH. */
  vydaje: number;
}) {
  const naklady = spent + vydaje;
  const percent = cena && cena > 0 ? Math.round((naklady / cena) * 100) : 0;
  const over = cena != null && naklady > cena;

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Rozpočet</h2>
        <span className="text-xs font-body text-muted">
          {zdrojCeny === 'faktura'
            ? 'Cena podle vystavené faktury'
            : zdrojCeny === 'nabidka'
              ? 'Cena podle nabídky'
              : 'Cena zakázky zatím není'}
        </span>
      </div>

      <table className="w-full text-sm font-heading">
        <tbody>
          <tr>
            <td className="py-1 text-ink">Cena zakázky</td>
            <td className="py-1 text-muted whitespace-nowrap">
              {zdrojCeny === 'faktura' ? 'fakturováno' : zdrojCeny === 'nabidka' ? 'nabídnuto' : '—'}
            </td>
            <td className="py-1 text-ink tabular-nums text-right">{cena == null ? '—' : czk(cena)}</td>
          </tr>
          <tr>
            <td className="py-1 text-ink">Práce (výkazy)</td>
            <td className="py-1 text-muted tabular-nums whitespace-nowrap">
              {hoursLogged > 0 ? `${hoursLogged.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} h` : '—'}
            </td>
            <td className="py-1 text-ink tabular-nums text-right">{czk(spent)}</td>
          </tr>
          <tr>
            <td className="py-1 text-ink">Výdaje</td>
            <td className="py-1 text-muted whitespace-nowrap">honoráře, studio…</td>
            <td className="py-1 text-ink tabular-nums text-right">{czk(vydaje)}</td>
          </tr>
          <tr className="border-t border-line">
            <td className="pt-2 text-ink font-semibold">Náklady celkem</td>
            <td></td>
            <td className="pt-2 text-ink tabular-nums text-right font-semibold">{czk(naklady)}</td>
          </tr>
        </tbody>
      </table>

      {cena != null && cena > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Čerpání</span>
            <span className={`text-sm font-heading font-semibold tabular-nums ${over ? 'text-danger' : 'text-ink'}`}>
              {czk(naklady)} z {czk(cena)} · {percent} %
            </span>
          </div>
          <div className="h-2.5 w-full rounded-pill bg-line overflow-hidden">
            <div
              className={`h-full rounded-pill ${over ? 'bg-red-500' : percent >= 80 ? 'bg-status-progress' : 'bg-brand-green'}`}
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
        </div>
      )}

      <div className="border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">Zisk</span>
          {cena == null ? (
            <span className="text-sm font-body text-muted">
              Dokud u projektu není nabídka ani faktura, nemá portál cenu odkud vzít.
            </span>
          ) : (
            <span className="text-sm font-heading text-ink tabular-nums">
              {czk(cena)} − {czk(naklady)} ={' '}
              <strong className={cena - naklady >= 0 ? 'text-brand-greenDeep' : 'text-danger'}>
                {czk(cena - naklady)}
              </strong>
            </span>
          )}
        </div>
        <p className="text-xs font-body text-muted mt-1 m-0">
          Všechno bez DPH. Doklady se přidávají v záložce Doklady.
        </p>
      </div>
    </div>
  );
}
