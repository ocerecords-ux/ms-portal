import { prisma } from '@/lib/db';
import { prehledNaDen } from '@/lib/ranniPrehledServer';
import { vidiNavod } from '@/lib/navody';
import { canViewCalendar, canManageCalendar } from '@/lib/roles';
import { nactiPorady } from '@/lib/poradyServer';
import { utcParts, zonedToUtc } from '@/lib/calendar';
import { bezTitulu } from '@/lib/jmena';
import type { Role } from '@prisma/client';

/**
 * ČÍM SE BRUNO MŮŽE PODÍVAT DO PORTÁLU (zadání 23. 9. 2026: „on by měl
 * normálně mít mozek a vnímat všechno, na co se ptám").
 *
 * Do teď Bruno jen četl chat a dostával hotový text. Na „co mě čeká zítra"
 * musel trefit vzorec v kódu; když ho netrefil, tvrdil, že kalendář nevidí.
 * To není přemýšlení, to je telefonní ústředna.
 *
 * TEĎ SE MŮŽE ZEPTAT SÁM. Dostane pár nástrojů - kalendář, projekty, úkoly,
 * návody - a rozhodne se, do kterého sáhne a kolikrát. Žádné hádání slov,
 * žádný seznam frází: rozumí otázce a jde si pro data.
 *
 * PRÁVA SE NEOBCHÁZEJÍ. Každý nástroj se ptá JMÉNEM TOHO, KDO PÍŠE - jeho
 * kalendář, jeho úkoly, návody pro jeho roli. Bruno tím nikomu nic
 * neodemyká; dělá jen to, co by ten člověk sám naklikal.
 *
 * PODÍVAT SE, NE SAHAT. Všechno je čtení. Zapisovat (strana, dotočeno) umí
 * Bruno dál jen v kanálu projektu, kde na to má zvláštní postup se dvěma
 * pojistkami - viz lib/brunoServer.ts.
 */

const PASMO = 'Europe/Prague';

export type KdoSePta = { userId: string; role: Role | string };

/** Popis nástrojů pro model (formát Anthropic API). */
export const NASTROJE = [
  {
    name: 'program_dne',
    description:
      'Co má ten, kdo se ptá, daný den v kalendáři: natáčení, castingy, porady, režie na dálku, a k tomu jeho otevřené úkoly. Pro víc dní zavolej vícekrát.',
    input_schema: {
      type: 'object' as const,
      properties: {
        den: {
          type: 'string',
          description: 'Datum ve tvaru RRRR-MM-DD. Dnešek je napsaný v zadání.',
        },
      },
      required: ['den'],
    },
  },
  {
    name: 'provoz_dne',
    description:
      'CELÝ provoz daného dne ve všech studiích - kdo co natáčí, kde, s kým a kdo je u toho zvukař, plus blokace a porady či schůzky, na které má ten, kdo se ptá, právo. Tohle použij vždycky, když se někdo ptá, co se ten den natáčí nebo co se ve studiích děje - ne jen na to svoje.',
    input_schema: {
      type: 'object' as const,
      properties: {
        den: { type: 'string', description: 'Datum ve tvaru RRRR-MM-DD.' },
      },
      required: ['den'],
    },
  },
  {
    name: 'hledej_projekt',
    description:
      'Najde projekty podle názvu nebo firmy. Vrátí stav, typ, herce, termíny a odkaz do portálu. Hodí se na „jak je na tom X" i na „kde najdu X".',
    input_schema: {
      type: 'object' as const,
      properties: {
        dotaz: { type: 'string', description: 'Část názvu projektu nebo firmy.' },
      },
      required: ['dotaz'],
    },
  },
  {
    name: 'moje_ukoly',
    description: 'Otevřené úkoly toho, kdo se ptá, i s termíny a tím, kdo je zadal.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'hledej_navod',
    description:
      'Prohledá návody k portálu (Nápověda) a vrátí kus textu i s odkazem. Používej, když se někdo ptá, jak se co dělá nebo kde co je.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dotaz: { type: 'string', description: 'Čemu se návod má věnovat, klidně jedno dvě slova.' },
      },
      required: ['dotaz'],
    },
  },
];

/** Spustí nástroj a vrátí text pro model. Nikdy nevyhazuje - chyba je taky odpověď. */
export async function spustNastroj(
  jmeno: string,
  vstup: Record<string, unknown>,
  kdo: KdoSePta,
): Promise<string> {
  try {
    switch (jmeno) {
      case 'program_dne':
        return await programDne(String(vstup.den ?? ''), kdo);
      case 'provoz_dne':
        return await provozDne(String(vstup.den ?? ''), kdo);
      case 'hledej_projekt':
        return await hledejProjekt(String(vstup.dotaz ?? ''));
      case 'moje_ukoly':
        return await mojeUkoly(kdo);
      case 'hledej_navod':
        return await hledejNavod(String(vstup.dotaz ?? ''), kdo);
      default:
        return `Takový nástroj nemám: ${jmeno}`;
    }
  } catch (err) {
    console.error(`Bruno: nastroj ${jmeno} selhal:`, err);
    return 'Nepovedlo se to zjistit, portál neodpověděl.';
  }
}

