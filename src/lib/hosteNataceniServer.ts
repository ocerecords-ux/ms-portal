import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { buildIcs } from '@/lib/ics';
import { sendPozvankaNataceniEmail } from '@/lib/email';
import {
  adresaNaRadek,
  casKlienta,
  platnyHovorOdkaz,
  pozvankaJeNaPoslani,
  type HostData,
  type NataceniData,
} from '@/lib/hosteNataceni';

/**
 * HOSTÉ NA NATÁČENÍ - databázová část (zadání 30. 9. 2026).
 *
 * Čisté funkce a typy jsou v hosteNataceni.ts, aby se daly použít i ve
 * formuláři v prohlížeči.
 *
 * TERMÍN = UDÁLOST V KALENDÁŘI STUDIA (StudioBlock druhu NATACENI s tímhle
 * projektem). Schválně ne vlastní seznam termínů u projektu: natáčení se
 * plánuje v kalendáři a druhý seznam by se s ním dřív nebo později rozešel -
 * a pak by hostům chodily časy, které ve studiu neplatí.
 */

type BlokZDb = {
  id: string;
  start: Date;
  end: Date;
  title: string;
  actorName: string | null;
  hovorOdkaz: string | null;
  studio: {
    id: string;
    name: string;
    color: string | null;
    timezone: string;
    hovorOdkaz: string | null;
    adresa: string | null;
    mapaUrl: string | null;
    parkovani: string | null;
  };
  hoste: {
    id: string;
    jmeno: string | null;
    email: string;
    online: boolean;
    pozvankaAt: Date | null;
    pozvankaStart: Date | null;
    chybaOdeslani: string | null;
  }[];
};

const VYBER_BLOKU = {
  id: true,
  start: true,
  end: true,
  title: true,
  actorName: true,
  hovorOdkaz: true,
  studio: {
    select: {
      id: true,
      name: true,
      color: true,
      timezone: true,
      hovorOdkaz: true,
      adresa: true,
      mapaUrl: true,
      parkovani: true,
    },
  },
  hoste: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      jmeno: true,
      email: true,
      online: true,
      pozvankaAt: true,
      pozvankaStart: true,
      chybaOdeslani: true,
    },
  },
} as const;

function naHosta(h: BlokZDb['hoste'][number]): HostData {
  return {
    id: h.id,
    jmeno: h.jmeno,
    email: h.email,
    online: h.online,
    pozvankaAt: h.pozvankaAt?.toISOString() ?? null,
    pozvankaStart: h.pozvankaStart?.toISOString() ?? null,
    chybaOdeslani: h.chybaOdeslani,
  };
}

function naNataceni(b: BlokZDb): NataceniData {
  return {
    id: b.id,
    start: b.start.toISOString(),
    end: b.end.toISOString(),
    nazev: b.title,
    actorName: b.actorName,
    studioId: b.studio.id,
    studioNazev: b.studio.name,
    studioBarva: b.studio.color,
    adresa: b.studio.adresa,
    mapaUrl: b.studio.mapaUrl,
    parkovani: b.studio.parkovani,
    hovorOdkazVlastni: b.hovorOdkaz,
    hovorOdkaz: platnyHovorOdkaz(b.hovorOdkaz, b.studio.hovorOdkaz),
    hoste: (b.hoste ?? []).map(naHosta),
  };
}

/** Natáčení projektu z kalendáře, od nejbližšího. */
export async function nactiNataceniProjektu(caflouProjectId: string): Promise<NataceniData[]> {
  try {
    const bloky = await prisma.studioBlock.findMany({
      where: { caflouProjectId, kind: 'NATACENI' },
      orderBy: { start: 'asc' },
      select: VYBER_BLOKU,
    });
    return (bloky as unknown as BlokZDb[]).map(naNataceni);
  } catch (err) {
    console.error(`Načtení natáčení projektu ${caflouProjectId} selhalo:`, err);
    return [];
  }
}

/** Jedno natáčení i s projektem, ke kterému patří - pro úpravy přes API. */
export async function nactiNataceni(
  blockId: string,
): Promise<{ caflouProjectId: string | null; data: NataceniData } | null> {
  try {
    const b = await prisma.studioBlock.findUnique({
      where: { id: blockId },
      select: { ...VYBER_BLOKU, caflouProjectId: true },
    });
    if (!b) return null;
    const cely = b as unknown as BlokZDb & { caflouProjectId: string | null };
    return { caflouProjectId: cely.caflouProjectId, data: naNataceni(cely) };
  } catch (err) {
    console.error(`Načtení natáčení ${blockId} selhalo:`, err);
    return null;
  }
}

/**
 * Přidá hosty. Adresy, které u termínu už jsou, se přeskočí - vložení
 * seznamu podruhé tak nezaloží každého dvakrát.
 */
