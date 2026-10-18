import { NextResponse } from 'next/server';

import { prelozit } from '@/lib/jazyk';

/**
 * CHYBY Z ROUT V `api/**` (dávka 7o, 18. 10. 2026).
 *
 * Routa posílá vedle české věty i KLÍČ do slovníku a obrazovka si text
 * přeloží sama - vzor z dávky 7l, jen o patro výš. Routa tím nemusí vědět,
 * jaký jazyk má kdo v liště (cookie zná jen prohlížeč, a z cronu nebo z akce
 * jménem někoho jiného se nedá zjistit vůbec), a čeština zůstává zdrojem
 * pravdy (pravidlo 1): co klíč nezná, projde česky jako dosud.
 *
 * Na obrazovce tomu odpovídá `hlaskaChyby` v `lib/chybaZOdpovedi.ts`.
 */
export function odpovedChyby(klic: string, status: number): NextResponse {
  const text = prelozit('cs', klic);
  return NextResponse.json({ error: text, klic }, { status });
}

/** Tvar, který routy posílají ven. `klic` je nepovinný - starší routy ho nemají. */
export type ChybaOdpovedi = { error: string; klic?: string };
