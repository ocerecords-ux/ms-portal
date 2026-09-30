import { ValecProgresu } from '@/components/ValecProgresu';
import type { ProgresProjektu } from '@/lib/progresNataceniServer';

/**
 * PROGRES NATÁČENÍ V DETAILU PROJEKTU (zadání 19. 9. 2026: „hlavně my
 * v detailu projektu"). Nahoře celý projekt, pod ním každý herec zvlášť -
 * u knihy s víc herci je každý jinde.
 *
 * Počítá se: poslední zapsaná strana (Natáčecí protokol / Bruno) proti
 * rozsahu textu. Rozsah je počet stran PDF ve složce projektu, a když tam
 * PDF není, normostrany projektu (29. 9. 2026: „strany tam už jsou. Já tam
 * ale chci progres!!! procentama"). Dotočeno = 100 %.
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

  /**
   * CO NESEDÍ (30. 9. 2026). Dřív se rozpory schovaly do nuly - herec se
   * zapsanou stranou 222 a dílem 325-670 ukazoval 0 % a „zbývá 346 stran",
   * takže to vypadalo jako pomalé natáčení, ne jako špatná data.
   */
  const jmeno = (id: string) => herci.find((h) => h.id === id)?.jmeno ?? 'herec';
  const chybiNs = (progres?.bezNormostran ?? []).map(jmeno);
  const nesoulad = progres?.nesoulad ?? null;
  const rozpory = herci.filter((h) => progres?.herci[h.id]?.mimoDil);
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
          musíme to vždycky přepočítat"). Je vidět, aby šel zkontrolovat -
          podle něj se dělí text mezi herce. */}
      {koef && !zNormostran && herci.length > 1 && (
        <p className="text-xs font-body text-muted m-0 -mt-2">
          Koeficient téhle knihy: {koef.stranPdf} stran PDF ÷ {koef.normostrany} normostran ={' '}
          <strong className="font-heading font-semibold text-ink">
            {koef.stranNaNs.toFixed(2)}
          </strong>{' '}
          strany PDF na normostranu. Podle něj vychází díl každého herce z jeho normostran.
        </p>
      )}

      <ValecProgresu velky progres={progres?.celkem ?? null} prazdne="Zatím se nedá spočítat - chybí text nebo zápis strany." />

      {herci.length > 1 && (
        <ul className="list-none m-0 p-0 flex flex-col gap-3 border-t border-line pt-4">
          {herci.map((h) => (
            <li key={h.id} className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] items-center gap-x-4 gap-y-1">
              <span className="font-heading font-semibold text-sm text-ink truncate">{h.jmeno}</span>
              <ValecProgresu progres={progres?.herci[h.id] ?? null} prazdne="zatím bez zápisu" />
            </li>
          ))}
        </ul>
      )}

      {(chybiNs.length > 0 || nesoulad || rozpory.length > 0) && (
        <div className="border-t border-line pt-4 flex flex-col gap-2">
          {chybiNs.length > 0 && (
            <p className="text-xs font-body text-danger m-0">
              Bez normostran: {chybiNs.join(', ')}. Dokud rozsah chybí, portál text mezi herce
              nedělí a počítá každého proti celé knize — procenta jsou proto nižší, než jsou ve
              skutečnosti. Doplňte rozsah u herce níž v Výrobě.
            </p>
          )}
          {nesoulad && (
            <p className="text-xs font-body text-danger m-0">
              Normostrany herců dávají dohromady {nesoulad.soucetHercu}, ale kniha má{' '}
              {nesoulad.kniha}. Jedno z těch čísel je špatně — díly se zatím dopočítají poměrem,
              ať progres nelže úplně.
            </p>
          )}
          {rozpory.map((h) => (
            <p key={h.id} className="text-xs font-body text-danger m-0">
              {h.jmeno}: zapsaná strana leží před začátkem dílu, který mu vyšel z normostran. Buď
              má špatně zadaný rozsah, nebo se kniha nedělí po sobě (herci se střídají) — pak
              tenhle výpočet na ni nesedí a číslo u něj neplatí.
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
