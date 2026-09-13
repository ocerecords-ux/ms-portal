/**
 * NATÁČECÍ PROTOKOL — co se s projektem dělalo, kdy a kam se to dostalo.
 * Zapisuje to Bruno z chatu projektu, tady se to jen čte; další řádek se do
 * protokolu dostane tím, že ho někdo napíše do kanálu.
 *
 * MÁ VLASTNÍ ZÁLOŽKU (zadání 13. 9. 2026: „Natáčecí protokol přesuňme do
 * zvláštní záložky a nechme i v detailu u toho herce jen odznak"). Předtím
 * visel pod hercem přímo v přehledu projektu a u delšího natáčení odtlačil
 * všechno ostatní dolů. U herce teď zůstává jen odznak s poslední stranou;
 * kdo chce celou cestu, otevře si tuhle záložku.
 *
 * A PROTO SE UŽ NEKRÁTÍ: pod hercem se vypisovalo jen osm posledních řádků,
 * aby to nezabralo půl stránky. Ve vlastní záložce je místa dost a smysl
 * protokolu je právě v tom, že je celý.
 *
 * KAŽDÝ ŘÁDEK ZAČÍNÁ ÚKONEM (zadání 13. 9. 2026: „do toho Natáčecího
 * protokolu později přidáme i střih, takže v případě, kdy jde o zápis stran
 * v textu, tam přidej ještě atribut na začátek řádku: Natáčení s hercem
 * a jméno"). Dokud Bruno zapisuje jen strany, je úkon vždycky natáčení —
 * ale stojí v řádku jako samostatný údaj, takže až přibude střih, přidá se
 * do `ukonRadku` větev a zbytek tabulky zůstane, jak je.
 */

/**
 * Úkon na začátku řádku. Zápis strany je vždycky natáčení; jméno herce k němu
 * patří, protože u audioknihy se každý herec dostal jinam.
 *
 * Bez jména (projekt s jediným hercem, kde ho do chatu nikdo nepsal) zůstává
 * holé „Natáčení" — „s hercem —" by jen mátlo.
 */
function ukonRadku(jmeno: string | null): string {
  return jmeno ? `Natáčení s hercem ${jmeno}` : 'Natáčení';
}

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
                Úkon
              </th>
              <th className="text-left px-4 py-2 text-xs font-heading text-muted uppercase tracking-wide font-semibold">
                Datum
              </th>
              <th className="text-right px-4 py-2 text-xs font-heading text-muted uppercase tracking-wide font-semibold">
                Strana
              </th>
            </tr>
          </thead>
          <tbody>
            {zaznamy.map((z) => (
              <tr key={z.id} className="border-t border-line">
                <td className="px-4 py-2 text-sm font-heading text-ink">{ukonRadku(z.jmeno)}</td>
                <td className="px-4 py-2 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                  {new Date(z.kdy).toLocaleDateString('cs-CZ')}
                </td>
                {/* Cislo zelene stejne jako odznak u herce - at je to na obou
                    mistech tataz vec (zadani 13. 9. 2026). */}
                <td className="px-4 py-2 text-sm font-heading font-semibold tabular-nums text-right text-brand-greenDeep dark:text-brand-green">
                  {z.strana}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
