import { prisma } from '@/lib/db';
import {
  durationMinutes,
  entryAmount,
  formatCzk,
  formatDuration,
  formatTime,
  nazevDruhuPrace,
} from '@/lib/timesheets';
import { prelozit, type Jazyk } from '@/lib/jazyk';
import {
  sendMesicniPrehledEmail,
  sendMzdovyPodkladEmail,
  type MesicniPrehledInput,
} from '@/lib/email';
import { notify } from '@/lib/notifications';
import { jeZapnuto } from '@/lib/oznameniServer';

/**
 * MĚSÍČNÍ PŘEHLED VÝKAZŮ ZVUKAŘI (zadání 15. 9. 2026: „jednou za měsíc přijde
 * notifikace s přehledem výkazů za minulý měsíc zvukaři na mail. Mělo by to
 * chodit vždy 6. den v měsíci za minulý").
 *
 * PROČ ŠESTÝ A NE PRVNÍ: výkaz se dopisuje i pár dní zpětně. Kdyby přehled
 * odešel prvního, půlka posledního týdne by v něm chyběla a zvukař by dostal
 * číslo, které za chvíli neplatí.
 *
 * ODEŠLE SE JEN JEDNOU. Každé odeslání se zapisuje (model
 * MesicniPrehledOdeslan), takže úloha může běžet klidně vícekrát - druhý mail
 * už neodejde. Bez toho by stačil jeden restart úlohy a lidé mají přehled
 * dvakrát.
 *
 * KDO NIC NEDĚLAL, NIC NEDOSTANE. Prázdný přehled není informace, je to šum.
 */

export type VysledekRozeslani = {
  mesic: string;
  odeslano: number;
  preskoceno: number;
  chyby: number;
  /** Zprava je v administraci vypnuta - nic se nerozesilalo. */
  vypnuto?: boolean;
};

// --- Nastavení: kdy a co (zadání 21. 9. 2026) ------------------------------

export type NastaveniPrehledu = {
  den: number;
  castky: boolean;
  druhy: boolean;
  projekty: boolean;
  bonusy: boolean;
  poznamka: string | null;
  zmenilJmeno: string | null;
  zmenenoAt: Date | null;
};

export const VYCHOZI_NASTAVENI: NastaveniPrehledu = {
  den: 6,
  castky: true,
  druhy: true,
  projekty: true,
  bonusy: true,
  poznamka: null,
  zmenilJmeno: null,
  zmenenoAt: null,
};

/** Co není uložené, platí výchozí - nedostupná tabulka nesmí přehled umlčet. */
export async function nactiNastaveniPrehledu(): Promise<NastaveniPrehledu> {
  try {
    const r = await prisma.nastaveniPrehleduZvukaru.findUnique({ where: { id: 'vychozi' } });
    if (!r) return VYCHOZI_NASTAVENI;
    return {
      den: Math.min(28, Math.max(1, r.den)),
      castky: r.castky,
      druhy: r.druhy,
      projekty: r.projekty,
      bonusy: r.bonusy,
      poznamka: r.poznamka?.trim() || null,
      zmenilJmeno: r.zmenilJmeno,
      zmenenoAt: r.updatedAt,
    };
  } catch (err) {
    console.error('Nastavení měsíčního přehledu se nepodařilo načíst:', err);
    return VYCHOZI_NASTAVENI;
  }
}