async function programDne(den: string, kdo: KdoSePta): Promise<string> {
  const shoda = /^(\d{4})-(\d{2})-(\d{2})$/.exec(den.trim());
  if (!shoda) return 'Datum musí být ve tvaru RRRR-MM-DD.';
  const kdy = zonedToUtc(Number(shoda[1]), Number(shoda[2]), Number(shoda[3]), 12, PASMO);
  return await prehledNaDen(kdo.userId, kdy);
}

/**
 * CO SE TEN DEN DĚJE VE VŠECH STUDIÍCH (zadání 23. 9. 2026: „já potřebuju,
 * ať ví všechno!").
 *
 * `program_dne` je osobní - moje natáčení, moje porady, moje úkoly. Tohle je
 * dispečink: celý den napříč studii, jak ho člověk vidí v Kalendáři. Právo je
 * stejné jako na stránku /kalendar, takže Bruno neukáže nic, co by si ten
 * člověk sám neotevřel. Porady zůstávají soukromé (jen ty, na kterých je),
 * Schůzky vidí produkce celé - viz lib/poradyServer.ts.
 */
async function provozDne(den: string, kdo: KdoSePta): Promise<string> {
  const shoda = /^(\d{4})-(\d{2})-(\d{2})$/.exec(den.trim());
  if (!shoda) return 'Datum musí být ve tvaru RRRR-MM-DD.';
  if (!canViewCalendar(kdo.role as Role)) return 'Na kalendář studií tenhle člověk nemá právo.';

  const od = zonedToUtc(Number(shoda[1]), Number(shoda[2]), Number(shoda[3]), 0, PASMO);
  const doKdy = new Date(od.getTime() + 24 * 3600_000);
  const cas = (d: Date) =>
    new Intl.DateTimeFormat('cs-CZ', { timeZone: PASMO, hour: '2-digit', minute: '2-digit' }).format(d);

  const [sloty, bloky, porady] = await Promise.all([
    prisma.recordingSlot
      .findMany({
        where: { state: { in: ['SELECTED', 'CONFIRMED'] as never }, start: { lt: doKdy }, end: { gt: od } },
        include: {
          studio: { select: { shortName: true } },
          request: { select: { projectName: true, actorName: true, caflouProjectId: true } },
        },
        orderBy: { start: 'asc' },
      })
      .catch(() => []),
    prisma.studioBlock
      .findMany({
        where: { start: { lt: doKdy }, end: { gt: od } },
        include: { studio: { select: { shortName: true } } },
        orderBy: { start: 'asc' },
      })
      .catch(() => []),
    nactiPorady(kdo.userId, od, doKdy, kdo.role).catch(() => []),
  ]);

  // Jména zvukařů jedním dotazem - v kalendáři jsou uložená jen jako id.
  const zvukariIds = [
    ...sloty.map((s) => s.zvukarUserId),
    ...bloky.map((b) => b.zvukarUserId),
  ].filter((x): x is string => Boolean(x));
  const zvukari = zvukariIds.length
    ? await prisma.user
        .findMany({ where: { id: { in: [...new Set(zvukariIds)] } }, select: { id: true, name: true, email: true } })
        .catch(() => [])
    : [];
  const jmenoZvukare = (id: string | null) => {
    if (!id) return null;
    const u = zvukari.find((z) => z.id === id);
    return u ? bezTitulu(u.name) || u.email : null;
  };

  const radky: string[] = [];

  for (const s of sloty) {
    const zvukar = jmenoZvukare(s.zvukarUserId);
    radky.push(
      `${cas(s.start)}–${cas(s.end)} · ${s.studio.shortName} · NATÁČENÍ: ${s.request.projectName} — ${s.request.actorName}${zvukar ? ` (zvukař ${zvukar})` : ' (zvukař nepřiřazen)'} · /projekty/${s.request.caflouProjectId}`,
    );
  }
  for (const b of bloky) {
    const zvukar = jmenoZvukare(b.zvukarUserId) ?? b.zvukarName;
    radky.push(
      `${cas(b.start)}–${cas(b.end)} · ${b.studio.shortName} · ${b.kind}: ${b.title}${b.actorName ? ` — ${b.actorName}` : ''}${zvukar ? ` (zvukař ${zvukar})` : ''}${b.caflouProjectId ? ` · /projekty/${b.caflouProjectId}` : ''}`,
    );
  }
  for (const p of porady) {
    radky.push(
      `${cas(new Date(p.start))}–${cas(new Date(p.end))} · ${p.druh === 'SCHUZKA' ? 'SCHŮZKA' : 'PORADA'}: ${p.nazev} — ${p.ucastnici.map((u) => u.label).join(', ')}`,
    );
  }

  if (radky.length === 0) return `${den}: v kalendáři toho dne není nic.`;

  const uvod = canManageCalendar(kdo.role as Role)
    ? `${den} — celý provoz:`
    : `${den} — provoz studií (porady jen ty vlastní):`;
  return [uvod, ...radky.sort()].join('\n');
}