export async function pridejHosty(
  blockId: string,
  hoste: { jmeno: string | null; email: string; online: boolean }[],
  createdById: string | null,
): Promise<number> {
  if (hoste.length === 0) return 0;
  try {
    const stavajici = await prisma.hostNataceni.findMany({
      where: { blockId },
      select: { email: true },
    });
    const uz = new Set((stavajici as { email: string }[]).map((h) => h.email.toLowerCase()));
    // Duplicitu hlídá i samotná dávka: ve dvou řádcích formuláře může skončit
    // tatáž adresa a createMany by pak u natáčení nechal dva stejné hosty.
    const novi: typeof hoste = [];
    for (const h of hoste) {
      const klic = h.email.trim().toLowerCase();
      if (!klic || uz.has(klic)) continue;
      uz.add(klic);
      novi.push(h);
    }
    if (novi.length === 0) return 0;

    await prisma.hostNataceni.createMany({
      data: novi.map((h) => ({
        blockId,
        jmeno: h.jmeno?.trim() || null,
        email: h.email.trim(),
        online: h.online,
        createdById,
      })),
    });
    return novi.length;
  } catch (err) {
    console.error(`Přidání hostů k natáčení ${blockId} selhalo:`, err);
    return 0;
  }
}

export async function upravHosta(
  id: string,
  zmena: { jmeno?: string | null; online?: boolean },
): Promise<boolean> {
  try {
    const data: Record<string, unknown> = {};
    if (zmena.jmeno !== undefined) data.jmeno = zmena.jmeno?.trim() || null;
    if (zmena.online !== undefined) data.online = zmena.online;
    if (Object.keys(data).length === 0) return true;
    await prisma.hostNataceni.update({ where: { id }, data });
    return true;
  } catch (err) {
    console.error(`Úprava hosta ${id} selhala:`, err);
    return false;
  }
}

export async function smazHosta(id: string): Promise<boolean> {
  try {
    await prisma.hostNataceni.delete({ where: { id } });
    return true;
  } catch (err) {
    console.error(`Smazání hosta ${id} selhalo:`, err);
    return false;
  }
}

/** Odkaz na hovor jen pro tohle natáčení; prázdné = zase platí odkaz studia. */
export async function nastavHovorOdkaz(blockId: string, odkaz: string | null): Promise<boolean> {
  try {
    await prisma.studioBlock.update({
      where: { id: blockId },
      data: { hovorOdkaz: odkaz?.trim() || null },
    });
    return true;
  } catch (err) {
    console.error(`Uložení odkazu na hovor u natáčení ${blockId} selhalo:`, err);
    return false;
  }
}

/**
 * ČAS SLOVY V PÁSMU STUDIA. London točí v jiném pásmu než Brno a hostovi má
 * v mailu stát hodina, kterou uvidí na dveřích studia - ne ta pražská.
 *
 * Začátek je už POSUNUTÝ o rezervu na nachystání a zvukovou zkoušku
 * (REZERVA_KLIENTA_MIN) - hostovi se nikde nesmí objevit čas dohodnutý
 * s hercem. Konec zůstává, natáčení se kvůli rezervě neprodlužuje.
 */
