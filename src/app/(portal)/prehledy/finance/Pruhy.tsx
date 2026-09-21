import { kc } from './format';

/**
 * Vodorovné pruhy „kdo/co kolik" - klienti podle obratu, kategorie podle
 * nákladů. Jedna barva (jde o velikost, ne o rozlišení), u každého pruhu
 * název i částka, takže barva nic nenese sama. Prvních osm, zbytek v „Ostatní".
 */
export function Pruhy({ radky, barva }: { radky: { nazev: string; castka: number }[]; barva: string }) {
  if (radky.length === 0) return <p className="text-sm text-muted m-0">Nic za vybrané období.</p>;

  const MAX = 8;
  const zobrazene = radky.slice(0, MAX);
  if (radky.length > MAX) {
    zobrazene.push({
      nazev: `Ostatní (${radky.length - MAX})`,
      castka: radky.slice(MAX).reduce((s, r) => s + r.castka, 0),
    });
  }
  const nejvic = Math.max(...zobrazene.map((r) => r.castka), 1);
  const celkem = radky.reduce((s, r) => s + r.castka, 0);

  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
      {zobrazene.map((r) => (
        <li key={r.nazev} className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-3 text-sm font-body">
            <span className="text-ink truncate">{r.nazev}</span>
            <span className="text-ink tabular-nums whitespace-nowrap">
              {kc(r.castka)}
              <span className="text-muted text-xs ml-1.5">
                {celkem > 0 ? `${Math.round((r.castka / celkem) * 100)} %` : ''}
              </span>
            </span>
          </span>
          <span className="block h-2 rounded-full bg-field overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(1, (r.castka / nejvic) * 100)}%`, backgroundColor: barva }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
