import { prisma } from '@/lib/db';
import { sendPrNabidkaEmail } from '@/lib/email';
import { kdyMuzeOdejit, smiFrontaOdeslat } from '@/lib/prTempo';

/**
 * ODESLÁNÍ NABÍDKY MÉDIU (zadání 20. 11. 2026: „co ten její email? Už může
 * psát?").
 *
 * Ema mail NAPÍŠE, odeslání mačká člověk. Portál sám od sebe nikomu nepíše -
 * tohle je jediná cesta ven a vede přes tlačítko u konkrétního média.
 *
 * EMA PÍŠE ZE SVÉ ADRESY (pr@mediaspace.cz, zadání 20. 11. 2026: „musí psát
 * ze svého mailu se svým podpisem"). Tam taky chodí odpovědi. Adresa se dá
 * přebít proměnnou PR_ODPOVED - ať se nemusí sahat do kódu, až se schránka
 * přejmenuje.
 */

/** Adresa, ze které Ema píše a kam chodí odpovědi. */
const ADRESA_EMY = () => process.env.PR_ODPOVED?.trim() || 'pr@mediaspace.cz';

export type VysledekOdeslani =
  | { ok: true; adresa: string }
  /** Mail je ve frontě - odejde sám v tuhle dobu (viz lib/prTempo.ts). */
  | { ok: true; adresa: string; fronta: string }
  | {
      ok: false;
      duvod: 'nenalezeno' | 'uz-odeslano' | 'bez-adresy' | 'bez-textu' | 'posta';
      /** Hláška ze serveru - jen u 'posta'. */
      hlaska?: string;
    };

/**
 * Adresa z pole „kontakt". Píše se tam běžně celá věta („Jana Nováková,
 * jana@radio.cz, přes redakci"), takže se adresa vytáhne vzorem a zbytek
 * zůstane člověku pro orientaci.
 */
export function adresaZKontaktu(kontakt: string | null): string | null {
  if (!kontakt) return null;
  const shoda = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(kontakt);
  return shoda ? shoda[0] : null;
}

/**
 * Odeslání na kliknutí. `hned: true` obchází frontu - používá to úloha, která
 * frontu pouští; ta si tempo hlídá sama.
 */
export async function posliMedium(
  mediumId: string,
  kdo: { id: string; jmeno: string },
  hned = false,
): Promise<VysledekOdeslani> {
  const medium = (await prisma.prMedium
    .findUnique({
      where: { id: mediumId },
      select: {
        id: true,
        kontakt: true,
        predmet: true,
        textMailu: true,
        odeslanoAt: true,
      },
    })
    .catch(() => null)) as
    | {
        id: string;
        kontakt: string | null;
        predmet: string | null;
        textMailu: string | null;
        odeslanoAt: Date | null;
      }
    | null;

  if (!medium) return { ok: false, duvod: 'nenalezeno' };
  // Dvakrát témuž redaktorovi je horší než vůbec.
  if (medium.odeslanoAt) return { ok: false, duvod: 'uz-odeslano' };

  const adresa = adresaZKontaktu(medium.kontakt);
  if (!adresa) return { ok: false, duvod: 'bez-adresy' };
  if (!medium.predmet?.trim() || !medium.textMailu?.trim()) {
    return { ok: false, duvod: 'bez-textu' };
  }

  /**
   * TEMPO (zadání 20. 11. 2026: „aby se z Emy nestal spam, když bude
   * rozesílat hromadné maily v jeden den"). Dvacet mailů z jedné adresy za
   * deset minut je pro poštovní servery rozesílka - a pak chodí do spamu
   * i poctivá odpověď redaktorovi. Když je na řadě hned, mail odejde; jinak
   * se zapíše čas a odešle ho úloha /api/cron/pr-fronta.
   */
  if (!hned) {
    const tempo = await kdyMuzeOdejit();
    if (!tempo.hned) {
      await prisma.prMedium
        .update({ where: { id: mediumId }, data: { odeslatAt: tempo.kdy } })
        .catch(() => undefined);
      return { ok: true, adresa, fronta: tempo.kdy.toISOString() };
    }
  }

  const vysledek = await sendPrNabidkaEmail({
    to: adresa,
    predmet: medium.predmet.trim(),
    text: medium.textMailu.trim(),
    adresaEmy: ADRESA_EMY(),
  });
  if (!vysledek.sent) {
    return { ok: false, duvod: 'posta', hlaska: 'hlaska' in vysledek ? vysledek.hlaska : '' };
  }

  await prisma.prMedium
    .update({
      where: { id: mediumId },
      data: { stav: 'NABIDNUTO', odeslanoAt: new Date(), odeslatAt: null, odeslalId: kdo.id },
    })
    .catch(() => undefined);

  return { ok: true, adresa };
}

/**
 * FRONTA: odešle NEJVÝŠ JEDEN mail, kterému dozrál čas.
 *
 * Jeden na jedno spuštění schválně - cron chodí po pěti minutách, takže ani
 * nahromaděná fronta neodejde jako dávka. Vrací, co odešlo, ať je v logu
 * úlohy vidět, že se něco dělo.
 */
export async function odesliZFronty(): Promise<{ odeslano: number; duvod?: string }> {
  if (!(await smiFrontaOdeslat())) return { odeslano: 0, duvod: 'mimo-tempo' };

  const nadcas = (await prisma.prMedium
    .findFirst({
      where: { odeslatAt: { not: null, lte: new Date() }, odeslanoAt: null },
      orderBy: { odeslatAt: 'asc' },
      select: { id: true, odeslalId: true },
    })
    .catch(() => null)) as { id: string; odeslalId: string | null } | null;
  if (!nadcas) return { odeslano: 0 };

  const vysledek = await posliMedium(
    nadcas.id,
    { id: nadcas.odeslalId ?? '', jmeno: 'Mediaspace' },
    true,
  );
  if (!vysledek.ok) {
    // Ať to nebouchá dokola - čas se zahodí a člověk to uvidí u média.
    await prisma.prMedium
      .update({ where: { id: nadcas.id }, data: { odeslatAt: null } })
      .catch(() => undefined);
    return { odeslano: 0, duvod: vysledek.duvod };
  }
  return { odeslano: 1 };
}
