import { prisma } from '@/lib/db';
import { sendPrNabidkaEmail } from '@/lib/email';

/**
 * ODESLÁNÍ NABÍDKY MÉDIU (zadání 20. 11. 2026: „co ten její email? Už může
 * psát?").
 *
 * Ema mail NAPÍŠE, odeslání mačká člověk. Portál sám od sebe nikomu nepíše -
 * tohle je jediná cesta ven a vede přes tlačítko u konkrétního média.
 *
 * ODPOVĚDI CHODÍ DO SCHRÁNKY PR (pr@mediaspace.cz, založena 20. 11. 2026).
 * Adresa se dá přebít proměnnou PR_ODPOVED - ať se nemusí sahat do kódu, až
 * se schránka přejmenuje.
 */

const ODPOVED = () => process.env.PR_ODPOVED?.trim() || 'pr@mediaspace.cz';

export type VysledekOdeslani =
  | { ok: true; adresa: string }
  | { ok: false; duvod: 'nenalezeno' | 'uz-odeslano' | 'bez-adresy' | 'bez-textu' | 'posta' };

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

export async function posliMedium(
  mediumId: string,
  kdo: { id: string; jmeno: string },
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

  const vysledek = await sendPrNabidkaEmail({
    to: adresa,
    predmet: medium.predmet.trim(),
    text: medium.textMailu.trim(),
    odesilatelJmeno: kdo.jmeno,
    odpovedNa: ODPOVED(),
  });
  if (!vysledek.sent) return { ok: false, duvod: 'posta' };

  await prisma.prMedium
    .update({
      where: { id: mediumId },
      data: { stav: 'NABIDNUTO', odeslanoAt: new Date(), odeslalId: kdo.id },
    })
    .catch(() => undefined);

  return { ok: true, adresa };
}
