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

/**
 * Z názvu události nechá jen PROJEKT: blokace v kalendáři se jmenují
 * „POD TLAKEM KRÁSY - střih ZVUKAŘ: Matěj Suk" a ve statusu z toho stačí
 * název knihy - že jde o střih, říká ikona, a komu status patří, je jasné
 * z toho, u čího jména visí.
 */
function nazevProjektu(nazev: string): string {
  const bezRoli = nazev.split(/\s(?:ZVUKAŘ|HEREC|REŽIE|KLIENT)\s*:/i)[0];
  const bezDruhu = bezRoli.replace(/\s*[-–—]\s*(střih|natáčení|nataceni|casting|mix|mastering)\s*$/i, '');
  return bezDruhu.trim() || nazev;
}

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
async function zKalendare(
  userId: string,
  ted: Date,
  volby: { schuzky: boolean; studio: boolean },
): Promise<StatusVChatu | null> {
  const udalosti = await udalostiCloveka(userId, zacatekDne(ted), konecDne(ted)).catch(() => []);

  type Kandidat = { konec: Date; text: string; emoji: string | null; ikona?: string };
  const kandidati: Kandidat[] = [];

  for (const u of udalosti) {
    if (u.end <= ted) continue;

    /**
     * ZVUKAŘ UKAZUJE, NA ČEM DĚLÁ (zadání 25. 9. 2026: „u zvukařů přidej jako
     * status ikony střih nebo natáčení těma ikonama, co už máme, a u toho
     * název projektu"). Ikona je tatáž kresba jako v kalendáři a v přehledu
     * dne - viz lib/ikonyTypu.
     */
    if (volby.studio && u.start <= ted && (u.druh === 'NATACENI' || u.druh === 'STRIH' || u.druh === 'CASTING')) {
      const ikona =
        u.druh === 'NATACENI' ? 'mikrofon-studio' : u.druh === 'STRIH' ? 'strih' : 'casting';
      kandidati.push({
        konec: u.end,
        text: `${nazevProjektu(u.nazev)} do ${casStatusu(u.end)}`,
        emoji: null,
        ikona,
      });
      continue;
    }

    if (!volby.schuzky) continue;

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
  return {
    text: vyhra.text,
    emoji: vyhra.emoji,
    ikona: vyhra.ikona ?? null,
    doKdy: vyhra.konec.toISOString(),
    rucni: false,
  };
}

/**
 * CO PRÁVĚ TEĎ TOČÍ ZVUKAŘI - JEDNÍM DOTAZEM ZA VŠECHNY (oprava 3. 11. 2026:
 * „nejede chat").
 *
 * Do teď se tenhle status skládal přes `zKalendare`, tedy zvlášť pro každého
 * zvukaře, a ke každému se šlo do databáze pro celý jeho den (sloty, blokace,
 * porady, první frekvence, režie na dálku). Jeden dotaz navíc za jednoho
 * člověka vypadá nevinně, jenže běží JEDEN PO DRUHÉM a zvukařů přibývá -
 * s jedenáctým se seznam rozhovorů přestal stíhat načíst vůbec a chat zůstal
 * prázdný. Každý další zvukař by to zhoršil.
 *
 * Tady se proto ptáme na jednu jedinou věc: co z natáčení, střihu a castingu
 * PRÁVĚ TEĎ běží komukoliv z nich. Dva dotazy za celý tým místo pěti za
 * každého člověka, a ze statusu se nic neztratí - jméno projektu a do kdy to
 * jede je všechno, co se v chatu ukazuje.
 */
async function statusyZeStudia(ids: string[], ted: Date): Promise<Record<string, StatusVChatu>> {
  const vysledek: Record<string, StatusVChatu> = {};
  if (ids.length === 0) return vysledek;

  const [sloty, bloky] = await Promise.all([
    prisma.recordingSlot
      .findMany({
        where: {
          state: { in: ['SELECTED', 'CONFIRMED'] as never },
          zvukarUserId: { in: ids },
          start: { lte: ted },
          end: { gt: ted },
        },
        select: { zvukarUserId: true, start: true, end: true, request: { select: { projectName: true } } },
      })
      .catch(() => []),
    prisma.studioBlock
      .findMany({
        where: {
          kind: { in: ['NATACENI', 'STRIH', 'CASTING'] as never },
          zvukarUserId: { in: ids },
          start: { lte: ted },
          end: { gt: ted },
        },
        select: { zvukarUserId: true, start: true, end: true, kind: true, title: true },
      })
      .catch(() => []),
  ]);

  type Bezi = { kdo: string; konec: Date; nazev: string; ikona: string };
  const vse: Bezi[] = [
    ...(sloty as { zvukarUserId: string | null; end: Date; request: { projectName: string } }[])
      .filter((s) => s.zvukarUserId)
      .map((s) => ({
        kdo: s.zvukarUserId as string,
        konec: s.end,
        nazev: s.request.projectName,
        ikona: 'mikrofon-studio',
      })),
    ...(bloky as { zvukarUserId: string | null; end: Date; kind: string; title: string }[])
      .filter((b) => b.zvukarUserId)
      .map((b) => ({
        kdo: b.zvukarUserId as string,
        konec: b.end,
        nazev: b.title,
        ikona: b.kind === 'NATACENI' ? 'mikrofon-studio' : b.kind === 'STRIH' ? 'strih' : 'casting',
      })),
  ];

  // Když jich běží víc, vyhrává ta, která končí dřív - o ní má smysl říct
  // „do kdy" (stejné pravidlo jako v zKalendare).
  for (const u of vse) {
    const stavajici = vysledek[u.kdo];
    if (stavajici?.doKdy && new Date(stavajici.doKdy) <= u.konec) continue;
    vysledek[u.kdo] = {
      text: `${nazevProjektu(u.nazev)} do ${casStatusu(u.konec)}`,
      emoji: null,
      ikona: u.ikona,
      doKdy: u.konec.toISOString(),
      rucni: false,
    };
  }

  return vysledek;
}

/**
 * Statusy pro seznam lidí. Jeden dotaz na účty, jeden na „Mimo studio",
 * jeden za všechny zvukaře dohromady; den po dni se čte jen tomu, kdo má
 * zapnuté schůzky z kalendáře (zatím jeden člověk).
 */
/**
 * ČASOVÝ STROP (oprava 3. 11. 2026: „nejede chat"). Status je ozdoba - seznam
 * rozhovorů na něj nesmí čekat. Když se počítání do téhle doby nestihne,
 * vrátí se, co je hotové, a zbytek lidí zůstane bez statusu; za chvíli se
 * chat ptá znovu. Bez toho visel celý dotaz na seznam rozhovorů donekonečna
 * a chat zůstal prázdný.
 */
const LIMIT_MS = 4000;

export async function nactiStatusy(userIds: string[]): Promise<Record<string, StatusVChatu>> {
  const vysledek: Record<string, StatusVChatu> = {};
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return vysledek;

  const ted = TED();

  // Plní `vysledek` průběžně, takže i při doběhnutí stropu se to, co se
  // stihlo spočítat, do chatu dostane.
  async function spocitej(): Promise<void> {
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
            role: true,
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

      // Co zvukaři právě točí - jednou za všechny, viz statusyZeStudia.
      const zeStudia = await statusyZeStudia(
        lide.filter((c) => c.role === 'ZVUKAR' && !c.statusZKalendare).map((c) => c.id),
        ted,
      );

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

        /**
         * 3. Kalendář. Schůzky, castingy a režii skládáme jen tomu, kdo to má
         * zaškrtnuté („Tohle nastav jen mi"); natáčení a střih vidí u zvukaře
         * každý - je to jeho práce, ne jeho program.
         */
        const studio = clovek.role === 'ZVUKAR';
        if (!clovek.statusZKalendare && !studio) continue;
        /**
         * Kdo má zapnuté schůzky z kalendáře, potřebuje celý svůj den (porady,
         * casting, režie na dálku) - těm se počítá po jednom, je to pár lidí.
         * Zvukařům stačí to, co se právě točí, a to je spočítané dopředu
         * jedním dotazem za všechny.
         */
        const zKal = clovek.statusZKalendare
          ? await zKalendare(clovek.id, ted, { schuzky: true, studio }).catch(() => null)
          : (zeStudia[clovek.id] ?? null);
        if (zKal) vysledek[clovek.id] = zKal;
      }
    } catch (err) {
      // Chat se kvůli statusům rozbít nesmí - v nejhorším nebude ani jeden.
      console.error('Nacteni statusu selhalo:', err);
    }
  }

  await Promise.race([
    spocitej(),
    new Promise<void>((hotovo) => setTimeout(hotovo, LIMIT_MS)),
  ]);

  return vysledek;
}

/** Status jednoho člověka - pro vlastní kartu a pro API. */
export async function nactiStatus(userId: string): Promise<StatusVChatu | null> {
  const mapa = await nactiStatusy([userId]);
  return mapa[userId] ?? null;
}
