import { prisma } from '@/lib/db';
import { projektPodleTokenu } from '@/lib/preposlechOdkaz';
import { zapisZmenyProjektu } from '@/lib/projektLogServer';
import { stavJeDokonceny } from '@/lib/stavyProjektu';

/**
 * KLIENT SPOT SCHVÁLÍ JEDNÍM TLAČÍTKEM (zadání 18. 9. 2026: „mohl by tam mít
 * tlačítko schválit - v mailu, ale taky i ve složce těch souborů - a
 * stisknutím toho tlačítka se nám daný spot nebo reklama překlopí do stavu
 * schváleno k fakturaci").
 *
 * VSTUPENKA JE TOKEN, stejně jako u nahrávek, přeposlechu a připomínek. Klient
 * se nikam nepřihlašuje; odkaz platí do jednoho projektu a jde kdykoliv
 * zneplatnit.
 *
 * SCHVALUJE SE POST, NIKDY NE OTEVŘENÍM ODKAZU. Tlačítko v mailu jen otevře
 * stránku - kdyby stav překlápěl samotný odkaz, schválil by spot první
 * antivir nebo náhled odkazu, který si ho ze zvědavosti stáhne.
 *
 * JEN U REKLAMNÍCH KLIENTŮ. U audioknihy vede cesta přes opravy a stav
 * přehazujeme my; tohle je zkratka pro spot, který klient buď vezme, nebo
 * k němu napíše připomínky.
 */

export const STAV_PO_SCHVALENI = 'Schváleno - k fakturaci';

export type StavSchvaleni = {
  /** Kdy klient schválil; null = ještě ne. */
  schvalenoAt: string | null;
  /** Aktuální stav projektu - ať tlačítko ví, co má napsat. */
  stav: string | null;
  /** Smí se tu vůbec schvalovat? (reklamní klient) */
  lzeSchvalit: boolean;
};

export async function stavSchvaleni(caflouProjectId: string): Promise<StavSchvaleni> {
  try {
    const meta = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: {
        statusName: true,
        schvalenoKlientemAt: true,
        company: { select: { dealsAds: true } },
      },
    });
    return {
      schvalenoAt: meta?.schvalenoKlientemAt ? meta.schvalenoKlientemAt.toISOString() : null,
      stav: meta?.statusName ?? null,
      lzeSchvalit: meta?.company?.dealsAds === true,
    };
  } catch (err) {
    console.error('Cteni stavu schvaleni selhalo:', err);
    return { schvalenoAt: null, stav: null, lzeSchvalit: false };
  }
}

export type VysledekSchvaleni =
  | { ok: true; schvalenoAt: string; stav: string; jizDrive: boolean }
  | { chyba: string; status: number };

export async function schvalKlientem(token: string): Promise<VysledekSchvaleni> {
  const caflouProjectId = await projektPodleTokenu(token);
  if (!caflouProjectId) return { chyba: 'Odkaz už neplatí.', status: 403 };

  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: {
      statusName: true,
      finished: true,
      schvalenoKlientemAt: true,
      company: { select: { dealsAds: true } },
    },
  });
  if (!meta) return { chyba: 'Projekt se nenašel.', status: 404 };
  if (meta.company?.dealsAds !== true) {
    return { chyba: 'U tohohle projektu se přes odkaz neschvaluje.', status: 403 };
  }

  // Druhe kliknuti uz nic nepreklapi - jen rekne, ze je hotovo.
  if (meta.schvalenoKlientemAt) {
    return {
      ok: true,
      schvalenoAt: meta.schvalenoKlientemAt.toISOString(),
      stav: meta.statusName ?? STAV_PO_SCHVALENI,
      jizDrive: true,
    };
  }

  const ted = new Date();
  const dokonceny = stavJeDokonceny(STAV_PO_SCHVALENI);

  try {
    await prisma.projectMeta.update({
      where: { caflouProjectId },
      data: {
        statusName: STAV_PO_SCHVALENI,
        schvalenoKlientemAt: ted,
        ...(dokonceny !== null ? { finished: dokonceny } : {}),
      },
    });

    /**
     * Do historie i pod zvonek. Čeká se na to schválně: na Vercelu po odeslané
     * odpovědi funkce končí a zápis by nemusel doběhnout - a schválení od
     * klienta je přesně to, o čem se musíme dozvědět.
     *
     * Původce je „Klient (odkazem)" - v historii má být na první pohled vidět,
     * že stav nepřehodil nikdo od nás.
     */
    await zapisZmenyProjektu({
      caflouProjectId,
      pred: { statusName: meta.statusName, finished: meta.finished },
      ulozeno: {
        statusName: STAV_PO_SCHVALENI,
        ...(dokonceny !== null ? { finished: dokonceny } : {}),
      },
      puvodce: { id: null, jmeno: 'Klient (odkazem)' },
    }).catch(() => undefined);

    return { ok: true, schvalenoAt: ted.toISOString(), stav: STAV_PO_SCHVALENI, jizDrive: false };
  } catch (err) {
    console.error('Schvaleni spotu klientem selhalo:', err);
    return { chyba: 'Schválení se nepodařilo uložit.', status: 500 };
  }
}
