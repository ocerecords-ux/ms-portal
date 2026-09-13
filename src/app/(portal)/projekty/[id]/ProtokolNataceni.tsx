/**
 * NATÁČECÍ PROTOKOL — datum a strana, na které se ten den skončilo, od
 * nejnovějšího. Zapisuje to Bruno z chatu projektu, tady se to jen čte;
 * další řádek se do protokolu dostane tím, že ho někdo napíše do kanálu.
 *
 * MÁ VLASTNÍ ZÁLOŽKU (zadání 13. 9. 2026: „Natáčecí protokol přesuňme do
 * zvláštní záložky a nechme i v detailu u toho herce jen odznak"). Předtím
 * visel pod hercem přímo v přehledu projektu a u delšího natáčení odtlačil
 * všechno ostatní dolů. V přehledu teď zůstává jen odznak s poslední
 * stranou; kdo chce celou cestu, otevře si tuhle záložku.
 *
 * A PROTO SE UŽ NEKRÁTÍ: pod hercem se vypisovalo jen osm posledních řádků,
 * aby to nezabralo půl stránky. Ve vlastní záložce je místa dost a smysl
 * protokolu je právě v tom, že je celý.
 *
 * Jméno herce se vypisuje jen u projektu, kde je herců víc — jinak by ho
 * každý řádek jen opakoval.
 */
export function ProtokolNataceni({
  zaznamy,
}: {
  zaznamy?: { id: string; strana: number; kdy: string; userId: string | null; jmeno: string | null }[];
}) {
  if (!zaznamy || zaznamy.length === 0) {
    return (
      <p className="text-sm font-body text-muted m-0">
        Zatím prázdný. Strany sem zapisuje Bruno podle toho, co se napíše do chatu projektu —
        stačí číslo, třeba „str. 33".
      </p>
    );
  }

  const vice = new Set(zaznamy.map((z) => z.userId)).size > 1;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-body text-muted m-0">
        Kam se doteklo natáčení — zapisuje Bruno z chatu projektu, od nejnovějšího.
      </p>
      <div className="rounded-card border border-line overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-field">
              <th className="text-left px-4 py-2 text-xs font-heading text-muted uppercase tracking-wide font-semibold">
                Datum
              </th>
              <th className="text-right px-4 py-2 text-xs font-heading text-muted uppercase tracking-wide font-semibold">
                Strana
              </th>
              {vice && (
                <th className="text-left px-4 py-2 text-xs font-heading text-muted uppercase tracking-wide font-semibold">
                  Herec
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {zaznamy.map((z) => (
              <tr key={z.id} className="border-t border-line">
                <td className="px-4 py-2 text-sm font-heading text-ink tabular-nums whitespace-nowrap">
                  {new Date(z.kdy).toLocaleDateString('cs-CZ')}
                </td>
                {/* Cislo zelene stejne jako odznak u herce - at je to na obou
                    mistech tataz vec (zadani 13. 9. 2026). */}
                <td className="px-4 py-2 text-sm font-heading font-semibold tabular-nums text-right text-brand-greenDeep dark:text-brand-green">
                  {z.strana}
                </td>
                {vice && (
                  <td className="px-4 py-2 text-sm font-heading text-muted">{z.jmeno ?? 'bez herce'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
