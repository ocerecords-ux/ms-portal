import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isRodnyListProjectType } from '@/lib/priceList';
import { nactiVystupy } from '@/lib/vystupyServer';
import {
  sekceProProjekt,
  sekceZJsonu,
  type DruhParametru,
  type KontextProjektu,
  type SekceTech,
  type TechnickyProfilData,
} from '@/lib/technickeParametry';

/**
 * TECHNICKÉ PARAMETRY - čtení a zápis (zadání 27. 9. 2026).
 *
 * KDO SMÍ UPRAVOVAT: příznak `spravujeTechParametry` na účtu - stejný princip
 * jako u Banky a manažerů projektu. Zadání bylo „měnit to můžu hromadně já
 * nebo Peter. Ostatní zvukaři by to neměli mít možnost upravovat", takže role
 * Žůžo-labůžo nestačí: tu má i produkce.
 *
 * ČÍST to smí každý z týmu - zvukař parametry potřebuje, jen do nich nesahá.
 */

const VYBER = {
  id: true,
  nazev: true,
  druh: true,
  perex: true,
  sekce: true,
  vychozi: true,
  aktivni: true,
  poradi: true,
  firmy: { select: { id: true, name: true }, orderBy: { name: 'asc' as const } },
};

type RadekZDb = {
  id: string;
  nazev: string;
  druh: string;
  perex: string | null;
  sekce: unknown;
  vychozi: boolean;
  aktivni: boolean;
  poradi: number;
  firmy: { id: string; name: string }[];
};

function naProfil(r: RadekZDb): TechnickyProfilData {
  return {
    id: r.id,
    nazev: r.nazev,
    druh: (r.druh === 'REKLAMA' ? 'REKLAMA' : 'AUDIOKNIHA') as DruhParametru,
    perex: r.perex,
    sekce: sekceZJsonu(r.sekce),
    vychozi: r.vychozi,
    aktivni: r.aktivni,
    poradi: r.poradi,
    firmy: r.firmy,
  };
}

/** Smí do šablon sahat? Příznak na účtu, ne role. */
export async function smiSpravovatParametry(userId?: string | null): Promise<boolean> {
  const id = userId ?? (await getServerSession(authOptions))?.user?.id;
  if (!id) return false;
  const u = (await prisma.user.findUnique({
    where: { id },
    select: { active: true, spravujeTechParametry: true },
  })) as { active: boolean; spravujeTechParametry: boolean } | null;
  return Boolean(u?.active && u.spravujeTechParametry);
}

export async function nactiProfily(): Promise<TechnickyProfilData[]> {
  const radky = (await prisma.technickyProfil.findMany({
    select: VYBER,
    orderBy: [{ druh: 'asc' }, { poradi: 'asc' }, { nazev: 'asc' }],
  })) as unknown as RadekZDb[];
  return radky.map(naProfil);
}

export async function nactiProfil(id: string): Promise<TechnickyProfilData | null> {
  const r = (await prisma.technickyProfil.findUnique({
    where: { id },
    select: VYBER,
  })) as unknown as RadekZDb | null;
  return r ? naProfil(r) : null;
}

export type ZmenaProfilu = {
  nazev?: string;
  druh?: DruhParametru;
  perex?: string | null;
  sekce?: SekceTech[];
  vychozi?: boolean;
  aktivni?: boolean;
  poradi?: number;
  firmyIds?: string[];
};

export async function zalozProfil(zmena: ZmenaProfilu): Promise<TechnickyProfilData> {
  const r = (await prisma.technickyProfil.create({
    data: {
      nazev: zmena.nazev?.trim() || 'Nová sada',
      druh: zmena.druh ?? 'AUDIOKNIHA',
      perex: zmena.perex?.trim() || null,
      sekce: (zmena.sekce ?? []) as never,
      vychozi: zmena.vychozi ?? false,
      aktivni: zmena.aktivni ?? true,
      poradi: zmena.poradi ?? 100,
      firmy: zmena.firmyIds?.length ? { connect: zmena.firmyIds.map((id) => ({ id })) } : undefined,
    },
    select: VYBER,
  })) as unknown as RadekZDb;
  if (r.vychozi) await srovnejVychozi(r.id, r.druh);
  return naProfil(r);
}

