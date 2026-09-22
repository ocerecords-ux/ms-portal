import { prisma } from '@/lib/db';
import { uploadGeneratedPdf } from '@/lib/storage';
import { uploadPdfToDriveFolder } from '@/lib/googleDrive';
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
  /** Herci projektu (předvybraní). */
  herci: { id: string; jmeno: string }[];
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
  const media = (meta?.licence ?? []).map((l) => l.nazev).join(', ');
  const firma = meta?.company?.name ?? '';
  return {
    herci,
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
    select: { name: true, companyId: true, driveUrl: true, company: { select: { driveFolderUrl: true } } },
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

  // Kopie do složky projektu na Disku - best effort, důvod selhání se ukáže u listu.
  const slozka = meta.driveUrl || meta.company?.driveFolderUrl || null;
  const drive = slozka ? await uploadPdfToDriveFolder(slozka, fileName, pdf) : null;
  const driveError = !slozka
    ? 'Projekt ani firma nemají vyplněnou složku na Disku.'
    : drive && !drive.ok
      ? drive.duvod
      : null;

  const ll = await prisma.licencniList.create({
    data: {
      caflouProjectId,
      projectName: meta.name ?? vstup.nazevSpotu,
      companyId: meta.companyId,
      actorUserId: vstup.actorUserId,
      fileName,
      url: ulozeno.url,
      driveFileId: drive?.ok ? drive.id : null,
      driveUrl: drive?.ok ? drive.webViewLink : null,
      driveError,
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
