import { prisma } from '@/lib/db';
import { uploadGeneratedPdf } from '@/lib/storage';
import { bezTitulu } from '@/lib/jmena';
import { licencniListFileName, renderLicencniListPdf, VYCHOZI_PODMINKY } from '@/lib/licencniListPdf';

/**
 * LICENČNÍ LISTY u reklam (zadání 22. 9. 2026) - viz lib/licencniListPdf.ts.
 *
 * Vystavuje se ručně v detailu projektu, záložka Licenční list: formulář je
 * předvyplněný z projektu (spot, klient, objednatel, herci, druhy licence,
 * datum výroby) a jeden list = jeden interpret. PDF se uloží k nám a kopie
 * do složky projektu na Disku, stejně jako Rodný list.
 */

export const DODAVATEL_LICENCE = 'MEDIA SPACE s.r.o.';
export const PODEPISUJE_LICENCI = 'Ondřej Černý';

export type VstupLicencnihoListu = {
  actorUserId: string | null;
  /** Výstup, ke kterému list patří - jeden list na výstup (27. 9. 2026). */
  vystupId?: string | null;
  nazevSpotu: string;
  klient: string;
  objednatel: string;
  dodavatel: string;
  interpret: string;
  typDila: string;
  uzemi: string;
  media: string;
  delkaLicence: string;
  typLicence: string;
  /** RRRR-MM-DD */
  datumVyroby: string;
  podminky: string;
  misto: string;
  podepisuje: string;
};

export type VychoziLicencniList = Omit<VstupLicencnihoListu, 'actorUserId' | 'interpret'> & {
  /** Herci projektu (předvybraní); `id` null = jen jméno bez účtu. */
  herci: { id: string | null; jmeno: string }[];
  /** Všichni herci z portálu - dají se přidat i ti, co u projektu nejsou. */
  vsichniHerci: { id: string; jmeno: string }[];
};

