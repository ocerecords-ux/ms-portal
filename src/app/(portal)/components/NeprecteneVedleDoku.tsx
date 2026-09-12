'use client';

import { Avatar } from './Avatar';
import { otevriRozhovor, useNeprectene, usePravyDok } from './pravyDok';

/**
 * Tváře nepřečtených rozhovorů u pravé hrany (zadání 12. 9. 2026: „chtěl bych
 * v chatu ještě nastavit, aby se tady nalevo od toho panelu objevily ty
 * uživatele nebo skupiny jako notifikace a můžu na ně kliknout a prokliknout
 * se rovnou na danou konverzaci. Pak to samozřejmě zmizí, až se prokliknu.
 * Kolečka bych asi řadil pod sebou.").
 *
 * Číslo u poutka říkalo jen KOLIK zpráv čeká, ne OD KOHO — a dostat se k nim
 * znamenalo rozbalit panel a hledat v seznamu. Tohle odpovídá na obojí naráz
 * a je to zároveň zkratka dovnitř: klepnutí otevře ten rozhovor, zprávy se tím
 * přečtou a kolečko zmizí samo.
 *
 * Jen když je panel zabalený — nad otevřeným chatem by to byla druhá kopie
 * téhož seznamu.
 */
export function NeprecteneVedleDoku() {
  const [dok] = usePravyDok();
  const neprectene = useNeprectene();

  if (dok !== null || neprectene.length === 0) return null;

  // Pět tváří a dost. Šestá by začala překážet obsahu stránky a zbytek stejně
  // čeká v panelu, kam vede poutko vedle.
  const videt = neprectene.slice(0, 5);
  const zbyva = neprectene.length - videt.length;

  return (
    <div className="fixed right-[52px] top-28 z-40 flex flex-col items-center gap-2.5">
      {videt.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => otevriRozhovor(c.id)}
          title={`${c.kind === 'PROJEKT' ? `# ${c.label}` : c.label} — ${c.unread} nepřečtených`}
          aria-label={`${c.label}: ${c.unread} nepřečtených zpráv`}
          className="relative rounded-full shadow-lg ring-2 ring-brand-purple transition-transform hover:scale-105"
        >
          <Avatar label={c.kind === 'PROJEKT' ? `# ${c.label}` : c.label} photoUrl={c.avatarUrl} size={34} />
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-green text-onAccent text-[10px] font-heading font-bold leading-[18px] text-center">
            {c.unread > 99 ? '99+' : c.unread}
          </span>
        </button>
      ))}
      {zbyva > 0 && (
        <span
          title={`a další ${zbyva}`}
          className="text-[10px] font-heading font-semibold text-muted bg-surface border border-line rounded-full px-1.5 py-0.5 shadow"
        >
          +{zbyva}
        </span>
      )}
    </div>
  );
}
