/**
 * REŽIE ONLINE U PRVNÍ FREKVENCE (zadání 23. 9. 2026: „potřebuju nějak
 * vymyslet v kalendáři, aby byla nějaká ikona u první natáčecí frekvence
 * s hercem na novou knihu. Na každou první frekvenci s každým hercem se
 * připojuju na online hovor jako režie. Mohlo by to brát automaticky
 * ze záznamu v kalendáři. Ale někdy se to neděje pravidelně, tak chci mít
 * možnost to i odškrtnout, že to tam nebude.").
 *
 * Značka se NEUKLÁDÁ u každé frekvence - počítá se z kalendáře: první
 * natáčení daného herce na daném projektu (ať už je to termín z nabídky,
 * nebo ručně zapsaná událost) ji má, ostatní ne. Když se to jednou dělá
 * jinak, uloží se u té konkrétní události výjimka (`rezieOnline` true nebo
 * false) a ta má přednost.
 */

/**
 * Klíč dvojice projekt + herec. Herec bez účtu (ručně zapsaná událost,
 * casting) se pozná podle jména - bez diakritiky, mezer a velikosti písmen,
 * ať „Jan Novák" a „jan novak" spadnou k sobě.
 */
export function klicRezie(
  caflouProjectId: string | null | undefined,
  actorUserId: string | null | undefined,
  actorName: string | null | undefined,
): string | null {
  const projekt = (caflouProjectId ?? '').trim();
  if (!projekt) return null;
  if (actorUserId) return `${projekt}|u:${actorUserId}`;
  const jmeno = (actorName ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!jmeno) return null;
  return `${projekt}|j:${jmeno}`;
}

/** Popisek ikony - používá ho kalendář i návod. */
export const POPIS_REZIE = 'Režie online — první frekvence s hercem';
