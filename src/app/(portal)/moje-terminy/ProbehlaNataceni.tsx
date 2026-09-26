/**
 * PROBĚHLÁ NATÁČENÍ (zadání 19. 9. 2026: „když ty termíny proběhnou, tak se
 * přiřadí do proběhlá natáčení").
 *
 * Potvrzený termín, který už skončil, zmizí z Moje natáčení a objeví se tady -
 * nic se nepřepisuje, rozhoduje jen konec termínu. Běžící frekvence zůstává
 * nahoře, dokud neskončí. Nejnovější nahoře, po měsících; starší měsíce jsou
 * sbalené, ať seznam neroste do nekonečna.
 */
import { kodJazyka, prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

export type ProbehleNataceni = {
  id: string;
  projekt: string;
  start: string;
  end: string;
  studio: string;
  timezone: string;
};

/**
 * Komponenta se vykresluje na serveru (stránku skládá serverová komponenta),
 * takže jazyk dostává propem - usePreklad() by tu spadl. Viz pravidlo 8
 * v docs/preklad-portalu.md.
 */
export function ProbehlaNataceni({ terminy, jazyk }: { terminy: ProbehleNataceni[]; jazyk: Jazyk }) {
  if (terminy.length === 0) return null;

  const kod = kodJazyka(jazyk);
  const cas = (iso: string, tz: string) =>
    new Intl.DateTimeFormat(kod, { timeZone: tz, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(
      new Date(iso),
    );
  const den = (iso: string, tz: string) =>
    new Intl.DateTimeFormat(kod, { timeZone: tz, weekday: 'short', day: 'numeric', month: 'numeric' }).format(
      new Date(iso),
    );
  const mesic = (iso: string, tz: string) =>
    new Intl.DateTimeFormat(kod, { timeZone: tz, month: 'long', year: 'numeric' }).format(new Date(iso));

  const poMesicich = new Map<string, ProbehleNataceni[]>();
  for (const t of terminy) {
    const k = new Intl.DateTimeFormat('en-CA', { timeZone: t.timezone, year: 'numeric', month: '2-digit' }).format(
      new Date(t.start),
    );
    if (!poMesicich.has(k)) poMesicich.set(k, []);
    poMesicich.get(k)!.push(t);
  }
  const mesice = Array.from(poMesicich.entries());

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
        {prelozit(jazyk, 'mojeTerminy.probehla')}{' '}
        <span className="normal-case tracking-normal font-body">({terminy.length})</span>
      </h2>
      {mesice.map(([klic, vMesici], i) => (
        <details
          key={klic}
          open={i === 0}
          className="bg-surface rounded-card border border-line shadow-sm overflow-hidden group"
        >
          <summary className="px-4 sm:px-5 py-2.5 bg-field flex items-baseline justify-between gap-3 cursor-pointer list-none">
            <span className="text-xs font-heading font-semibold text-ink uppercase tracking-wide">
              <span className="inline-block mr-1.5 transition-transform group-open:rotate-90" aria-hidden="true">
                ›
              </span>
              {mesic(vMesici[0].start, vMesici[0].timezone)}
            </span>
            <span className="text-xs font-body text-muted tabular-nums">
              {prelozitS(jazyk, klicFrekvenci(vMesici.length), { pocet: vMesici.length })}
            </span>
          </summary>
          <ul className="list-none p-0 m-0 divide-y divide-line border-t border-line">
            {vMesici.map((t) => (
              <li
                key={t.id}
                className="px-4 sm:px-5 py-3 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[9.5rem_7rem_minmax(0,1fr)_7rem_auto] items-center gap-x-4 gap-y-1"
              >
                <span className="font-heading font-semibold text-muted capitalize">{den(t.start, t.timezone)}</span>
                <span className="font-heading font-semibold text-muted tabular-nums hidden sm:inline">
                  {cas(t.start, t.timezone)}–{cas(t.end, t.timezone)}
                </span>
                <span className="text-sm font-body text-muted truncate hidden sm:inline" title={t.projekt}>
                  {t.projekt}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-sm font-heading text-muted">
                  <span className="w-2 h-2 rounded-full bg-line" aria-hidden="true" />
                  {t.studio}
                </span>
                <span className="sm:hidden col-start-1 text-sm font-body text-muted">
                  <span className="font-heading font-semibold tabular-nums">
                    {cas(t.start, t.timezone)}–{cas(t.end, t.timezone)}
                  </span>{' '}
                  · {t.studio} · {t.projekt}
                </span>
                <span className="row-start-1 col-start-2 sm:row-auto sm:col-auto justify-self-end">
                  <span className="inline-flex items-center rounded-pill bg-field border border-line text-muted px-2.5 py-0.5 text-xs font-heading font-semibold whitespace-nowrap">
                    {prelozit(jazyk, 'mojeTerminy.probehlo')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

/**
 * Skloňování frekvencí (1 / 2-4 / 5+). Anglicky z klíčů vyjde jednotné nebo
 * množné číslo, viz slovník v lib/jazyk.ts.
 */
export function klicFrekvenci(pocet: number): string {
  if (pocet === 1) return 'mojeTerminy.frekvence1';
  if (pocet < 5) return 'mojeTerminy.frekvence234';
  return 'mojeTerminy.frekvence5';
}