export async function upravProfil(id: string, zmena: ZmenaProfilu): Promise<TechnickyProfilData | null> {
  const data: Record<string, unknown> = {};
  if (zmena.nazev !== undefined) data.nazev = zmena.nazev.trim() || 'Nová sada';
  if (zmena.druh !== undefined) data.druh = zmena.druh;
  if (zmena.perex !== undefined) data.perex = zmena.perex?.trim() || null;
  if (zmena.sekce !== undefined) data.sekce = zmena.sekce;
  if (zmena.vychozi !== undefined) data.vychozi = zmena.vychozi;
  if (zmena.aktivni !== undefined) data.aktivni = zmena.aktivni;
  if (zmena.poradi !== undefined) data.poradi = zmena.poradi;
  if (zmena.firmyIds !== undefined) data.firmy = { set: zmena.firmyIds.map((f) => ({ id: f })) };

  const r = (await prisma.technickyProfil.update({
    where: { id },
    data: data as never,
    select: VYBER,
  })) as unknown as RadekZDb | null;
  if (!r) return null;
  if (r.vychozi) await srovnejVychozi(r.id, r.druh);
  return naProfil(r);
}

export async function smazProfil(id: string): Promise<void> {
  await prisma.technickyProfil.delete({ where: { id } });
}

/** Výchozí sada smí být na druh jen jedna - jinak by se nevědělo, která platí. */
async function srovnejVychozi(id: string, druh: string): Promise<void> {
  await prisma.technickyProfil.updateMany({
    where: { druh, vychozi: true, NOT: { id } },
    data: { vychozi: false },
  });
}

export type ParametryProjektu = {
  profil: { id: string; nazev: string; perex: string | null; druh: DruhParametru };
  /** Sekce už profiltrované podle toho, co projekt dělá. */
  sekce: SekceTech[];
  /** Vzala se výchozí sada, protože firma vlastní nemá? */
  vychoziSada: boolean;
  firmaName: string | null;
};

/**
 * Parametry pro jeden projekt: podle firmy klienta a druhu zakázky.
 *
 * Když firma vlastní sadu nemá, vezme se výchozí - zvukař má vědět aspoň to,
 * co platí u nás, místo prázdné karty.
 */
export async function parametryProjektu(caflouProjectId: string): Promise<ParametryProjektu | null> {
  const meta = (await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: {
      companyId: true,
      companyName: true,
      projectType: true,
      company: { select: { id: true, name: true, dealsAds: true, dealsAudiobooks: true } },
    },
  })) as {
    companyId: string | null;
    companyName: string | null;
    projectType: string | null;
    company: { id: string; name: string; dealsAds: boolean; dealsAudiobooks: boolean } | null;
  } | null;

  const radiovySpot = await isRodnyListProjectType(meta?.projectType ?? null);
  const reklama = radiovySpot || Boolean(meta?.company?.dealsAds && !meta.company.dealsAudiobooks);
  const druh: DruhParametru = reklama ? 'REKLAMA' : 'AUDIOKNIHA';

  const firmaId = meta?.companyId ?? meta?.company?.id ?? null;
  const vlastni = firmaId
    ? ((await prisma.technickyProfil.findFirst({
        where: { druh, aktivni: true, firmy: { some: { id: firmaId } } },
        select: VYBER,
        orderBy: [{ poradi: 'asc' }],
      })) as unknown as RadekZDb | null)
    : null;

  const radek =
    vlastni ??
    ((await prisma.technickyProfil.findFirst({
      where: { druh, aktivni: true, vychozi: true },
      select: VYBER,
    })) as unknown as RadekZDb | null);

  if (!radek) return null;
  const profil = naProfil(radek);

  const kontext: KontextProjektu = { sluzby: [], radiovySpot };
  if (druh === 'REKLAMA') {
    const vystupy = await nactiVystupy(caflouProjectId);
    const sluzby = new Set<string>();
    for (const v of vystupy) for (const s of v.sluzby) sluzby.add(s);
    kontext.sluzby = [...sluzby];
    // Bez výstupů (nebo než je někdo vyplní) se neukáže nic - to by kartu
    // udělalo k ničemu. Pak platí všechno, co na službu nečeká.
    if (kontext.sluzby.length === 0) kontext.sluzby = ['voiceover', 'postprodukce', 'sounddesign'];
  }

  return {
    profil: { id: profil.id, nazev: profil.nazev, perex: profil.perex, druh: profil.druh },
    sekce: sekceProProjekt(profil, kontext),
    vychoziSada: !vlastni,
    firmaName: meta?.company?.name ?? meta?.companyName ?? null,
  };
}