/** Z přehledu zvukaře a nastavení poskládá obsah mailu. */
export function vstupMailu(p: PrehledZvukare, mesic: string, n: NastaveniPrehledu, odkaz: string): MesicniPrehledInput {
  const bonusy = n.castky && n.bonusy;
  return {
    to: p.email ?? '',
    mesic: nazevMesice(mesic),
    hodiny: formatDuration(p.minut),
    castka: formatCzk(p.castka),
    celkem: formatCzk(p.castka + (bonusy ? p.bonusCelkem : 0)),
    druhy: n.druhy
      ? p.druhy.map((d) => ({ nazev: d.nazev, hodiny: formatDuration(d.minut), castka: formatCzk(d.castka) }))
      : [],
    projekty: n.projekty ? p.projekty.map((pr) => ({ nazev: pr.nazev, hodiny: formatDuration(pr.minut) })) : [],
    // Soupis všech výkazů chodí vždycky - je to jádro výpisu, ne doplněk,
    // který by se dal v nastavení vypnout (12. 10. 2026).
    vykazy: p.polozky,
    bonusy: bonusy ? p.bonusy.map((b) => ({ nazev: b.nazev, castka: formatCzk(b.castka) })) : [],
    bonusCelkem: bonusy && p.bonusCelkem > 0 ? formatCzk(p.bonusCelkem) : null,
    odkaz,
    castkyViditelne: n.castky,
    poznamka: n.poznamka,
    den: n.den,
  };
}

/** Dnešní den v měsíci v pražském čase. */
export function dnesniDenPraha(dnes = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', day: 'numeric' }).format(dnes));
}

