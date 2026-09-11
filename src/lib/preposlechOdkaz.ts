import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';

/**
 * Odkaz do AudioTaggeru pro klienta (zadání 11. 9. 2026).
 *
 * Klient nemá účet ani ho mít nemusí — z mailu klikne na tlačítko
 * „Přeposlechnout v AudioTaggeru" a otevře se mu celá obrazovka s
 * přehrávačem. Podle čeho se pozná, že tam smí: podle tokenu v adrese.
 *
 * ČÍM TO PLATÍME: kdo odkaz dostane dál, dostane se dovnitř taky, a poznámky
 * nebudou podepsané jménem. Ondřej to ví a takhle to chce — přihlašování by
 * klienta odradilo dřív, než by si nahrávku pustil.
 *
 * Na projekt je živý vždycky jeden token. Nový se vyrábí jen tehdy, když
 * žádný není, nebo když ho někdo od nás schválně vygeneruje znovu — jinak by
 * druhá zpráva o projektu zneplatnila odkaz z té první.
 */

/** 24 bajtů náhody = 32 znaků v adrese. Uhodnout se to nedá. */
function novyToken(): string {
  return randomBytes(24).toString('base64url');
}

export function zakladPortalu(): string {
  return (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
}

export function urlPreposlechu(token: string): string {
  return `${zakladPortalu()}/preposlech/${encodeURIComponent(token)}`;
}

/**
 * Nahrávky projektu bez přihlašování (zadání 11. 9. 2026: „potřebuju, ať se
 * klient nemusí přihlašovat a jsou ty odkazy otevřené, mnohdy to někomu
 * posílá"). Je to TENTÝŽ token jako u přeposlechu — „Vygenerovat nový"
 * u projektu tedy zavře obojí naráz.
 */
export function urlNahravek(token: string): string {
  return `${zakladPortalu()}/nahravky/${encodeURIComponent(token)}`;
}

/**
 * Vrátí platný token projektu; když žádný nemá, založí ho.
 * Nikdy nevyhazuje — odkaz navíc nesmí shodit odesílání zprávy.
 */
export async function zajistiOdkaz(
  caflouProjectId: string,
  jmeno?: string | null,
): Promise<string | null> {
  try {
    const stavajici = await prisma.preposlechOdkaz.findUnique({
      where: { caflouProjectId },
      select: { token: true, zneplatnenoAt: true },
    });
    if (stavajici && !stavajici.zneplatnenoAt) return stavajici.token;

    const token = novyToken();
    await prisma.preposlechOdkaz.upsert({
      where: { caflouProjectId },
      create: { token, caflouProjectId, createdByName: jmeno ?? null },
      update: {
        token,
        createdAt: new Date(),
        createdByName: jmeno ?? null,
        zneplatnenoAt: null,
        otevrenoAt: null,
        pocetOtevreni: 0,
      },
    });
    return token;
  } catch (err) {
    console.error('zajistiOdkaz selhalo:', err);
    return null;
  }
}

/** Vyrobí nový token a ten předchozí tím zneplatní. */
export async function obnovOdkaz(
  caflouProjectId: string,
  jmeno?: string | null,
): Promise<string | null> {
  try {
    await prisma.preposlechOdkaz
      .update({ where: { caflouProjectId }, data: { zneplatnenoAt: new Date() } })
      .catch(() => undefined);
    return await zajistiOdkaz(caflouProjectId, jmeno);
  } catch (err) {
    console.error('obnovOdkaz selhalo:', err);
    return null;
  }
}

/** Zavře odkaz, aniž by se dělal nový. */
export async function zavriOdkaz(caflouProjectId: string): Promise<void> {
  await prisma.preposlechOdkaz
    .update({ where: { caflouProjectId }, data: { zneplatnenoAt: new Date() } })
    .catch(() => undefined);
}

/** Ke kterému projektu token patří. `null` = neplatný nebo zavřený. */
export async function projektPodleTokenu(token: string): Promise<string | null> {
  if (!token || token.length < 16 || token.length > 200) return null;
  try {
    const zaznam = await prisma.preposlechOdkaz.findUnique({
      where: { token },
      select: { caflouProjectId: true, zneplatnenoAt: true },
    });
    if (!zaznam || zaznam.zneplatnenoAt) return null;
    return zaznam.caflouProjectId;
  } catch (err) {
    console.error('projektPodleTokenu selhalo:', err);
    return null;
  }
}

/** Zápis do statistiky otevření. Nikdy nevyhazuje. */
export async function zapisOtevreni(token: string): Promise<void> {
  await prisma.preposlechOdkaz
    .update({
      where: { token },
      data: { otevrenoAt: new Date(), pocetOtevreni: { increment: 1 } },
    })
    .catch(() => undefined);
}

/** Stav odkazu pro kartu projektu. */
export async function stavOdkazu(caflouProjectId: string): Promise<{
  url: string | null;
  otevrenoAt: string | null;
  pocetOtevreni: number;
}> {
  try {
    const zaznam = await prisma.preposlechOdkaz.findUnique({
      where: { caflouProjectId },
      select: { token: true, zneplatnenoAt: true, otevrenoAt: true, pocetOtevreni: true },
    });
    if (!zaznam || zaznam.zneplatnenoAt) return { url: null, otevrenoAt: null, pocetOtevreni: 0 };
    return {
      url: urlPreposlechu(zaznam.token),
      otevrenoAt: zaznam.otevrenoAt ? zaznam.otevrenoAt.toISOString() : null,
      pocetOtevreni: zaznam.pocetOtevreni,
    };
  } catch {
    return { url: null, otevrenoAt: null, pocetOtevreni: 0 };
  }
}
