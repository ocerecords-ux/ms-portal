/**
 * POLOŽKY Z ROZPOČTU PROJEKTU DO DOKLADU (zadání 19. 11. 2026: „u dokladů
 * nemůžu stále přidat položku z rozpočtu").
 *
 * Rozpočet zakázky si produkce píše po položkách u projektu (model
 * ProjektNaklad - honorář herce, studio, hudba). Tytéž řádky se pak opisovaly
 * ručně do nabídky i do faktury. Tohle je ta zkratka.
 *
 * ČÁSTKY JSOU V CELÝCH KORUNÁCH BEZ DPH, doklady počítají v haléřích -
 * převod je tady, na jednom místě, ať se nikde neztratí nula.
 */

export type PolozkaRozpoctu = { id: string; nazev: string; castka: number };

export type PolozkaDokladu = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  vatRate: number;
};

/** Načte rozpočet projektu. Když se to nepovede, vrátí prázdno - nic nespadne. */
export async function nactiRozpocetProjektu(caflouProjectId: string): Promise<PolozkaRozpoctu[]> {
  if (!caflouProjectId) return [];
  const res = await fetch(`/api/projekty/${encodeURIComponent(caflouProjectId)}/naklady`).catch(
    () => null,
  );
  if (!res?.ok) return [];
  const data = (await res.json().catch(() => null)) as { polozky?: PolozkaRozpoctu[] } | null;
  return data?.polozky ?? [];
}

/**
 * Co z rozpočtu v dokladu ještě NENÍ. Porovnává se podle popisu bez ohledu na
 * velikost písmen - dvakrát „Hudba" v jedné nabídce nikdo nechce.
 */
export function chybejiciZRozpoctu(
  rozpocet: PolozkaRozpoctu[],
  polozky: { description: string }[],
): PolozkaRozpoctu[] {
  const uz = new Set(polozky.map((p) => p.description.trim().toLowerCase()).filter(Boolean));
  return rozpocet.filter((r) => r.nazev.trim() && !uz.has(r.nazev.trim().toLowerCase()));
}

/**
 * Přidá chybějící řádky rozpočtu k položkám dokladu. Prázdný řádek, který
 * v dokladu visí po založení, se zahodí - jinak by zůstal viset nahoře.
 */
export function sPolozkamiZRozpoctu<T extends PolozkaDokladu>(
  polozky: T[],
  rozpocet: PolozkaRozpoctu[],
  prazdna: () => T,
): T[] {
  const chybi = chybejiciZRozpoctu(rozpocet, polozky);
  if (chybi.length === 0) return polozky;
  const bezPrazdnych = polozky.filter((p) => p.description.trim() || p.unitPriceMinor);
  return [
    ...bezPrazdnych,
    ...chybi.map((r) => ({
      ...prazdna(),
      description: r.nazev.trim(),
      quantity: 1,
      unitPriceMinor: Math.round(r.castka * 100),
    })),
  ];
}