/** Předchozí měsíc vůči dnešku jako „2026-08". */
export function minulyMesic(dnes = new Date()): string {
  const d = new Date(Date.UTC(dnes.getUTCFullYear(), dnes.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** „2026-08" → „Srpen 2026". */
export function nazevMesice(mesic: string, jazyk?: Jazyk): string {
  const [rok, cislo] = mesic.split('-');
  // Jazyk je NEPOVINNY (vzor nazevMeny z davky 4): bez nej cesky, aby posta
  // mluvila dal jazykem prijemce a ne jazykem listy.
  const jmeno = prelozit(jazyk ?? 'cs', `obecne.mesic.${Number(cislo)}`);
  return `${jmeno.charAt(0).toUpperCase()}${jmeno.slice(1)} ${rok}`;
}

export type PrehledZvukare = {
  userId: string;
  jmeno: string;
  email: string | null;
  /** Adresa mzdové účetní z karty uživatele (12. 10. 2026). Null = neposílá se. */
  mzdyEmail: string | null;
  minut: number;
  castka: number;
  /** Rozpad podle druhu práce - kolik minut a kolik korun. */
  druhy: { nazev: string; minut: number; castka: number }[];
  /** Projekty, na kterých v měsíci dělal, od nejvytíženějšího. */
  projekty: { nazev: string; minut: number }[];
  bonusy: { nazev: string; castka: number }[];
  bonusCelkem: number;
  /**
   * VŠECHNY VÝKAZY ZA MĚSÍC, den po dni (zadání 12. 10. 2026: „zvukařům
   * musí přijít výpis každého 6. den v měsíci se soupisem částek za minulý
   * měsíc. Všech výkazů, které tam za ten daný měsíc mají").
   *
   * Souhrn podle druhu práce a podle projektů na to nestačí - z něj si nikdo
   * nezkontroluje konkrétní den.
   */
  polozky: { datum: string; odDo: string; hodiny: string; druh: string; projekt: string; castka: string }[];
};


/** Sesbírá, co který zvukař za měsíc udělal. Nic neodesílá. */
export async function spoctiPrehledy(mesic: string, jazyk?: Jazyk): Promise<PrehledZvukare[]> {
  const [rok, cislo] = mesic.split('-').map(Number);
  const od = new Date(Date.UTC(rok, cislo - 1, 1));
  const do_ = new Date(Date.UTC(rok, cislo, 1));

  const vykazy = await prisma.timesheetEntry.findMany({
    where: { date: { gte: od, lt: do_ } },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, mzdyEmail: true } },
    },
  });

  // Bonusy se poctou k mesici, ve kterem se SCHVALILY - tehdy se o nich
  // clovek dozvedel a tehdy je „dostal".
  const bonusy = await prisma.bonusZvukare
    .findMany({
      where: { stav: 'SCHVALENO', rozhodnutoAt: { gte: od, lt: do_ } },
      select: { userId: true, castka: true, projectName: true, caflouProjectId: true },
    })
    .catch(() => []);

  const mapa = new Map<string, PrehledZvukare>();
  const zalozPolozku = (u: {
    id: string;
    name: string | null;
    email: string;
    mzdyEmail?: string | null;
  }): PrehledZvukare => {
    const stav = mapa.get(u.id);
    if (stav) return stav;
    const novy: PrehledZvukare = {
      userId: u.id,
      jmeno: u.name || u.email,
      email: u.email,
      mzdyEmail: u.mzdyEmail?.trim() || null,
      minut: 0,
      castka: 0,
      druhy: [],
      projekty: [],
      bonusy: [],
      bonusCelkem: 0,
      polozky: [],
    };
    mapa.set(u.id, novy);
    return novy;
  };

  const podleDruhu = new Map<string, Map<string, { minut: number; castka: number }>>();
  const podleProjektu = new Map<string, Map<string, number>>();

  // Po dnech od začátku měsíce - výpis se má dát projít shora dolů jako
  // kalendář, ne v pořadí, v jakém to zrovna vrátí databáze.
  const poDnech = [...vykazy].sort(
    (x, y) => x.date.getTime() - y.date.getTime() || x.startMinutes - y.startMinutes,
  );

  for (const v of poDnech) {
    if (v.user.role !== 'ZVUKAR') continue;
    const p = zalozPolozku(v.user);
    const minut = durationMinutes(v.startMinutes, v.endMinutes);
    const castka = entryAmount(v.startMinutes, v.endMinutes, v.hourlyRateSnapshot);
    p.minut += minut;
    p.castka += castka;

    const druhy = podleDruhu.get(v.userId) ?? new Map();
    const d = druhy.get(v.workType) ?? { minut: 0, castka: 0 };
    druhy.set(v.workType, { minut: d.minut + minut, castka: d.castka + castka });
    podleDruhu.set(v.userId, druhy);

    const nazevProjektu = v.projectName || (v.caflouProjectId ? `Projekt ${v.caflouProjectId}` : 'Bez projektu');

    p.polozky.push({
      // Datum se skládá ručně z UTC složek: `date` je den bez času a
      // `toLocaleDateString` by ho podle pásma serveru uměl posunout o den.
      datum: `${v.date.getUTCDate()}. ${v.date.getUTCMonth() + 1}. ${v.date.getUTCFullYear()}`,
      odDo: `${formatTime(v.startMinutes)}–${formatTime(v.endMinutes)}`,
      hodiny: formatDuration(minut),
      druh: nazevDruhuPrace(v.workType, jazyk),
      projekt: nazevProjektu,
      castka: formatCzk(castka),
    });
    const projekty = podleProjektu.get(v.userId) ?? new Map();
    projekty.set(nazevProjektu, (projekty.get(nazevProjektu) ?? 0) + minut);
    podleProjektu.set(v.userId, projekty);
  }

  for (const b of bonusy) {
    const p = mapa.get(b.userId);
    if (!p) continue; // bonus bez jedineho vykazu v mesici - prehled by byl matouci
    p.bonusy.push({ nazev: b.projectName || `Projekt ${b.caflouProjectId}`, castka: b.castka });
    p.bonusCelkem += b.castka;
  }

  for (const [userId, p] of mapa) {
    p.druhy = Array.from(podleDruhu.get(userId)?.entries() ?? [])
      .map(([klic, hodnoty]) => ({
        nazev: nazevDruhuPrace(klic as Parameters<typeof nazevDruhuPrace>[0], jazyk),
        ...hodnoty,
      }))
      .sort((a, b) => b.minut - a.minut);
    p.projekty = Array.from(podleProjektu.get(userId)?.entries() ?? [])
      .map(([nazev, minut]) => ({ nazev, minut }))
      .sort((a, b) => b.minut - a.minut);
  }

  return Array.from(mapa.values()).sort((a, b) => a.jmeno.localeCompare(b.jmeno, 'cs'));
}

