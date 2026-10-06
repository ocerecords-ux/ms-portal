import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { maPristup, podlehaPristupum, type KdoPristupy } from '@/lib/pristupy';
import { jeVideo } from '@/lib/pribehy';
import { vyvesPribeh } from '@/lib/instagramServer';
import { klicZAdresyUloziste, podepsanyOdkazNaPrilohu } from '@/lib/storage';

/**
 * PŘÍBĚHY NA INSTAGRAM - DATA (zadání 6. 10. 2026: „můžeme dát zvukařům
 * přístup, aby mohli posílat na instagram příběhy, aniž by měli přístup na
 * instagram?").
 *
 * CELÝ SMYSL JE ODDĚLENÍ. Zvukař nahraje fotku nebo video a text; účet,
 * heslo ani aplikaci Instagramu k tomu nepotřebuje. Vyvěsí to ten, kdo
 * k účtu přístup má - a portál si poznačí, že je to venku.
 *
 * ZATÍM SE VYVĚŠUJE RUKOU. Instagram publikování příběhů přes API umožňuje
 * (media_type=STORIES), ale vyžaduje oprávnění
 * `instagram_business_content_publish` a k němu schválení aplikace u Mety.
 * Dokud neprojde, schvalovatel soubor otevře, vyvěsí ho sám a zmáčkne
 * Vyvěšeno. Až schválení přijde, vymění se vnitřek toho jednoho tlačítka -
 * fronta ani obrazovka zvukaře se nemění.
 */

export type PribehRadek = {
  id: string;
  popisek: string;
  nazevSouboru: string;
  typSouboru: string;
  velikost: number;
  jeVideo: boolean;
  stav: string;
  vzkaz: string | null;
  autorId: string;
  autor: string;
  vyridil: string | null;
  vyrizenoAt: string | null;
  createdAt: string;
};

type Ucet = { id: string; role: string };

/** Zaškrtávátka člověka z databáze; prázdno, když se nedají přečíst. */
async function kdoJe(user: Ucet): Promise<KdoPristupy> {
  try {
    const u = (await prisma.user.findUnique({
      where: { id: user.id },
      select: { superadmin: true, pristupy: true, vidiSite: true },
    })) as { superadmin: boolean | null; pristupy: string[] | null; vidiSite: boolean | null } | null;
    return {
      role: user.role,
      superadmin: Boolean(u?.superadmin) || Boolean(u?.vidiSite),
      pristupy: u?.pristupy ?? [],
    };
  } catch (err) {
    console.error('Přístupy k Sítím se nepodařilo načíst:', err);
    return { role: user.role, superadmin: false, pristupy: [] };
  }
}

/**
 * Smí tenhle člověk poslat příběh ke schválení?
 *
 * `vidiSite` se bere jako superadmin záměrně: do 6. 10. 2026 to byl JEDINÝ
 * zámek celého modulu Sítě a Ondřej ho má zapnutý ze seedu. Bez tohohle by
 * si po zavedení zaškrtávátek musel práva nejdřív naklikat sám sobě.
 */
export async function smiPoslatPribeh(user: Ucet): Promise<boolean> {
  const kdo = await kdoJe(user);
  if (kdo.superadmin) return true;
  if (!podlehaPristupum(user.role)) return false;
  return maPristup(kdo, 'SITE.PRIBEHY_POSLAT');
}

/** Smí frontu vyřizovat - tedy vyvěsit nebo zamítnout? */
export async function smiSchvalovatPribehy(user: Ucet): Promise<boolean> {
  const kdo = await kdoJe(user);
  if (kdo.superadmin) return true;
  if (!podlehaPristupum(user.role)) return false;
  return maPristup(kdo, 'SITE.PRIBEHY_SCHVALIT');
}

const VYBER = {
  id: true,
  popisek: true,
  nazevSouboru: true,
  typSouboru: true,
  velikost: true,
  stav: true,
  vzkaz: true,
  autorId: true,
  vyrizenoAt: true,
  createdAt: true,
  autor: { select: { name: true, email: true } },
  vyridil: { select: { name: true, email: true } },
};

type Zaznam = {
  id: string;
  popisek: string;
  nazevSouboru: string;
  typSouboru: string;
  velikost: number;
  stav: string;
  vzkaz: string | null;
  autorId: string;
  vyrizenoAt: Date | null;
  createdAt: Date;
  autor: { name: string | null; email: string | null } | null;
  vyridil: { name: string | null; email: string | null } | null;
};

function jmeno(kdo: { name: string | null; email: string | null } | null): string {
  return kdo?.name?.trim() || kdo?.email || '';
}

