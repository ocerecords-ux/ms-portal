/**
 * JE TENHLE PROJEKT REKLAMA? (zadání 30. 9. 2026: „u reklam nemáme vůbec vidět
 * stav Čekáme na opravy, ani se to do něj nemá nikdy překlápět. Ani
 * Natáčíme/stříháme, Dotočeno, Dotočeno/stříháme.")
 *
 * Tohle pravidlo bylo do teď rozepsané na čtyřech místech a každé znalo jen
 * kus pravdy: nabídka stavů se ptala firmy, denní překlápění typu projektu,
 * odpočet do „Čekáme na opravy" zase jen typu. U klienta, který u nás dělá
 * reklamy I audioknihy, tak spot spadl mezi audioknihy a nabízely se u něj
 * stavy z natáčení knihy — a dokonce se do nich sám překlápěl.
 *
 * Reklama je projekt, u kterého platí ASPOŇ JEDNO:
 *
 *   1. Typ projektu je spot s Rodným listem (PriceListItem.rodnyList).
 *   2. Firma dělá reklamy a NEdělá audioknihy — celá její práce je reklama.
 *   3. Firma dělá reklamy a projekt má jiný typ než audioknihu. U firmy, která
 *      dělá obojí, rozhoduje typ zakázky: co není audiokniha, je reklama.
 *
 * Projekt bez vyplněného typu u firmy, která dělá obojí, zůstává audioknihou —
 * hádat se u něj nemá, a audioknižní cesta je ta delší, takže se z ní dá
 * ručně odbočit. Stejně tak projekt bez firmy.
 */
export type PodkladyReklamy = {
  /** ProjectMeta.projectType. */
  projectType: string | null | undefined;
  /** Název položky ceníku zaškrtnuté „pro objednávky audioknih". */
  typAudioknihy: string | null | undefined;
  /** Názvy typů projektu, ke kterým se dělá Rodný list (rádiové a TV spoty). */
  typyRodnehoListu: readonly string[];
  /** Company.dealsAds */
  firmaDelaReklamy: boolean;
  /** Company.dealsAudiobooks */
  firmaDelaAudioknihy: boolean;
};

export function jeReklamniProjekt(v: PodkladyReklamy): boolean {
  const typ = v.projectType?.trim() || null;
  if (typ && v.typyRodnehoListu.includes(typ)) return true;
  if (v.firmaDelaReklamy && !v.firmaDelaAudioknihy) return true;

  const audiokniha = v.typAudioknihy?.trim() || null;
  return Boolean(v.firmaDelaReklamy && audiokniha && typ && typ !== audiokniha);
}

/**
 * Stavy, které patří jen k natáčení audioknihy a u reklamy se nemají ani
 * nabídnout, ani se do nich nesmí nic překlopit. Jeden seznam pro nabídku
 * i pro automaty — kdyby si každý držel vlastní, rozejdou se.
 *
 * Je to doplněk k STAVY_REKLAMY v lib/stavyProjektu.ts: tam je napsané, co se
 * u reklamy nabízí, tady to, co se u ní nesmí stát samo.
 */
export const STAVY_JEN_PRO_AUDIOKNIHU: readonly string[] = [
  'Natáčíme/stříháme',
  'Dotočeno',
  'Dotočeno/stříháme',
  'Čekáme na opravy',
  'Opravujeme',
];

export function jeStavJenProAudioknihu(nazev: string | null | undefined): boolean {
  return STAVY_JEN_PRO_AUDIOKNIHU.includes((nazev ?? '').trim());
}