/**
 * Rozešle přehledy za daný měsíc. Co už odešlo, se přeskočí.
 *
 * `znovu` tu přeskočení vypne (zadání 12. 10. 2026: „ty maily s výpisem
 * nedošly"). Když pošta mail spolkne, záznam „odesláno" zůstane a další
 * pokus už by se bez toho nekonal. Pouští to VÝHRADNĚ člověk z administrace -
 * úloha z Vercelu musí zůstat idempotentní, jinak by při každém dením běhu
 * poslala týž přehled znovu.
 */
export async function rozesliMesicniPrehledy(
  mesic: string,
  znovu = false,
): Promise<VysledekRozeslani> {
  // Vypinac v Administraci → Zpravy portalu (zadani 15. 9. 2026).
  if (!(await jeZapnuto('MESICNI_PREHLED'))) {
    return { mesic, odeslano: 0, preskoceno: 0, chyby: 0, vypnuto: true };
  }
  const prehledy = await spoctiPrehledy(mesic);
  const nastaveni = await nactiNastaveniPrehledu();
  const zaklad = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');

  let odeslano = 0;
  let preskoceno = 0;
  let chyby = 0;

  for (const p of prehledy) {
    if (!p.email) {
      preskoceno += 1;
      continue;
    }
    if (!znovu) {
      const uz = await prisma.mesicniPrehledOdeslan
        .findUnique({ where: { userId_mesic: { userId: p.userId, mesic } }, select: { id: true } })
        .catch(() => null);
      if (uz) {
        preskoceno += 1;
        continue;
      }
    }

    try {
      const vysledek = await sendMesicniPrehledEmail(vstupMailu(p, mesic, nastaveni, `${zaklad}/vykazy`));
      if (!vysledek.sent) {
        chyby += 1;
        console.error(`Měsíční přehled pro ${p.email} neodešel: ${vysledek.reason}`);
        continue;
      }

      /**
       * PODKLAD MZDOVÉ ÚČETNÍ (12. 10. 2026). Jde až po zvukařově mailu
       * a VLASTNÍM zápisem - kdyby se nepovedl, nesmí to shodit přehled,
       * který už člověku odešel. Jen jméno, období, hodiny a částka.
       */
      if (p.mzdyEmail) {
        try {
          const mzdy = await sendMzdovyPodkladEmail({
            to: p.mzdyEmail,
            jmeno: p.jmeno,
            mesic: nazevMesice(mesic),
            hodiny: formatDuration(p.minut),
            castka: formatCzk(p.castka + p.bonusCelkem),
            den: nastaveni.den,
          });
          if (!mzdy.sent) {
            console.error(`Podklad pro mzdy (${p.jmeno}) na ${p.mzdyEmail} neodešel: ${mzdy.reason}`);
          }
        } catch (err) {
          console.error(`Podklad pro mzdy (${p.jmeno}) na ${p.mzdyEmail} selhal:`, err);
        }
      }

      // Upsert, ne create: při opakovaném odeslání už záznam existuje a
      // posune se mu jen datum.
      await prisma.mesicniPrehledOdeslan.upsert({
        where: { userId_mesic: { userId: p.userId, mesic } },
        create: { userId: p.userId, mesic, prijemce: p.email },
        update: { prijemce: p.email, odeslanoAt: new Date() },
      });
      await notify({
        userId: p.userId,
        kind: 'MESICNI_PREHLED',
        title: `Přehled výkazů — ${nazevMesice(mesic)}`,
        body: nastaveni.castky
          ? `${formatDuration(p.minut)} · ${formatCzk(p.castka + (nastaveni.bonusy ? p.bonusCelkem : 0))}`
          : formatDuration(p.minut),
        url: '/vykazy',
      });
      odeslano += 1;
    } catch (err) {
      chyby += 1;
      console.error(`Měsíční přehled pro ${p.email} selhal:`, err);
    }
  }

  return { mesic, odeslano, preskoceno, chyby };
}
