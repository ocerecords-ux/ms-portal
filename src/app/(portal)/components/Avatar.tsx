'use client';

import { useState } from 'react';
import { initials } from '@/lib/chat';

/**
 * Kolečko s fotkou, a když fotka chybí nebo se nenačte, s iniciálami.
 *
 * Bydlelo v ChatDocku; od 12. 9. 2026 ho potřebují i tváře nepřečtených
 * rozhovorů u pravé hrany, takže má vlastní soubor — dvě kopie by se po první
 * úpravě rozešly.
 */
export function Avatar({
  label,
  photoUrl,
  size = 28,
  naPruhu = false,
}: {
  label: string;
  photoUrl: string | null;
  size?: number;
  /**
   * Kolečko sedí v tmavém pruhu se zkratkami pod fialovou lištou (zadání
   * 13. 9. 2026: „nahoře tenký fialový panel s nápisem MS portal a pak pod tím
   * to tmavé pole, které používáme v konverzaci a na něm ta kolečka").
   *
   * Podklad pruhu se mění s režimem, takže bílé kolečko by ve světlém režimu
   * zmizelo. Proto je tu kolečko plnou fialovou s bílými iniciálami — čitelné
   * v obou režimech a pořád je to značka.
   */
  naPruhu?: boolean;
}) {
  const [selhalo, setSelhalo] = useState(false);

  if (photoUrl && !selhalo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photoUrl}
        alt=""
        onError={() => setSelhalo(true)}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover shrink-0 bg-field ${
          naPruhu ? 'border-2 border-brand-purple/60' : 'border border-line'
        }`}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={`rounded-full shrink-0 font-heading font-bold flex items-center justify-center ${
        naPruhu ? 'bg-brand-purple text-white' : 'bg-brand-purple/15 text-brand-purpleDark'
      }`}
      aria-hidden="true"
    >
      {initials(label)}
    </span>
  );
}
