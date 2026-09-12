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
export function Avatar({ label, photoUrl, size = 28 }: { label: string; photoUrl: string | null; size?: number }) {
  const [selhalo, setSelhalo] = useState(false);

  if (photoUrl && !selhalo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photoUrl}
        alt=""
        onError={() => setSelhalo(true)}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0 border border-line bg-field"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className="rounded-full shrink-0 bg-brand-purple/15 text-brand-purpleDark font-heading font-bold flex items-center justify-center"
      aria-hidden="true"
    >
      {initials(label)}
    </span>
  );
}
