import { prisma } from '@/lib/db';
import type { Role, StavPozadavku } from '@prisma/client';

/**
 * CO JE POTŘEBA VE STUDIÍCH (zadání 17. 11. 2026: „potřebuju někde udělat
 * takový seznam, co je potřeba nakoupit nebo udělat ve studiích. Kompletní
 * seznam bych měl vidět jen já a Peter. Ale hlavní zvukaři by mohli přidávat
 * na seznam své požadavky" — a k tomu: „třeba v Brně I bude potřeba mikrofon,
 * tak Tom Ilavský zadá požadavek").
 *
 * DVĚ ÚROVNĚ PŘÍSTUPU, ŽÁDNÁ JMÉNA V KÓDU:
 *
 *   `vidiPozadavkyStudii` na kartě účtu  → vidí VŠECHNO přes všechna studia,
 *                                          přehazuje stav, maže cokoliv.
 *   vedoucí pobočky (`Studio.vedouci`)   → vidí a zadává JEN ve studiích,
 *                                          která vede; svůj nový požadavek
 *                                          smí opravit i smazat.
 *
 * Kdo nemá ani jedno, na stránku se nedostane a odkaz nikde nevidí. Je to
 * stejné pravidlo jako u ceníku studia (lib/studioCenikServer.ts) - role je
 * jen hrubé síto, pravdu říká karta účtu a seznam vedoucích u studia.
 */

export type PristupKPozadavkum = {
  /** Vidí celý seznam a přehazuje stavy. */
  spravce: boolean;
  /** ID studií, která ten člověk vede. Správce má prázdné - vidí všechna. */
  vedeStudia: string[];
};

/** Jediné místo, kde se práva k seznamu zjišťují. */
export async function pristupKPozadavkum(
  userId: string,
  role: Role,
): Promise<PristupKPozadavkum> {
  try {
    const ucet = await prisma.user.findUnique({
      where: { id: userId },
      select: { vidiPozadavkyStudii: true, vedeStudia: { select: { id: true } } },
    });
    return {
      // ADMIN sam o sobe pravo nedava - cely seznam ma videt jen ten, komu se
      // to zaskrtne (zadani: "kompletni seznam bych mel videt jen ja a Peter").
      spravce: Boolean(ucet?.vidiPozadavkyStudii),
      vedeStudia: (ucet?.vedeStudia ?? []).map((s: { id: string }) => s.id),
    };
  } catch (err) {
    console.error('Práva k seznamu požadavků se nepodařilo načíst:', err);
    return { spravce: false, vedeStudia: [] };
  }
}

/** Pustit toho člověka na stránku vůbec? */
export function smiNaSeznam(pristup: PristupKPozadavkum): boolean {
  return pristup.spravce || pristup.vedeStudia.length > 0;
}

/** Smí psát (a číst) požadavky zrovna tohohle studia? */
export function smiDoStudia(pristup: PristupKPozadavkum, studioId: string): boolean {
  return pristup.spravce || pristup.vedeStudia.includes(studioId);
}

/**
 * Filtr do dotazu podle toho, co ten člověk smí vidět. Správce dostane
 * prázdný objekt (= bez omezení), vedoucí jen svoje studia.
 */
export function filtrStudii(pristup: PristupKPozadavkum) {
  return pristup.spravce ? {} : { studioId: { in: pristup.vedeStudia } };
}

/**
 * Pořadí ve výpisu: co spěchá nahoru, hotové a zamítnuté dolů. Uvnitř
 * skupiny od nejnovějšího - seznam se čte shora a nejčerstvější požadavek
 * je ten, o kterém se zrovna mluví.
 */
export const PORADI_STAVU: Record<StavPozadavku, number> = {
  NOVY: 0,
  ZARIZUJE_SE: 1,
  HOTOVO: 2,
  ZAMITNUTO: 3,
};

/** Uzavřené požadavky se ze seznamu neztrácejí, jen klesnou pod čáru. */
export function jeUzavreny(stav: StavPozadavku): boolean {
  return stav === 'HOTOVO' || stav === 'ZAMITNUTO';
}

/** Klíče do slovníku - názvy se nikde nepíšou natvrdo. */
export const KLIC_STAVU: Record<StavPozadavku, string> = {
  NOVY: 'pozadavky.stavNovy',
  ZARIZUJE_SE: 'pozadavky.stavZarizujeSe',
  HOTOVO: 'pozadavky.stavHotovo',
  ZAMITNUTO: 'pozadavky.stavZamitnuto',
};

export const KLIC_DRUHU = {
  KOUPIT: 'pozadavky.druhKoupit',
  UDELAT: 'pozadavky.druhUdelat',
} as const;
