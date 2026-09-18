/**
 * PROJEKT PŘIŠEL Z WEBU (zadání 18. 9. 2026: „kdyby se u projektů, které se
 * vytvoří automaticky po tom, co přijde objednávka, někde ukázal nějaký
 * minimalistický znak. Abychom je dokázali rozlišit, jestli je z webu, nebo
 * byl projekt založen ručně").
 *
 * Schválně DROBNÁ IKONA A ŽÁDNÝ TEXT. Vedle názvu zakázky už stojí stav a
 * firma; další bublina se slovem „z webu" by přetáhla pozornost na údaj,
 * který člověk potřebuje jednou za čas. Celá věta je v bublinové nápovědě
 * a čtečka ji přečte taky.
 *
 * Kreslí se glóbus, ne třeba šipka do systému: objednávka přišla z webu a
 * tahle kresba je pro web v celém portálu zavedená (viz licence Online).
 */
export function ZnackaZWebu({
  objednanoAt,
  velikost = 16,
}: {
  /** Kdy objednávka dorazila - do bublinové nápovědy. */
  objednanoAt?: string | Date | null;
  velikost?: number;
}) {
  const kdy = objednanoAt ? new Date(objednanoAt) : null;
  const popis = kdy
    ? `Projekt vznikl z objednávky na webu (${new Intl.DateTimeFormat('cs-CZ').format(kdy)})`
    : 'Projekt vznikl z objednávky na webu';

  return (
    <span
      title={popis}
      aria-label={popis}
      role="img"
      className="inline-flex items-center text-muted shrink-0"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        width={velikost}
        height={velikost}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
      </svg>
    </span>
  );
}