function datumCesky(d: Date): string {
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`;
}

/** Předvyplnění formuláře z údajů projektu. */
export async function vychoziLicencniList(caflouProjectId: string): Promise<VychoziLicencniList> {
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: {
      name: true,
      spotName: true,
      rlClientName: true,
      productionDate: true,
      company: { select: { name: true } },
      actorUserId: true,
      narrator: true,
      herci: { select: { id: true, name: true, email: true } },
      licence: { select: { nazev: true } },
    },
  });
  const vsichni = await prisma.user
    .findMany({ where: { role: 'HEREC', active: true }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } })
    .catch(() => []);
  const herci = [
    ...(meta?.herci ?? []).filter((h) => h.id === meta?.actorUserId),
    ...(meta?.herci ?? []).filter((h) => h.id !== meta?.actorUserId),
  ].map((h) => ({ id: h.id, jmeno: bezTitulu(h.name) || h.email }));
  // Herci napsaní u projektu jen jménem (bez účtu) - navrhnou se taky (22. 9. 2026).
  const rucne = (meta?.narrator ?? '')
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter((j) => j && !herci.some((h) => h.jmeno === j));
  const navrzeni: { id: string | null; jmeno: string }[] = [...herci, ...rucne.map((j) => ({ id: null, jmeno: j }))];
  const media = (meta?.licence ?? []).map((l) => l.nazev).join(', ');
  const firma = meta?.company?.name ?? '';
  return {
    herci: navrzeni,
    vsichniHerci: vsichni.map((h) => ({ id: h.id, jmeno: bezTitulu(h.name) || h.email })),
    nazevSpotu: meta?.spotName || meta?.name || '',
    klient: meta?.rlClientName || firma,
    objednatel: firma,
    dodavatel: DODAVATEL_LICENCE,
    typDila: media ? `Hlasový výkon pro audio spot na ${media}` : 'Hlasový výkon pro audio spot',
    uzemi: 'Česká republika',
    media,
    delkaLicence: '1 rok',
    typLicence: 'výhradní',
    datumVyroby: (meta?.productionDate ?? new Date()).toISOString().slice(0, 10),
    podminky: VYCHOZI_PODMINKY,
    misto: 'Brně',
    podepisuje: PODEPISUJE_LICENCI,
  };
}

/**
 * NÁHLED LISTU (zadání 27. 9. 2026: „a takhle s tím náhledem"). Vyrobí TOTÉŽ
 * PDF jako vystavení, jen se nikam neukládá - žádný záznam, žádný Disk.
 * Jedna cesta k dokumentu, takže se náhled a hotový list nemůžou rozejít.
 */
export function nahledLicencnihoListu(vstup: Omit<VstupLicencnihoListu, 'actorUserId'>): Buffer {
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(vstup.datumVyroby)
    ? new Date(`${vstup.datumVyroby}T00:00:00.000Z`)
    : new Date();
  const dnes = new Date();
  return renderLicencniListPdf({
    ...vstup,
    datumVyroby: datumCesky(datum),
    datum: `${dnes.getDate()}. ${dnes.getMonth() + 1}. ${dnes.getFullYear()}`,
  });
}

export async function nactiLicencniListy(caflouProjectId: string) {
  return prisma.licencniList.findMany({
    where: { caflouProjectId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fileName: true,
      interpret: true,
      uzemi: true,
      media: true,
      delkaLicence: true,
      typLicence: true,
      createdAt: true,
      driveUrl: true,
      driveError: true,
      nazevSpotu: true,
      vystupId: true,
    },
  });
}

export async function vystavLicencniList(
  caflouProjectId: string,
  vstup: VstupLicencnihoListu,
  userId: string | null,
): Promise<{ ok: true; id: string } | { ok: false; chyba: string }> {
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: { name: true, companyId: true },
  });
  if (!meta) return { ok: false, chyba: 'Projekt nenalezen.' };

  const datum = /^\d{4}-\d{2}-\d{2}$/.test(vstup.datumVyroby) ? new Date(`${vstup.datumVyroby}T00:00:00.000Z`) : new Date();
  const dnes = new Date();

  const pdf = renderLicencniListPdf({
    ...vstup,
    datumVyroby: datumCesky(datum),
    datum: `${dnes.getDate()}. ${dnes.getMonth() + 1}. ${dnes.getFullYear()}`,
  });
  const fileName = licencniListFileName(vstup.nazevSpotu, vstup.interpret);
  const ulozeno = await uploadGeneratedPdf(pdf, `licencni-listy/${caflouProjectId}`, fileName);
  if (!ulozeno) return { ok: false, chyba: 'PDF se nepodařilo uložit.' };

  /**
   * NA DISK SE LICENČNÍ LIST NEUKLÁDÁ (rozhodnutí 27. 9. 2026: „když vystavím
   * licenční listy, měl by je klient vidět v systému, neukládal bych nakonec
   * na disk"). Klient si je stáhne v portálu u zakázky; kopie na Disku by byla
   * druhá pravda, kterou nikdo neudržuje.
   */
  const ll = await prisma.licencniList.create({
    data: {
      caflouProjectId,
      projectName: meta.name ?? vstup.nazevSpotu,
      companyId: meta.companyId,
      actorUserId: vstup.actorUserId,
      fileName,
      url: ulozeno.url,
      driveFileId: null,
      driveUrl: null,
      driveError: null,
      vystupId: vstup.vystupId ?? null,
      nazevSpotu: vstup.nazevSpotu,
      klient: vstup.klient,
      objednatel: vstup.objednatel,
      dodavatel: vstup.dodavatel,
      interpret: vstup.interpret,
      typDila: vstup.typDila,
      uzemi: vstup.uzemi,
      media: vstup.media,
      delkaLicence: vstup.delkaLicence,
      typLicence: vstup.typLicence,
      datumVyroby: datum,
      podminky: vstup.podminky,
      misto: vstup.misto,
      podepisuje: vstup.podepisuje,
      createdByUserId: userId,
    },
  });
  return { ok: true, id: ll.id };
}

/**
 * VŠECHNY licenční listy projektů - pro přehled u klienta reklam, kde se
 * dokumenty stahují rovnou z řádku (25. 9. 2026). Od 27. 9. 2026 jich je
 * u zakázky tolik, kolik je výstupů, takže klient musí vidět všechny, ne jen
 * poslední; řadí se od nejnovějšího.
 */
export async function loadLicencniListyProjektu(
  caflouProjectIds: string[],
): Promise<Map<string, { id: string; fileName: string; nazevSpotu: string }[]>> {
  const vysledek = new Map<string, { id: string; fileName: string; nazevSpotu: string }[]>();
  if (caflouProjectIds.length === 0) return vysledek;
  try {
    const vsechny = (await prisma.licencniList.findMany({
      where: { caflouProjectId: { in: caflouProjectIds } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, fileName: true, nazevSpotu: true, caflouProjectId: true },
    })) as { id: string; fileName: string; nazevSpotu: string; caflouProjectId: string }[];
    for (const ll of vsechny) {
      const dosud = vysledek.get(ll.caflouProjectId) ?? [];
      dosud.push({ id: ll.id, fileName: ll.fileName, nazevSpotu: ll.nazevSpotu });
      vysledek.set(ll.caflouProjectId, dosud);
    }
  } catch (err) {
    console.error('Načtení licenčních listů pro přehled selhalo:', err);
  }
  return vysledek;
}
