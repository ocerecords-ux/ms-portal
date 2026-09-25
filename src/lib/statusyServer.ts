import { prisma } from '@/lib/db';
import { udalostiCloveka } from '@/lib/ranniPrehledServer';
import { casStatusu, REZIE_MINUT, type StatusVChatu } from '@/lib/statusyChatu';

/**
 * SKLÁDÁNÍ STATUSŮ DO CHATU (zadání 25. 9. 2026) - viz lib/statusyChatu.ts,
 * kde jsou pravidla popsaná celá.
 *
 * Nic se neukládá: status z kalendáře se počítá při každém načtení chatu,
 * takže nemůže zůstat viset po skončené schůzce a nepotřebuje žádnou
 * úklidovou úlohu. V databázi je jen to, co si člověk napsal sám.
 */

/** Kolik minut dopředu se ještě nekouká - status je o TEĎ. */
const TED = () => new Date();

function zacatekDne(kdy: Date): Date {
  const d = new Date(kdy);
  d.setHours(0, 0, 0, 0);
  return d;
}

function konecDne(kdy: Date): Date {
  const d = zacatekDne(kdy);
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Status z kalendáře jednoho člověka. Bere se událost, která PRÁVĚ BĚŽÍ;
 * když jich běží víc, vyhrává ta, která končí dřív - o ní má smysl říct
 * „do kdy".
 */
async function zKalendare(userId: string, ted: Date): Promise<StatusVChatu | null> {
  const udalosti = await udalostiCloveka(userId, zacatekDne(ted), konecDne(ted)).catch(() => []);

  type Kandidat = { konec: Date; text: string; emoji: string };
  const kandidati: Kandidat[] = [];

  for (const u of udalosti) {
    if (u.end <= ted) continue;

    /**
     * REŽIE NA DÁLKU jen prvních třicet minut (zadání 25. 9. 2026: „u těch
     * režií mi tam nastav, že jsem mimo jen první půl hodinu"). Po nich už
     * status mizí, i když frekvence běží dál.
     */
    if (u.rezie && u.druh !== 'CASTING') {
      const konecRezie = new Date(u.start.getTime() + REZIE_MINUT * 60_000);
      if (u.start <= ted && ted < konecRezie) {
        kandidati.push({ konec: konecRezie, text: `Režie na dálku do ${casStatusu(konecRezie)}`, emoji: '🎧' });
      }
      continue;
    }

    if (u.start > ted) continue;

    // Casting na celou událost (zadání 25. 9. 2026).
    if (u.druh === 'CASTING') {
      kandidati.push({ konec: u.end, text: `Casting do ${casStatusu(u.end)}`, emoji: '🎤' });
      continue;
    }

    if (u.druh === 'PORADA' || u.druh === 'SCHUZKA') {
      kandidati.push({ konec: u.end, text: `Mám schůzku do ${casStatusu(u.end)}`, emoji: '📅' });
    }
  }

  if (kandidati.length === 0) return null;
  const vyhra = kandidati.sort((a, b) => a.konec.getTime() - b.konec.getTime())[0];
  return { text: vyhra.text, emoji: vyhra.emoji, doKdy: vyhra.konec.toISOString(), rucni: false };
}

/**
 * Statusy pro seznam lidí. Jeden dotaz na účty, jeden na „Mimo studio";
 * kalendář se počítá jen těm, kdo to mají zapnuté (zatím jeden člověk).
 */
export async function nactiStatusy(userIds: string[]): Promise<Record<string, StatusVChatu>> {
  const vysledek: Record<string, StatusVChatu> = {};
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return vysledek;

  const ted = TED();

  try {
    const [lide, mimo] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          statusText: true,
          statusEmoji: true,
          statusDo: true,
          statusZKalendare: true,
        },
      }),
      /**
       * MIMO STUDIO PLATÍ VŠEM (zadání 25. 9. 2026: „a nám všem bych nastavil,
       * když budeme mimo studio"). Celodenní záznam nemá čas, do kdy - tam se
       * žádné „do" nepíše.
       */
      prisma.nepritomnost.findMany({
        where: { userId: { in: ids }, start: { lte: ted }, end: { gt: ted } },
        select: { userId: true, celyDen: true, end: true, poznamka: true },
      }),
    ]);

    const mimoPodleId = new Map(mimo.filter((m) => m.userId).map((m) => [m.userId as string, m]));

    for (const clovek of lide) {
      // 1. Co si člověk napsal sám - dokud to platí.
      const rucniPlati =
        clovek.statusText && clovek.statusText.trim().length > 0 && (!clovek.statusDo || clovek.statusDo > ted);
      if (rucniPlati) {
        vysledek[clovek.id] = {
          text: clovek.statusText!.trim(),
          emoji: clovek.statusEmoji || null,
          doKdy: clovek.statusDo ? clovek.statusDo.toISOString() : null,
          rucni: true,
        };
        continue;
      }

      // 2. Mimo studio - všem.
      const pryc = mimoPodleId.get(clovek.id);
      if (pryc) {
        const doKdy = pryc.celyDen ? null : pryc.end;
        vysledek[clovek.id] = {
          text: doKdy ? `Mimo studio do ${casStatusu(doKdy)}` : 'Mimo studio',
          emoji: '🚶',
          doKdy: doKdy ? doKdy.toISOString() : null,
          rucni: false,
        };
        continue;
      }

      // 3. Kalendář - jen komu je to zapnuté.
      if (!clovek.statusZKalendare) continue;
      const zKal = await zKalendare(clovek.id, ted).catch(() => null);
      if (zKal) vysledek[clovek.id] = zKal;
    }
  } catch (err) {
    // Chat se kvůli statusům rozbít nesmí - v nejhorším nebude ani jeden.
    console.error('Nacteni statusu selhalo:', err);
  }

  return vysledek;
}

/** Status jednoho člověka - pro vlastní kartu a pro API. */
export async function nactiStatus(userId: string): Promise<StatusVChatu | null> {
  const mapa = await nactiStatusy([userId]);
  return mapa[userId] ?? null;
}
