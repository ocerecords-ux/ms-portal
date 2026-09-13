/**
 * NATÁČECÍ PROTOKOL — co se s projektem dělalo, kdy a kam se to dostalo.
 * Zapisuje to Bruno z chatu projektu, tady se to jen čte; další řádek se do
 * protokolu dostane tím, že ho někdo napíše do kanálu.
 *
 * MÁ VLASTNÍ ZÁLOŽKU (zadání 13. 9. 2026: „Natáčecí protokol přesuňme do
 * zvláštní záložky a nechme i v detailu u toho herce jen odznak"). Předtím
 * visel pod hercem přímo v detailu projektu a u delšího natáčení odtlačil
 * všechno ostatní dolů. U herce zůstává jen odznak s poslední stranou;
 * kdo chce celou cestu, otevře si tuhle záložku.
 *
 * A PROTO SE UŽ NEKRÁTÍ: pod hercem se vypisovalo jen osm posledních řádků,
 * aby to nezabralo půl stránky. Ve vlastní záložce je místa dost a smysl
 * protokolu je právě v tom, že je celý.
 *
 * ŠEST SLOUPCŮ (zadání 13. 9. 2026): Natáčení/střih, Herec, Datum, Čas
 * zápisu, Zapsal, Strana. Datum i čas jsou z jednoho okamžiku — kdy zápis
 * vznikl; čas je zvlášť, protože v jeden den bývá zápisů víc a jejich pořadí
 * je to jediné, co je rozliší.
 */

/**
 * Druh úkonu. Bruno zatím zapisuje jen strany z natáčení, takže je to
 * konstanta — ale stojí ve vlastním sloupci, protože se chystá i střih
 * (zadání 13. 9. 2026: „do toho Natáčecího protokolu později přidáme
 * i střih"). Až přibude, přečte se z dat a zbytek tabulky zůstane, jak je;
 * model `brunoNatoceno` k tomu zatím pole nemá.
 */
const UKON = 'Natáčení';

/**
 * Kdo zápis pořídil. Taky konstanta: do protokolu píše jedině Bruno, který
 * čte chat projektu. Sloupec tu je proto, aby bylo z protokolu poznat, že
 * čísla nezadával člověk ručně.
 */
const ZAPSAL = 'Bruno';

/** Čas zápisu ve 24h tvaru — vteřiny by v protokolu nic nepřidaly. */
function cas(kdy: string): string {
  return new Date(kdy).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

const TRIDA_ZAHLAVI =
  'text-left px-4 py-2 text-xs font-heading text-muted uppercase tracking-wide font-semibold whitespace-nowrap';

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
      {/* Sest sloupcu se na uzkem okne nevejde - tabulka se posune, stranka ne. */}
      <div className="rounded-card border border-line overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-field">
              <th className={TRIDA_ZAHLAVI}>Natáčení/střih</th>
              <th className={TRIDA_ZAHLAVI}>Herec</th>
              <th className={TRIDA_ZAHLAVI}>Datum</th>
              <th className={TRIDA_ZAHLAVI}>Čas zápisu</th>
              <th className={TRIDA_ZAHLAVI}>Zapsal</th>
              <th className={`${TRIDA_ZAHLAVI} text-right`}>Strana</th>
            </tr>
          </thead>
          <tbody>
            {zaznamy.map((z) => (
              <tr key={z.id} className="border-t border-line">
                <td className="px-4 py-2 text-sm font-heading text-ink whitespace-nowrap">{UKON}</td>
                {/* Herec chybi, kdyz se ve zprave nevyjasnilo, koho se strana
                    tyka - u projektu s jedinym hercem to nikdo psat nemusel. */}
                <td className="px-4 py-2 text-sm font-heading text-ink whitespace-nowrap">
                  {z.jmeno ?? <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-2 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                  {new Date(z.kdy).toLocaleDateString('cs-CZ')}
                </td>
                <td className="px-4 py-2 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                  {cas(z.kdy)}
                </td>
                <td className="px-4 py-2 text-sm font-heading text-muted whitespace-nowrap">{ZAPSAL}</td>
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