function kdySlovy(nataceni: NataceniData, timezone: string, jazyk: 'cs' | 'en'): string {
  const start = casKlienta(nataceni.start);
  const end = new Date(nataceni.end);
  const den = new Intl.DateTimeFormat(jazyk === 'en' ? 'en-GB' : 'cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  }).format(start);
  const cas = (d: Date) =>
    new Intl.DateTimeFormat(jazyk === 'en' ? 'en-GB' : 'cs-CZ', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(d);
  return `${den}, ${cas(start)}–${cas(end)}`;
}

/**
 * KALENDÁŘOVÝ ZÁZNAM PRO HOSTA. Jeden skládací bod pro obojí: přílohu mailu
 * i odkaz „Přidat do kalendáře" (9. 10. 2026). Kdyby si každý stavěl svůj,
 * rozejdou se - a host by měl v kalendáři jiný čas, než mu přišel v mailu.
 */
export function icsProHosta(nataceni: NataceniData, host: HostData, nazevProjektu: string): string {
  const misto = adresaNaRadek(nataceni.studioNazev, nataceni.adresa);
  return buildIcs(nazevProjektu, [
    {
      // Stálé UID: po přesunu termínu si kalendář opraví tentýž záznam,
      // místo aby hostovi přibyl druhý.
      uid: `nataceni-host-${nataceni.id}@msportal.cz`,
      // Tentýž posunutý čas jako v mailu - host si termín uloží jedním
      // klepnutím a nesmí si do kalendáře dostat čas herce.
      start: casKlienta(nataceni.start),
      end: new Date(nataceni.end),
      summary: `Natáčení — ${nazevProjektu}`,
      location: host.online ? nataceni.hovorOdkaz || misto : misto,
      description: [
        nataceni.hovorOdkaz ? `Připojení: ${nataceni.hovorOdkaz}` : '',
        nataceni.parkovani?.trim() ? `Parkování: ${nataceni.parkovani.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      updatedAt: new Date(),
    },
  ]);
}

/**
 * ODKAZ „Přidat do kalendáře" (9. 10. 2026: „mělo by tam jít přidat tu událost
 * do kalendáře někde i s odkazem"). Příloha .ics sama nestačí: část schránek
 * ji schová mezi přílohy a na telefonu se klepnutím neotevře. Token se
 * vyrobí při prvním odeslání a dál se drží - po přesunu termínu vede tentýž
 * odkaz na opravený záznam, takže starý mail nezastará.
 */
async function kalendarOdkaz(hostId: string, baseUrl: string): Promise<string | null> {
  try {
    // Token se čte rovnou z databáze, ne z HostData - to jde až do prohlížeče
    // a odkaz z mailu v něm nemá co dělat.
    const radek = await prisma.hostNataceni.findUnique({
      where: { id: hostId },
      select: { kalendarToken: true },
    });
    let token = radek?.kalendarToken ?? null;
    if (!token) {
      token = randomBytes(24).toString('base64url');
      await prisma.hostNataceni.update({ where: { id: hostId }, data: { kalendarToken: token } });
    }
    return `${baseUrl}/api/nataceni-kalendar/${token}`;
  } catch (err) {
    console.error(`Odkaz do kalendáře pro hosta ${hostId} se nepodařilo připravit:`, err);
    return null;
  }
}

export type VysledekPozvanek = {
  odeslano: number;
  chyby: { email: string; duvod: string }[];
};

/**
 * POŠLE POZVÁNKY. `jenNove` (výchozí) vynechá ty, komu už pozvánka na tenhle
 * čas odešla - produkce tak může po přidání dalšího člověka kliknout znovu
 * a ostatním mail nepřijde podruhé. Když se termín posunul, do „nových" spadne
 * i ten, kdo už pozvánku měl: platí mu jiný čas.
 */
export async function posliPozvanky(
  blockId: string,
  volby: { jenNove?: boolean; odpovedNa?: string | null; projectName?: string | null } = {},
): Promise<VysledekPozvanek> {
  const nalezeno = await nactiNataceni(blockId);
  if (!nalezeno) return { odeslano: 0, chyby: [{ email: '', duvod: 'Natáčení se nepodařilo načíst.' }] };

  const nataceni = nalezeno.data;
  const studio = await prisma.studio
    .findUnique({ where: { id: nataceni.studioId }, select: { timezone: true } })
    .catch(() => null);
  const pasmo = (studio as { timezone: string } | null)?.timezone || 'Europe/Prague';

  const nazevProjektu = volby.projectName?.trim() || nataceni.nazev;
  const komu = (volby.jenNove ?? true)
    ? nataceni.hoste.filter((h) => pozvankaJeNaPoslani(h, nataceni.start))
    : nataceni.hoste;

  const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
  const vysledek: VysledekPozvanek = { odeslano: 0, chyby: [] };

  for (const host of komu) {
    /**
     * Přesun termínu se pozná podle toho, že hostovi už jedna pozvánka šla -
     * a mail pak začne tím, že platí ten nový čas. Bez toho by to vypadalo
     * jako druhá pozvánka na druhé natáčení.
     */
    const zmena = Boolean(host.pozvankaAt);
    const kdy = kdySlovy(nataceni, pasmo, 'cs');

    const ics = { nazev: 'nataceni.ics', obsah: icsProHosta(nataceni, host, nazevProjektu) };
    const kalendarUrl = await kalendarOdkaz(host.id, baseUrl);

    try {
      const odeslano = await sendPozvankaNataceniEmail({
        to: host.email,
        projectName: nazevProjektu,
        actorName: nataceni.actorName,
        kdy,
        studioName: nataceni.studioNazev,
        adresa: nataceni.adresa,
        mapaUrl: nataceni.mapaUrl,
        parkovani: nataceni.parkovani,
        hovorOdkaz: nataceni.hovorOdkaz,
        kalendarUrl,
        zmena,
        ics,
        odpovedNa: volby.odpovedNa ?? null,
      });

      if (!odeslano.sent) {
        const duvod = 'Pošta portálu není nastavená.';
        vysledek.chyby.push({ email: host.email, duvod });
        await prisma.hostNataceni
          .update({ where: { id: host.id }, data: { chybaOdeslani: duvod } })
          .catch(() => null);
        continue;
      }

      await prisma.hostNataceni.update({
        where: { id: host.id },
        data: {
          pozvankaAt: new Date(),
          pozvankaStart: new Date(nataceni.start),
          chybaOdeslani: null,
        },
      });
      vysledek.odeslano += 1;
    } catch (err) {
      console.error(`Pozvánka na natáčení pro ${host.email} neodešla:`, err);
      const duvod = 'Pozvánku se nepodařilo odeslat.';
      vysledek.chyby.push({ email: host.email, duvod });
      await prisma.hostNataceni
        .update({ where: { id: host.id }, data: { chybaOdeslani: duvod } })
        .catch(() => null);
    }
  }

  return vysledek;
}