function naRadek(p: Zaznam): PribehRadek {
  return {
    id: p.id,
    popisek: p.popisek,
    nazevSouboru: p.nazevSouboru,
    typSouboru: p.typSouboru,
    velikost: p.velikost,
    jeVideo: jeVideo(p.typSouboru),
    stav: p.stav,
    vzkaz: p.vzkaz,
    autorId: p.autorId,
    autor: jmeno(p.autor),
    vyridil: p.vyridil ? jmeno(p.vyridil) : null,
    vyrizenoAt: p.vyrizenoAt ? p.vyrizenoAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

/**
 * Fronta. Schvalovatel vidí všechno, ostatní jen své vlastní - zvukař nemá
 * důvod vidět, co posílá kolega.
 */
export async function nactiPribehy(user: Ucet): Promise<PribehRadek[]> {
  const vsechno = await smiSchvalovatPribehy(user);
  const vsechny = (await prisma.socialniPribeh.findMany({
    where: vsechno ? {} : { autorId: user.id },
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
    select: VYBER,
  })) as unknown as Zaznam[];
  return vsechny.map(naRadek);
}

export async function nactiPribeh(id: string): Promise<(PribehRadek & { url: string }) | null> {
  const p = (await prisma.socialniPribeh.findUnique({
    where: { id },
    select: { ...VYBER, url: true },
  })) as unknown as (Zaznam & { url: string }) | null;
  if (!p) return null;
  return { ...naRadek(p), url: p.url };
}

/** Komu dát vědět, že něco přišlo do fronty. */
async function schvalovatele(): Promise<{ id: string }[]> {
  try {
    return (await prisma.user.findMany({
      where: {
        active: true,
        OR: [
          { superadmin: true },
          { vidiSite: true },
          { pristupy: { has: 'SITE.PRIBEHY_SCHVALIT' } },
        ],
      },
      select: { id: true },
    })) as { id: string }[];
  } catch (err) {
    console.error('Schvalovatele příběhů se nepodařilo najít:', err);
    return [];
  }
}

export async function zalozPribeh(
  user: Ucet & { name?: string | null },
  vstup: {
    url: string;
    nazevSouboru: string;
    typSouboru: string;
    velikost: number;
    popisek: string;
  },
): Promise<PribehRadek> {
  const p = (await prisma.socialniPribeh.create({
    data: {
      autorId: user.id,
      url: vstup.url,
      nazevSouboru: vstup.nazevSouboru,
      typSouboru: vstup.typSouboru,
      velikost: vstup.velikost,
      popisek: vstup.popisek,
    },
    select: VYBER,
  })) as unknown as Zaznam;

  const radek = naRadek(p);
  for (const s of await schvalovatele()) {
    if (s.id === user.id) continue;
    await notify({
      userId: s.id,
      kind: 'pribeh-ke-schvaleni',
      title: 'Příběh ke schválení',
      body: `${radek.autor} poslal ${radek.jeVideo ? 'video' : 'fotku'} na Instagram.`,
      url: '/site/pribehy',
    });
  }
  return radek;
}

/**
 * Vyřízení. `stav` je VYVESENO nebo ZAMITNUTO; u zamítnutí má smysl vzkaz -
 * zvukař jinak netuší, proč to nešlo ven, a pošle to samé znovu.
 *
 * Vyřízený příběh se už nevrací do fronty. Kdyby se vyvěšení mělo opakovat,
 * je to nový příběh - takhle je ve frontě vidět, co se opravdu stalo.
 */
export async function vyridPribeh(
  user: Ucet,
  id: string,
  stav: 'VYVESENO' | 'ZAMITNUTO',
  vzkaz: string | null,
): Promise<PribehRadek | null> {
  const uz = (await prisma.socialniPribeh.findUnique({
    where: { id },
    select: { id: true, stav: true, autorId: true },
  })) as { id: string; stav: string; autorId: string } | null;
  if (!uz || uz.stav !== 'CEKA') return null;

  const p = (await prisma.socialniPribeh.update({
    where: { id },
    data: {
      stav,
      vzkaz: vzkaz?.trim() || null,
      vyridilId: user.id,
      vyrizenoAt: new Date(),
    },
    select: VYBER,
  })) as unknown as Zaznam;
  const radek = naRadek(p);

  if (uz.autorId !== user.id) {
    await notify({
      userId: uz.autorId,
      kind: 'pribeh-vyrizen',
      title: stav === 'VYVESENO' ? 'Příběh je venku' : 'Příběh neprošel',
      body: radek.vzkaz || (stav === 'VYVESENO' ? 'Vyvěsili jsme ho na Instagram.' : null),
      url: '/site/pribehy',
    });
  }
  return radek;
}

/**
 * VYVĚŠENÍ PŘÍMÉ Z PORTÁLU (6. 10. 2026).
 *
 * Instagram si soubor stáhne sám ze svých serverů, takže mu nejde poslat
 * odkaz do portálu (ten chce přihlášení) - dostane PODEPSANOU ADRESU
 * úložiště s půlhodinovou platností. U videa to chvíli trvá, protože Meta
 * video nejdřív zpracuje; viz vyvesPribeh v lib/instagramServer.ts.
 *
 * KDYŽ SE TO NEPOVEDE, FRONTA ZŮSTÁVÁ BEZE ZMĚNY a volá se důvod. Označit
 * příběh za vyvěšený, když venku není, je horší než chyba.
 */
export async function vyvesPribehNaInstagram(
  user: Ucet,
  id: string,
): Promise<{ ok: true; pribeh: PribehRadek } | { ok: false; chyba: string }> {
  const p = (await prisma.socialniPribeh.findUnique({
    where: { id },
    select: { url: true, nazevSouboru: true, typSouboru: true, stav: true },
  })) as { url: string; nazevSouboru: string; typSouboru: string; stav: string } | null;
  if (!p) return { ok: false, chyba: 'Příběh nenalezen.' };
  if (p.stav !== 'CEKA') return { ok: false, chyba: 'Tenhle příběh už někdo vyřídil.' };

  const klic = klicZAdresyUloziste(p.url);
  if (!klic) {
    return { ok: false, chyba: 'Soubor není v úložišti, Instagram si ho nemá odkud stáhnout.' };
  }
  const adresa = await podepsanyOdkazNaPrilohu(klic, p.nazevSouboru, false, 30 * 60);
  if (!adresa) return { ok: false, chyba: 'Úložiště souborů není dostupné.' };

  const vysledek = await vyvesPribeh(adresa, jeVideo(p.typSouboru));
  if (!vysledek.ok) return vysledek;

  const radek = await vyridPribeh(user, id, 'VYVESENO', null);
  if (!radek) {
    // Pribeh JE venku, jen se mezitim stav zmenil - nepredstirej neuspech.
    return { ok: false, chyba: 'Příběh je na Instagramu, ale ve frontě ho mezitím někdo vyřídil.' };
  }
  await prisma.socialniPribeh
    .update({ where: { id }, data: { externiId: vysledek.id } })
    .catch(() => undefined);
  return { ok: true, pribeh: radek };
}

/**
 * DO VYSKAKOVACÍ ZÁLOŽKY SÍTÍ V LEVÉM PANELU (zadání 6. 10. 2026: „chci
 * udělat vyskakovací záložku, kde budou soc. sítě, nalevo v portálu pod
 * rychlýma volbama").
 *
 * Volá to LAYOUT, tedy každá stránka portálu - proto se tu šetří na dvou
 * dotazech: jeden na práva z karty účtu a jeden na to, co čeká ve frontě.
 * Jméno instagramového účtu se schválně nenatáhá - je vidět na samotné
 * stránce a třetí dotaz na každém načtení za to nestojí.
 *
 * NIKDY NEVYHAZUJE: záložka navíc nesmí shodit celý portál.
 */
export type DokSiti = {
  /** Co čeká ve frontě - nejvýš pět, na náhledy v záložce. */
  cekajici: { id: string; jeVideo: boolean }[];
  /** Je jich víc než těch pět? Pak se u počtu ukáže „+". */
  vicNez: boolean;
  smiPoslat: boolean;
  smiSchvalit: boolean;
  smiPrispevky: boolean;
};

export async function nactiDokSiti(user: Ucet): Promise<DokSiti | null> {
  try {
    const u = (await prisma.user.findUnique({
      where: { id: user.id },
      select: { superadmin: true, pristupy: true, vidiSite: true, active: true },
    })) as {
      superadmin: boolean | null;
      pristupy: string[] | null;
      vidiSite: boolean | null;
      active: boolean;
    } | null;
    if (!u?.active) return null;

    const kdo: KdoPristupy = {
      role: user.role,
      superadmin: Boolean(u.superadmin) || Boolean(u.vidiSite),
      pristupy: u.pristupy ?? [],
    };
    const smi = (klic: string) => kdo.superadmin || (podlehaPristupum(user.role) && maPristup(kdo, klic));

    const smiPoslat = smi('SITE.PRIBEHY_POSLAT');
    const smiSchvalit = smi('SITE.PRIBEHY_SCHVALIT');
    const smiPrispevky = smi('SITE.PRISPEVKY');
    if (!smiPoslat && !smiSchvalit && !smiPrispevky) return null;

    let cekajici: { id: string; jeVideo: boolean }[] = [];
    let vicNez = false;
    if (smiPoslat || smiSchvalit) {
      const fronta = (await prisma.socialniPribeh.findMany({
        where: { stav: 'CEKA', ...(smiSchvalit ? {} : { autorId: user.id }) },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, typSouboru: true },
      })) as { id: string; typSouboru: string }[];
      vicNez = fronta.length > 5;
      cekajici = fronta.slice(0, 5).map((p) => ({ id: p.id, jeVideo: jeVideo(p.typSouboru) }));
    }

    return { cekajici, vicNez, smiPoslat, smiSchvalit, smiPrispevky };
  } catch (err) {
    console.error('Záložku Sítě se nepodařilo načíst:', err);
    return null;
  }
}

/** Autor může svůj příběh stáhnout, dokud se nikdo nerozhodl. */
export async function smazPribeh(user: Ucet, id: string): Promise<boolean> {
  const p = (await prisma.socialniPribeh.findUnique({
    where: { id },
    select: { autorId: true, stav: true },
  })) as { autorId: string; stav: string } | null;
  if (!p) return false;
  if (p.autorId !== user.id && !(await smiSchvalovatPribehy(user))) return false;
  if (p.stav !== 'CEKA' && p.autorId === user.id) return false;
  await prisma.socialniPribeh.delete({ where: { id } });
  return true;
}
