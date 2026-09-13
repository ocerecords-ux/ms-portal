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
  naFialovem = false,
}: {
  label: string;
  photoUrl: string | null;
  size?: number;
  /**
   * Kolečko sedí na fialové liště (zadání 13. 9. 2026: „ten fialový podklad
   * pod kolečkama se zkratkama na chat — zanikají na tom podkladu").
   *
   * Iniciály se jinak kreslí bledě fialovou na fialovou a rozplynou se.
   * Na liště je proto kolečko bílé a fotka dostane bílý lem.
   */
  naFialovem?: boolean;
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
          naFialovem ? 'border-2 border-white/85' : 'border border-line'
        }`}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={`rounded-full shrink-0 font-heading font-bold flex items-center justify-center ${
        naFialovem ? 'bg-white text-brand-purpleDeep' : 'bg-brand-purple/15 text-brand-purpleDark'
      }`}
      aria-hidden="true"
    >
      {initials(label)}
    </span>
  );
}
