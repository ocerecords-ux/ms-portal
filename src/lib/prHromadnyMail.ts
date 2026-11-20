import { prisma } from '@/lib/db';

/**
 * HROMADNÝ MAIL KAMPANĚ (zadání 20. 11. 2026: „chci nastavovat mail hromadně
 * u každé kampaně").
 *
 * Psát stejný mail u každého pořadu zvlášť nemá smysl - kampaň má jednu
 * předlohu, ze které se mail u médií naplní. Předloha je VÝCHOZÍ ZNĚNÍ, ne
 * zámek: mail u konkrétního média jde pořád přepsat a odeslané maily se
 * předlohou nikdy nepřepisují, protože co odešlo, má zůstat tak, jak odešlo.
 *
 * {medium} v předloze se nahradí názvem pořadu nebo redakce - ať oslovení
 * nevypadá jako hromadný leták.
 */

/** Značka pro název pořadu. Píše se i s diakritikou, tak se berou obě. */
export function dosadMedium(sablona: string | null, nazevMedia: string): string {
  return (sablona ?? '').replace(/\{\s*m[eé]dium\s*\}/gi, nazevMedia);
}

export async function ulozPredlohuMailu(
  kampanId: string,
  predmet: string,
  text: string,
): Promise<void> {
  await prisma.prKampan
    .update({
      where: { id: kampanId },
      data: { predmetMailu: predmet.trim() || null, textMailu: text.trim() || null },
    })
    .catch((err: unknown) => console.error('Předlohu mailu se nepodařilo uložit:', err));
}

export async function nactiPredlohuMailu(
  kampanId: string,
): Promise<{ predmet: string; text: string }> {
  const k = (await prisma.prKampan
    .findUnique({ where: { id: kampanId }, select: { predmetMailu: true, textMailu: true } })
    .catch(() => null)) as { predmetMailu: string | null; textMailu: string | null } | null;
  return { predmet: k?.predmetMailu ?? '', text: k?.textMailu ?? '' };
}

/**
 * Vloží předlohu do médií, která ještě neodešla. Vrací, kolika médií se to
 * týkalo - ať obrazovka může říct „vloženo do pěti".
 *
 * `jenPrazdna` nechá na pokoji média, u kterých už nějaký text je (hodí se,
 * když Ema některým napsala na míru a předloha má doplnit jen zbytek).
 */
export async function vlozPredlohuDoMedii(
  kampanId: string,
  jenPrazdna = false,
): Promise<number> {
  const predloha = await nactiPredlohuMailu(kampanId);
  if (!predloha.predmet && !predloha.text) return 0;

  const media = (await prisma.prMedium
    .findMany({
      where: { kampanId, odeslanoAt: null },
      select: { id: true, nazev: true, predmet: true, textMailu: true },
    })
    .catch(() => [])) as {
    id: string;
    nazev: string;
    predmet: string | null;
    textMailu: string | null;
  }[];

  const naRadu = jenPrazdna
    ? media.filter((m) => !m.predmet?.trim() && !m.textMailu?.trim())
    : media;

  for (const m of naRadu) {
    await prisma.prMedium
      .update({
        where: { id: m.id },
        data: {
          predmet: dosadMedium(predloha.predmet, m.nazev) || null,
          textMailu: dosadMedium(predloha.text, m.nazev) || null,
        },
      })
      .catch((err: unknown) => console.error('Mail u média se nepodařilo vyplnit:', err));
  }
  return naRadu.length;
}
