import { prisma } from '@/lib/db';
import { vytvorDokumentZHtml } from '@/lib/googleDrive';
import { sDedenim, popisDelky, type VystupData } from '@/lib/vystupy';
import { nactiVystupy } from '@/lib/vystupyServer';
import {
  nazevDokumentu,
  sestavHtmlNataceni,
  VYCHOZI_VZOR_NATACENI,
  type VystupProText,
} from '@/lib/nataceniText';

/**
 * NATÁČECÍ TEXT NA DISK (zadání 26. 9. 2026).
 *
 * Vyrobí z výstupů projektu jeden dokument, uloží ho do složky projektu na
 * Disku a k projektu si zapamatuje odkaz. Dál do něj portál nesahá - text
 * spotů se píše přímo v dokumentu.
 */

/** Vzory, ze kterých jde vybrat. Když žádný není, nabídne se ten výchozí. */
export async function nactiVzoryNataceni() {
  try {
    const vzory = await prisma.vzorNataceni.findMany({
      where: { active: true },
      orderBy: [{ vychozi: 'desc' }, { poradi: 'asc' }, { nazev: 'asc' }],
      select: { id: true, nazev: true, uvod: true, blok: true, vychozi: true },
    });
    return vzory as { id: string; nazev: string; uvod: string | null; blok: string; vychozi: boolean }[];
  } catch (err) {
    console.error('Načtení vzorů natáčecího textu selhalo:', err);
    return [];
  }
}

export type VysledekTextu =
  | { ok: true; url: string; nazev: string }
  | { ok: false; duvod: string };

/** Adresa portálu pro absolutní odkazy (logo v dokumentu). */
function zakladPortalu(): string {
  return (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
}

/**
 * HTML natáčecího listu - stejné pro náhled v portálu i pro dokument na Disku.
 * Záměrně jedna cesta: kdyby měl náhled vlastní, dřív nebo později by ukazoval
 * něco jiného, než co se opravdu uloží.
 */
export async function htmlNataceciTextu(
  caflouProjectId: string,
  vzorId?: string | null,
): Promise<{ ok: true; html: string; nazevProjektu: string } | { ok: false; duvod: string }> {
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: {
      name: true,
      companyName: true,
      company: { select: { name: true } },
    },
  });
  if (!meta) return { ok: false, duvod: 'Projekt se nepodařilo načíst.' };

  const vsechny = await nactiVystupy(caflouProjectId);
  if (vsechny.length === 0) {
    return { ok: false, duvod: 'Projekt nemá žádné výstupy — natáčecí text by byl prázdný.' };
  }

  const vzory = await nactiVzoryNataceni();
  const vzor =
    (vzorId ? vzory.find((v) => v.id === vzorId) : null) ?? vzory[0] ?? VYCHOZI_VZOR_NATACENI;

  const podleId = new Map(vsechny.map((v) => [v.id, v]));
  const licence = (await prisma.druhLicence
    .findMany({ select: { id: true, nazev: true } })
    .catch(() => [])) as { id: string; nazev: string }[];
  const nazvyLicenci = new Map(licence.map((l) => [l.id, l.nazev]));

  const vystupy: VystupProText[] = vsechny.map((syrovy) => {
    const v: VystupData = sDedenim(
      syrovy,
      syrovy.odvozenoZId ? podleId.get(syrovy.odvozenoZId) ?? null : null,
    );
    return {
      nazev: v.nazev,
      delka: popisDelky(v.delkaSekund),
      licence: v.licenceIds
        .map((id) => nazvyLicenci.get(id) || '')
        .filter(Boolean)
        .join(', '),
    };
  });

  const nazevProjektu = meta.name || `Projekt ${caflouProjectId}`;
  const html = sestavHtmlNataceni(
    vzor,
    {
      projekt: nazevProjektu,
      klient: meta.company?.name || meta.companyName || '',
      datum: new Date().toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' }),
      logoUrl: `${zakladPortalu()}/mediaspace-logo-still.png`,
    },
    vystupy,
  );

  return { ok: true, html, nazevProjektu };
}

export async function vyrobNataceciText(
  caflouProjectId: string,
  vzorId?: string | null,
): Promise<VysledekTextu> {
  try {
    const meta = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: {
        name: true,
        driveUrl: true,
        nataceniDocId: true,
        company: { select: { driveFolderUrl: true } },
      },
    });
    if (!meta) return { ok: false, duvod: 'Projekt se nepodařilo načíst.' };

    // Složka projektu, jinak složka firmy - dokument má být u zakázky, ale
    // lepší ve složce firmy než nikde.
    const slozka = meta.driveUrl || meta.company?.driveFolderUrl || null;
    if (!slozka) {
      return { ok: false, duvod: 'Projekt ani firma nemají složku na Disku, kam dokument uložit.' };
    }

    const podklad = await htmlNataceciTextu(caflouProjectId, vzorId);
    if (!podklad.ok) return { ok: false, duvod: podklad.duvod };

    // Další dokument u téhož projektu dostane do názvu datum a čas, ať se
    // rozepsaný text v tom prvním nikdy nepřepíše - portál do hotového
    // dokumentu nesahá a nový je vždycky nový soubor.
    const uzJeden = Boolean((meta as { nataceniDocId?: string | null }).nataceniDocId);
    const zakladNazvu = nazevDokumentu(podklad.nazevProjektu, 1);
    const nazev = uzJeden
      ? `${zakladNazvu} (${new Date().toLocaleString('cs-CZ', {
          timeZone: 'Europe/Prague',
          day: 'numeric',
          month: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })})`
      : zakladNazvu;

    const vysledek = await vytvorDokumentZHtml(slozka, nazev, podklad.html);
    if (!vysledek.ok) return { ok: false, duvod: vysledek.duvod };

    const url = vysledek.webViewLink || `https://docs.google.com/document/d/${vysledek.id}/edit`;
    await prisma.projectMeta.update({
      where: { caflouProjectId },
      data: { nataceniDocId: vysledek.id, nataceniDocUrl: url, nataceniDocAt: new Date() },
    });

    return { ok: true, url, nazev };
  } catch (err) {
    console.error(`Natáčecí text k projektu ${caflouProjectId} se nepodařilo vyrobit:`, err);
    return { ok: false, duvod: 'Natáčecí text se nepodařilo vyrobit.' };
  }
}
