import { NextResponse } from 'next/server';

import { prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

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

/**
 * TOTÉŽ, JEN SE ZNAČKOU VE VĚTĚ (dávka 7q, 19. 10. 2026).
 *
 * Věta je pořád jeden klíč (pravidlo 7) a hodnoty do značek jdou vedle něj,
 * aby si je obrazovka dosadila do své vlastní jazykové verze. Hodnoty musí
 * být jazykově neutrální - číslo, název souboru, celé megabajty. Co se
 * formátuje podle jazyka (desetinná čárka, datum), sem nepatří: routa neví,
 * kdo se ptá.
 */
export function odpovedChybyS(
  klic: string,
  hodnoty: Record<string, string | number>,
  status: number,
): NextResponse {
  const text = prelozitS('cs', klic, hodnoty);
  return NextResponse.json({ error: text, klic, hodnoty }, { status });
}

/** Tvar, který routy posílají ven. `klic` je nepovinný - starší routy ho nemají. */
export type ChybaOdpovedi = {
  error: string;
  klic?: string;
  hodnoty?: Record<string, string | number>;
};

/**
 * ROUTY, NA KTERÉ SE CHODÍ ODKAZEM (dávka 7r, 21. 10. 2026).
 *
 * Výdej přílohy z chatu a PDF dokladu se neotevírají fetchem, ale odkazem
 * v novém okně - chybu si proto nemá kdo přeložit, prohlížeč ukáže rovnou
 * ten JSON. Tady ale jazyk k ruce JE (chodí sem výhradně klik z prohlížeče,
 * nikdy cron), takže si ho routa vezme z cookie přes `nactiJazyk()` a věta
 * odejde hotová - stejné rozhodnutí jako u náhledových oken v dávce 7p.
 * Klíč jde vedle ní dál: kdyby si na routu někdy sáhl fetch, obrazovka si
 * poradí stejně jako u ostatních.
 */
export function odpovedChybyVJazyce(jazyk: Jazyk, klic: string, status: number): NextResponse {
  return NextResponse.json({ error: prelozit(jazyk, klic), klic }, { status });
}
