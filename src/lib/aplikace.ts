/**
 * Dve aplikace na plose - MS Portal a MS Chat (zadani 9. a 10. 9. 2026).
 *
 * Seznam je na jednom miste, protoze s nim pracuje instalacni stranka
 * i vydavani QR kodu. Kdyby se adresa zmenila, meni se tady jednou.
 *
 * PROC MA KAZDA APLIKACE JINOU ADRESU: telefon si pri pridani na plochu
 * vezme manifest te stranky, na ktere zrovna stojite. Manifest MS Chatu je
 * pripojeny az v /chat, takze kdo chce ikonu chatu, musi byt v chatu.
 * Portal ma manifest v korenovem layoutu, takze pro nej staci libovolna
 * stranka portalu - vcetne teto.
 */

export type KlicAplikace = 'portal' | 'chat';

export type Aplikace = {
  klic: KlicAplikace;
  nazev: string;
  /** Jedna veta, co v aplikaci je. */
  popis: string;
  /** Stranka, na ktere se ma stat "Pridat na plochu". */
  cesta: string;
  ikona: string;
};

export const APLIKACE: Aplikace[] = [
  {
    klic: 'portal',
    nazev: 'MS Portal',
    popis: 'Projekty, nahrávky, doklady, kalendáře — celý portál bez chatu.',
    cesta: '/instalace',
    ikona: '/ikony/portal-192.png',
  },
  {
    klic: 'chat',
    nazev: 'MS Chat',
    popis: 'Jenom chat, na celou obrazovku, s upozorněním na nové zprávy.',
    cesta: '/chat',
    ikona: '/ikony/chat-192.png',
  },
];

export function najdiAplikaci(klic: string): Aplikace | undefined {
  return APLIKACE.find((a) => a.klic === klic);
}

/**
 * Adresa portalu bez lomitka na konci.
 *
 * Bere se z NEXTAUTH_URL, protoze ta uz musi byt spravne nastavena kvuli
 * prihlasovani - jinak by byly dve mista, kde se da udelat preklep.
 */
export function zakladniAdresa(): string {
  const adresa = process.env.NEXTAUTH_URL || 'https://www.msportal.cz';
  return adresa.replace(/\/+$/, '');
}

/** Plna adresa, ktera se schova do QR kodu. */
export function adresaAplikace(aplikace: Aplikace): string {
  return `${zakladniAdresa()}${aplikace.cesta}`;
}
