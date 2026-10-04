import { ValecProgresu } from '@/components/ValecProgresu';
import type { ProgresProjektu } from '@/lib/progresNataceniServer';
import { prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/**
 * Tvar čísla u stran textu. Česky „stranu / strany / stran", anglicky stačí
 * jednotné a množné číslo - proto tři klíče a ne skládání z kousků
 * (pravidlo 7 v docs/preklad-portalu.md).
 */
function klicStran(pocet: number): string {
  if (pocet === 1) return 'progresKarta.textMaJednu';
  if (pocet <= 4) return 'progresKarta.textMaMalo';
  return 'progresKarta.textMaVic';
}

/**
 * PROGRES NATÁČENÍ V DETAILU PROJEKTU (zadání 19. 9. 2026: „hlavně my
 * v detailu projektu"). Nahoře celý projekt, pod ním každý herec zvlášť.
 *
 * Počítá se: poslední zapsaná strana (Natáčecí protokol / Bruno) proti
 * rozsahu textu. Rozsah je počet stran PDF ve složce projektu, a když tam
 * PDF není, normostrany projektu (29. 9. 2026: „strany tam už jsou. Já tam
 * ale chci progres!!! procentama"). Dotočeno = 100 %.
 *
 * Herci se knihou pohybují SPOLEČNĚ od začátku do konce - každý čte své
 * rozházené kapitoly (1. 10. 2026). Proto je u každého stejná metrika: jak
 * daleko je v textu. Co se u nich liší, je kolik normostran jim z toho ještě
 * zbývá natočit - a podle toho se plánují frekvence.
 */
export function ProgresNataceniKarta({
  progres,
  herci,
  jazyk,
}: {
  progres: ProgresProjektu | null;
  herci: { id: string; jmeno: string }[];
  /** Jazyk PROPEM - kartu kreslí serverová stránka (pravidlo 8). */
  jazyk: Jazyk;
}) {
  const stran = progres?.stranTextu ?? null;
  const zNormostran = progres?.zdrojCelku === 'ns';

  const jmeno = (id: string) =>
    herci.find((h) => h.id === id)?.jmeno ?? prelozit(jazyk, 'progresKarta.zalohaHerce');
  const chybiNs = (progres?.bezNormostran ?? []).map(jmeno);
  const nesoulad = progres?.nesoulad ?? null;
  const koef = progres?.koeficient ?? null;

  return (
    <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {prelozit(jazyk, 'progresKarta.nadpis')}
        </h2>
        <span className="text-xs font-body text-muted">
          {stran
            ? zNormostran
              ? prelozitS(jazyk, 'progresKarta.zNormostran', { stran })
              : prelozitS(jazyk, klicStran(stran), { stran })
            : prelozit(jazyk, 'progresKarta.bezCehoPocitat')}
        </span>
      </div>

      {/* KOEFICIENT TÉHLE KNIHY (30. 9. 2026: „u každé knihy spočítat
          koeficient převodu z pdf na normostrany… každá kniha bude mít jiný,
          musíme to vždycky přepočítat"). K čemu je: převádí zbývající strany
          textu na normostrany, a to je jednotka, ve které se plánují
          frekvence. */}
      {koef && !zNormostran && (
        <p className="text-xs font-body text-muted m-0 -mt-2">
          {prelozitS(jazyk, 'progresKarta.koeficientPred', {
            ns: koef.normostrany,
            stran: koef.stranPdf,
          })}
          <strong className="font-heading font-semibold text-ink">
            {koef.nsNaStranu.toFixed(2)}
          </strong>
          {prelozit(jazyk, 'progresKarta.koeficientZa')}
        </p>
      )}

      <ValecProgresu
        velky
        progres={progres?.celkem ?? null}
        prazdne={prelozit(jazyk, 'progresKarta.nedaSpocitat')}
      />

      {herci.length > 1 && (
        <ul className="list-none m-0 p-0 flex flex-col gap-3 border-t border-line pt-4">
          {herci.map((h) => {
            const svuj = progres?.herci[h.id] ?? null;
            return (
              <li key={h.id} className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] items-center gap-x-4 gap-y-1">
                <span className="font-heading font-semibold text-sm text-ink truncate">{h.jmeno}</span>
                <div className="flex flex-col gap-0.5">
                  <ValecProgresu progres={svuj} prazdne={prelozit(jazyk, 'progresKarta.bezZapisu')} />
                  {/* Jediné číslo, které se u herců liší a k něčemu je: kolik
                      normostran mu zbývá, tedy kolik frekvencí mu naplánovat. */}
                  {svuj && svuj.zbyvaNs !== null && svuj.vahaNs !== null && !svuj.dotoceno && (
                    <span className="text-xs font-body text-muted tabular-nums">
                      {prelozit(jazyk, 'progresKarta.zbyvaPred')}
                      <strong className="font-heading font-semibold text-ink">
                        {prelozitS(jazyk, 'progresKarta.zbyvaNs', { pocet: svuj.zbyvaNs })}
                      </strong>
                      {prelozitS(jazyk, 'progresKarta.zbyvaZa', { celkem: svuj.vahaNs })}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(chybiNs.length > 0 || nesoulad) && (
        <div className="border-t border-line pt-4 flex flex-col gap-2">
          {chybiNs.length > 0 && (
            <p className="text-xs font-body text-danger m-0">
              {prelozitS(jazyk, 'progresKarta.bezNormostran', { jmena: chybiNs.join(', ') })}
            </p>
          )}
          {nesoulad && (
            <p className="text-xs font-body text-danger m-0">
              {prelozitS(jazyk, 'progresKarta.nesoulad', {
                soucet: nesoulad.soucetHercu,
                kniha: nesoulad.kniha,
              })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
