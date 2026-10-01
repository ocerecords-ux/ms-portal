import { ValecProgresu } from '@/components/ValecProgresu';
import type { ProgresProjektu } from '@/lib/progresNataceniServer';

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
}: {
  progres: ProgresProjektu | null;
  herci: { id: string; jmeno: string }[];
}) {
  const stran = progres?.stranTextu ?? null;
  const zNormostran = progres?.zdrojCelku === 'ns';
  const tvar = (n: number) => (n === 1 ? 'stranu' : n <= 4 ? 'strany' : 'stran');

  const jmeno = (id: string) => herci.find((h) => h.id === id)?.jmeno ?? 'herec';
  const chybiNs = (progres?.bezNormostran ?? []).map(jmeno);
  const nesoulad = progres?.nesoulad ?? null;
  const koef = progres?.koeficient ?? null;

  return (
    <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Progres natáčení
        </h2>
        <span className="text-xs font-body text-muted">
          {stran
            ? zNormostran
              ? `Počítáno z ${stran} normostran — ve složce projektu není PDF s textem (název končí _RE), tak se bere rozsah projektu`
              : `Text má ${stran} ${tvar(stran)} (PDF ve složce projektu)`
            : 'Ve složce projektu není PDF s textem ani zadané normostrany — není proti čemu počítat'}
        </span>
      </div>

      {/* KOEFICIENT TÉHLE KNIHY (30. 9. 2026: „u každé knihy spočítat
          koeficient převodu z pdf na normostrany… každá kniha bude mít jiný,
          musíme to vždycky přepočítat"). K čemu je: převádí zbývající strany
          textu na normostrany, a to je jednotka, ve které se plánují
          frekvence. */}
      {koef && !zNormostran && (
        <p className="text-xs font-body text-muted m-0 -mt-2">
          Koeficient téhle knihy: {koef.normostrany} normostran ÷ {koef.stranPdf} stran textu ={' '}
          <strong className="font-heading font-semibold text-ink">
            {koef.nsNaStranu.toFixed(2)}
          </strong>{' '}
          normostrany na stranu textu. Z něj se dopočítává, kolik normostran komu ještě zbývá.
        </p>
      )}

      <ValecProgresu velky progres={progres?.celkem ?? null} prazdne="Zatím se nedá spočítat - chybí text nebo zápis strany." />

      {herci.length > 1 && (
        <ul className="list-none m-0 p-0 flex flex-col gap-3 border-t border-line pt-4">
          {herci.map((h) => {
            const svuj = progres?.herci[h.id] ?? null;
            return (
              <li key={h.id} className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] items-center gap-x-4 gap-y-1">
                <span className="font-heading font-semibold text-sm text-ink truncate">{h.jmeno}</span>
                <div className="flex flex-col gap-0.5">
                  <ValecProgresu progres={svuj} prazdne="zatím bez zápisu" />
                  {/* Jediné číslo, které se u herců liší a k něčemu je: kolik
                      normostran mu zbývá, tedy kolik frekvencí mu naplánovat. */}
                  {svuj && svuj.zbyvaNs !== null && svuj.vahaNs !== null && !svuj.dotoceno && (
                    <span className="text-xs font-body text-muted tabular-nums">
                      zbývá natočit ≈{' '}
                      <strong className="font-heading font-semibold text-ink">
                        {svuj.zbyvaNs} normostran
                      </strong>{' '}
                      z jeho {svuj.vahaNs}
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
              Bez normostran: {chybiNs.join(', ')}. Bez rozsahu se nedá spočítat, kolik komu zbývá
              natočit, a projekt se místo váženého součtu počítá jako průměr herců. Doplňte rozsah
              u herce níž ve Výrobě.
            </p>
          )}
          {nesoulad && (
            <p className="text-xs font-body text-danger m-0">
              Normostrany herců dávají dohromady {nesoulad.soucetHercu}, ale kniha má{' '}
              {nesoulad.kniha}. Jedno z těch čísel je špatně — poměr mezi herci sedí dál, ale
              zbývající normostrany podle toho nebudou přesné.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
