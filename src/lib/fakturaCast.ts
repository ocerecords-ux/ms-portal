/**
 * KOLIKÁTÁ ČÁST ZAKÁZKY JE TA FAKTURA (zadání 29. 9. 2026: „u Albatrosu
 * fakturujeme vždy dvě faktury. Je to na dvě části. Po podepsání smlouvy
 * fakturujeme polovinu z celkové nabídky + DPH. Potřeboval bych nějak pro nás
 * jen interně označit, abychom věděli i v tom přehledu, o jakou fakturu jde").
 *
 * JE TO VÝHRADNĚ NAŠE ZNAČKA. Na vytištěné faktuře, v jejím předmětu ani
 * v mailu klientovi se neobjeví nikde - proto vlastní sloupec a ne `subject`
 * nebo `note`, které se tisknou („na dokladu samotném nic neměň").
 *
 * Soubor je bez Prismy, ať ho vezme přehled, tabulka i editor.
 */

export const CASTI_FAKTURY = ['PRVNI', 'DRUHA'] as const;
export type CastFaktury = (typeof CASTI_FAKTURY)[number];

/** Plný popis - do nabídky volby a do bublinky. */
export const POPIS_CASTI: Record<CastFaktury, string> = {
  PRVNI: 'První část',
  DRUHA: 'Druhá část',
};

/** Do tabulky, kde je místa málo. */
export const ZKRATKA_CASTI: Record<CastFaktury, string> = {
  PRVNI: '1. část',
  DRUHA: '2. část',
};

export function jeCastFaktury(hodnota: string | null | undefined): hodnota is CastFaktury {
  return !!hodnota && (CASTI_FAKTURY as readonly string[]).includes(hodnota);
}

/** Zkratka pro cokoliv z databáze; co značku nemá, vrátí prázdno. */
export function zkratkaCasti(hodnota: string | null | undefined): string | null {
  return jeCastFaktury(hodnota) ? ZKRATKA_CASTI[hodnota] : null;
}

/**
 * Čím předvyplnit fakturu vystavovanou z nabídky.
 *
 * Nic se nehádá: bere se jen pořadí faktur z TÉŽE nabídky, protože přesně
 * takhle ta zakázka běží - nabídka na celek, po podpisu smlouvy polovina,
 * zbytek potom. Třetí a další faktura z jedné nabídky už značku nedostane;
 * tam ať si člověk řekne sám, co je co.
 */
export function castPodlePoradi(kolikUzJeFaktur: number): CastFaktury | null {
  if (kolikUzJeFaktur === 0) return 'PRVNI';
  if (kolikUzJeFaktur === 1) return 'DRUHA';
  return null;
}
