import { prisma } from '@/lib/db';
import { brunoNapisDoKanalu, brunoNapisSoukrome } from '@/lib/brunoOznameni';
import {
  jeNaCoUpozornit,
  najdiMezery,
  otiskMezer,
  vypisCisla,
  type MezeryVeStopach,
} from '@/lib/mezeryVeStopach';
import { nactiZDisku } from '@/lib/preposlechDriveServer';

/**
 * BRUNO HLÍDÁ ÚPLNOST STOP (zadání 19. 11. 2026).
 *
 * Radka Kopecká z Audioteky napsala „mrkněte prosím na chybějící tracky
 * 17 - 20". Tohle má najít portál dřív než klient - stopy leží na Disku
 * očíslované a tracklist říká, kolik jich má být.
 *
 * KDE SE TO SPOUŠTÍ:
 *  - při každém načtení složky v AudioTaggeru (vidí se to hned na místě),
 *  - při přehození stavu projektu (meta/route.ts),
 *  - v hodinové úloze /api/cron/nove-stopy, která stejně do složek kouká.
 *
 * KŘIČÍ SE JEN JEDNOU. Otisk nálezu leží v PreposlechStav.mezeryOtisk; dokud
 * se nález nezmění, Bruno mlčí. Když se stopy doplní, otisk se smaže a příští
 * díra se zase ohlásí.
 */

export type NalezStop = {
  mezery: MezeryVeStopach;
  /** Kolik stop má podle tracklistu být. Null = tracklist není. */
  ocekavano: number | null;
};

/** Spočítá nález ze složky na Disku. Nikdy nevyhazuje - když Disk mlčí, vrátí null. */
export async function zjistiMezery(caflouProjectId: string): Promise<NalezStop | null> {
  const disk = await nactiZDisku(caflouProjectId).catch(() => null);
  if (!disk || !disk.ok) return null;
  return zjistiMezeryZeStop(caflouProjectId, disk.stopy);
}

/** Totéž, ale když už volající složku načtenou má - ať se na Disk nesahá dvakrát. */
export async function zjistiMezeryZeStop(
  caflouProjectId: string,
  stopy: { name: string; poradi: number | null }[],
): Promise<NalezStop> {
  const ocekavano = await prisma.trackProjektu
    .count({ where: { caflouProjectId } })
    .catch(() => 0);
  return {
    mezery: najdiMezery(stopy, ocekavano > 0 ? ocekavano : null),
    ocekavano: ocekavano > 0 ? ocekavano : null,
  };
}

/** Věta do chatu. Null = není na co upozorňovat. */
export function vetaONalezu(nalez: NalezStop, nazevProjektu: string | null): string | null {
  const { mezery, ocekavano } = nalez;
  if (!jeNaCoUpozornit(mezery)) return null;

  const kniha = nazevProjektu ? `**${nazevProjektu}**` : 'projekt';
  const casti: string[] = [];
  if (mezery.chybi.length > 0) {
    casti.push(
      `ve složce na Disku ${mezery.chybi.length === 1 ? 'chybí stopa' : 'chybí stopy'} ${vypisCisla(mezery.chybi)}`,
    );
  }
  if (mezery.duplicity.length > 0) {
    casti.push(
      `${mezery.duplicity.length === 1 ? 'dvakrát tam leží číslo' : 'dvakrát tam leží čísla'} ${vypisCisla(mezery.duplicity)}`,
    );
  }

  const pocty =
    ocekavano !== null
      ? ` Na Disku je ${mezery.pocet} ${tvarStop(mezery.pocet)}, tracklist jich má ${ocekavano}.`
      : ` Na Disku je ${mezery.pocet} ${tvarStop(mezery.pocet)}.`;

  return `${kniha}: ${casti.join(' a ')}.${pocty} Mrkněte na to prosím, ať to nenajde klient dřív než my.`;
}

function tvarStop(kolik: number): string {
  if (kolik === 1) return 'stopa';
  if (kolik >= 2 && kolik <= 4) return 'stopy';
  return 'stop';
}

/**
 * Zkontroluje složku a případně napíše do kanálu projektu. Vrací true, když
 * zpráva opravdu odešla.
 *
 * `stopy` se dá podat, když je volající má po ruce (cron, AudioTagger).
 */
export async function zkontrolujUplnostStop(
  caflouProjectId: string,
  stopy?: { name: string; poradi: number | null }[],
): Promise<boolean> {
  try {
    const nalez = stopy
      ? await zjistiMezeryZeStop(caflouProjectId, stopy)
      : await zjistiMezery(caflouProjectId);
    if (!nalez) return false;

    const stav = await prisma.preposlechStav
      .findUnique({ where: { caflouProjectId }, select: { mezeryOtisk: true } })
      .catch(() => null);

    if (!jeNaCoUpozornit(nalez.mezery)) {
      // Doplnili to - at se pristi dira zase ohlasi.
      if (stav?.mezeryOtisk) {
        await prisma.preposlechStav
          .update({ where: { caflouProjectId }, data: { mezeryOtisk: null, mezeryAt: null } })
          .catch(() => undefined);
      }
      return false;
    }

    const otisk = otiskMezer(nalez.mezery);
    if (stav?.mezeryOtisk === otisk) return false;

    const meta = await prisma.projectMeta
      .findUnique({
        where: { caflouProjectId },
        select: { name: true, managerUserId: true },
      })
      .catch(() => null);

    const veta = vetaONalezu(nalez, meta?.name ?? null);
    if (!veta) return false;

    await brunoNapisDoKanalu(caflouProjectId, veta);
    /**
     * MANAŽEROVI JEŠTĚ SOUKROMĚ. Kanál projektu si nemusí nikdo rozkliknout;
     * tohle je věc, která se má dozvědět adresně. Žádné jméno v kódu - bere
     * se manažer uvedený na projektu.
     */
    if (meta?.managerUserId) {
      await brunoNapisSoukrome(meta.managerUserId, veta).catch(() => undefined);
    }

    await prisma.preposlechStav
      .upsert({
        where: { caflouProjectId },
        update: { mezeryOtisk: otisk, mezeryAt: new Date() },
        create: { caflouProjectId, mezeryOtisk: otisk, mezeryAt: new Date() },
      })
      .catch(() => undefined);

    return true;
  } catch (err) {
    console.error('Kontrola uplnosti stop selhala:', err);
    return false;
  }
}