async function hledejProjekt(dotaz: string): Promise<string> {
  const hledane = dotaz.trim();
  if (hledane.length < 2) return 'Napiš aspoň dvě písmena.';

  const projekty = await prisma.projectMeta.findMany({
    where: {
      OR: [
        { name: { contains: hledane, mode: 'insensitive' } },
        { companyName: { contains: hledane, mode: 'insensitive' } },
        { company: { name: { contains: hledane, mode: 'insensitive' } } },
      ],
    },
    select: {
      caflouProjectId: true,
      name: true,
      statusName: true,
      finished: true,
      projectType: true,
      pageCount: true,
      endDate: true,
      companyName: true,
      company: { select: { name: true } },
      herci: { select: { name: true, email: true } },
      manager: { select: { name: true, email: true } },
    },
    orderBy: [{ finished: 'asc' }, { name: 'asc' }],
    take: 8,
  });

  if (projekty.length === 0) return `Nic s „${hledane}" jsem nenašel.`;

  const datum = (d: Date | null) =>
    d ? new Intl.DateTimeFormat('cs-CZ', { timeZone: PASMO }).format(d) : null;

  return projekty
    .map((p) => {
      const casti = [
        `PROJEKT: ${p.name ?? p.caflouProjectId}`,
        `odkaz: /projekty/${p.caflouProjectId}`,
        `stav: ${p.statusName || (p.finished ? 'dokončeno' : 'neuvedeno')}`,
      ];
      if (p.projectType) casti.push(`typ: ${p.projectType}`);
      const firma = p.company?.name || p.companyName;
      if (firma) casti.push(`firma: ${firma}`);
      if (p.herci.length > 0) {
        casti.push(`herci: ${p.herci.map((h) => bezTitulu(h.name) || h.email).join(', ')}`);
      }
      if (p.manager) casti.push(`manažer: ${bezTitulu(p.manager.name) || p.manager.email}`);
      if (p.pageCount) casti.push(`rozsah: ${p.pageCount} NS`);
      const konec = datum(p.endDate);
      if (konec) casti.push(`termín: ${konec}`);
      return casti.join('\n');
    })
    .join('\n\n');
}

async function mojeUkoly(kdo: KdoSePta): Promise<string> {
  const ukoly = await prisma.task.findMany({
    where: { userId: kdo.userId, done: false },
    orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }],
    take: 25,
  });
  if (ukoly.length === 0) return 'Žádné otevřené úkoly.';

  const dnes = utcParts(new Date(), PASMO);
  const dnesek = zonedToUtc(dnes.year, dnes.month, dnes.day + 1, 0, PASMO);

  return ukoly
    .map((u) => {
      const termin = u.dueDate
        ? `do ${new Intl.DateTimeFormat('cs-CZ', { timeZone: PASMO }).format(u.dueDate)}${u.dueTime ? ` ${u.dueTime}` : ''}${u.dueDate < dnesek ? ' (dnes nebo po termínu)' : ''}`
        : 'bez termínu';
      const zadal = u.zadalJmeno ? `, zadal ${u.zadalJmeno}` : '';
      return `• ${u.title} — ${termin}${zadal}`;
    })
    .join('\n');
}

async function hledejNavod(dotaz: string, kdo: KdoSePta): Promise<string> {
  const slova = dotaz
    .toLocaleLowerCase('cs')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((s) => s.length > 2)
    .slice(0, 6);
  if (slova.length === 0) return 'Napiš, čeho se to má týkat.';

  const navody = await prisma.navod.findMany({
    where: {
      zverejneno: true,
      OR: slova.map((s) => ({ hledaci: { contains: s, mode: 'insensitive' as const } })),
    },
    select: { slug: true, nazev: true, perex: true, obsah: true, proRole: true, hledaci: true },
    take: 12,
  });

  const moje = navody.filter((n) => vidiNavod(n.proRole, String(kdo.role)));
  if (moje.length === 0) return `Na „${dotaz}" návod nemám.`;

  // Nejvic trefenych slov nahoru - kratky navod jinak vyhraje nad tim spravnym.
  const skore = (text: string) => slova.filter((s) => text.toLocaleLowerCase('cs').includes(s)).length;
  const serazene = [...moje].sort((a, b) => skore(b.hledaci) - skore(a.hledaci)).slice(0, 3);

  return serazene
    .map((n) => {
      // Kus textu kolem prvniho trefeneho slova - cely navod je na dlouhe lokty.
      const text = n.obsah.replace(/\s+/g, ' ');
      const kde = slova
        .map((s) => text.toLocaleLowerCase('cs').indexOf(s))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b)[0];
      const od = kde && kde > 200 ? kde - 200 : 0;
      const vyrez = text.slice(od, od + 1200);
      return `NÁVOD: ${n.nazev}\nodkaz: /napoveda/${n.slug}\n${n.perex ? `${n.perex}\n` : ''}${od > 0 ? '…' : ''}${vyrez}…`;
    })
    .join('\n\n');
}
