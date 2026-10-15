/**
 * VÝCHOZÍ ZAPNUTÍ KALENDÁŘŮ (zadání Helči, 15. 10. 2026).
 *
 * Seznam uložený u člověka míchá id studií se značkami ostatních kalendářů.
 * Značky jsou tady na jednom místě, aby se server, API i prohlížeč nemohly
 * rozejít v tom, jak se jmenují.
 */

export const KALENDAR_MIMO = 'mimo';
export const KALENDAR_PORADY = 'porady';
export const KALENDAR_SCHUZKY = 'schuzky';

export const ZNACKY_KALENDARU = [KALENDAR_MIMO, KALENDAR_PORADY, KALENDAR_SCHUZKY] as const;
