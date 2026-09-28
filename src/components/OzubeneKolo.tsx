import Link from 'next/link';

/**
 * OZUBENÉ KOLO U NADPISU SEKCE (zadání 28. 9. 2026: „pojďme udělat v každé
 * sekci ozubené kolo, kde budeme nastavovat dané věci k té sekci").
 *
 * Tiché kolečko vedle nadpisu, ne tlačítko v řadě s ostatními - do nastavení
 * se chodí jednou za čas a nemá přebíjet práci, kvůli které člověk na stránku
 * přišel. Barvu dostane až při najetí.
 *
 * Kdo na nastavení nemá právo, tomu se nevykreslí vůbec (rozhoduje volající) -
 * zašedlé kolečko, které nic neudělá, je horší než žádné.
 */
export function OzubeneKolo({
  cesta,
  popis = 'Nastavení sekce',
}: {
  cesta: string;
  popis?: string;
}) {
  return (
    <Link
      href={cesta}
      title={popis}
      aria-label={popis}
      className="shrink-0 inline-grid place-items-center w-8 h-8 rounded-pill border border-line text-muted no-underline transition-colors hover:text-brand-purple hover:border-brand-purple"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </Link>
  );
}
