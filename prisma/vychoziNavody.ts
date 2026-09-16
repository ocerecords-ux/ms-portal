import { POZVANKA_HERCE } from './navodPozvankaHerce';
import { AUDIOTAGGER } from './navodAudiotagger';
import { STAVY_A_DOTOCENO } from './navodStavyDotoceno';

/**
 * NÁVODY, KTERÉ PORTÁL ZALOŽÍ SÁM (zadání 16. 9. 2026: „udělejme nějakou
 * přehlednou sekci a tam budeme vše postupně přidávat").
 *
 * Nový návod se sem přidá jedním řádkem. Zakládají se JEN JEDNOU - jakmile
 * někdo návod v portálu upraví, seed už do něj nesahá, jinak by každé
 * nasazení přepsalo, co člověk napsal.
 */
export type VychoziNavod = {
  slug: string;
  nazev: string;
  perex: string;
  kategorie: string;
  poradi: number;
  obsah: string;
};

export const VYCHOZI_NAVODY: VychoziNavod[] = [POZVANKA_HERCE, STAVY_A_DOTOCENO, AUDIOTAGGER];
