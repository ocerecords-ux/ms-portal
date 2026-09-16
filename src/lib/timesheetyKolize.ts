import { prisma } from '@/lib/db';
import type { PolozkyVykazu } from '@/lib/timesheetyVstup';

/**
 * DVA VÝKAZY NA STEJNÝ ČAS A PROJEKT (zadání 16. 9. 2026: „ještě by to mělo
 * hlídat, že si zvukař nemůže uložit dva výkazy na stejný čas a projekt").
 *
 * Vzniká to samo: člověk zapíše výkaz, neuvidí ho v seznamu (jiný měsíc,
 * jiná záložka), zapíše ho znovu — a měsíc se pak fakturuje dvakrát.
 *
 * CO SE BLOKUJE:
 *  - stejný den, STEJNÝ PROJEKT a časy, které se překrývají (aspoň o minutu),
 *  - u práce bez projektu („Ostatní") jen ÚPLNĚ STEJNÝ čas. Dvě různé věci
 *    pod hlavičkou „Ostatní" se přes sebe klidně přelít můžou a zavírat
 *    kvůli tomu bránu by bylo horší než ten přesah.
 *
 * CO SE NEBLOKUJE: překryv NA JINÉM PROJEKTU. Zadání mluví o stejném
 * projektu a stává se, že se práce dělí jinak, než jak se sedí u pultu.
 */

export type Kolize = {
  od: number;
  do: number;
  projectName: string | null;
};

/** „Od" a „do" jako HH:MM - do hlášky, ať je vidět, s čím se to bije. */
export function casHHMM(minuty: number): string {
  const h = Math.floor(minuty / 60);
  const m = minuty % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Překrývají se dva intervaly aspoň o minutu? Dotyk konců není překryv. */
export function prekryvaSe(aOd: number, aDo: number, bOd: number, bDo: number): boolean {
  return aOd < bDo && bOd < aDo;
}

/** Jsou to výkazy na tomtéž projektu? Rozhoduje id, a když chybí, název. */
export function stejnyProjekt(
  a: { caflouProjectId: string | null; projectName: string | null },
  b: { caflouProjectId: string | null; projectName: string | null },
): boolean {
  if (a.caflouProjectId && b.caflouProjectId) return a.caflouProjectId === b.caflouProjectId;
  if (a.projectName && b.projectName) {
    return a.projectName.trim().toLowerCase() === b.projectName.trim().toLowerCase();
  }
  // Oba bez projektu = práce typu „Ostatní".
  return !a.caflouProjectId && !b.caflouProjectId && !a.projectName && !b.projectName;
}

/**
 * Najde výkaz, se kterým se ten nový bije. `kromeId` je vlastní záznam při
 * úpravě — sám se sebou se bít nemá.
 */
export async function najdiKolizi(
  userId: string,
  novy: PolozkyVykazu,
  kromeId?: string,
): Promise<Kolize | null> {
  const stejnyDen = await prisma.timesheetEntry.findMany({
    where: {
      userId,
      date: novy.date,
      ...(kromeId ? { id: { not: kromeId } } : {}),
    },
    select: {
      startMinutes: true,
      endMinutes: true,
      caflouProjectId: true,
      projectName: true,
    },
  });

  const bezProjektu = !novy.caflouProjectId && !novy.projectName;

  for (const stary of stejnyDen) {
    if (!stejnyProjekt(novy, stary)) continue;

    const bije = bezProjektu
      ? stary.startMinutes === novy.startMinutes && stary.endMinutes === novy.endMinutes
      : prekryvaSe(novy.startMinutes, novy.endMinutes, stary.startMinutes, stary.endMinutes);

    if (bije) {
      return { od: stary.startMinutes, do: stary.endMinutes, projectName: stary.projectName };
    }
  }
  return null;
}

/** Hláška pro člověka — ať je z ní hned vidět, co už zapsané je. */
export function hlaskaOKolizi(kolize: Kolize): string {
  const cas = `${casHHMM(kolize.od)}–${casHHMM(kolize.do)}`;
  return kolize.projectName
    ? `Na projektu ${kolize.projectName} už tenhle den máte výkaz ${cas}. Dva výkazy na stejný čas a projekt uložit nejde.`
    : `Tenhle den už máte výkaz ${cas} na stejný čas. Uložit ho podruhé nejde.`;
}
