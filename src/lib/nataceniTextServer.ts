import { prisma } from '@/lib/db';
import { vytvorDokumentZDocx } from '@/lib/googleDrive';
import { docxNataceciTextu, rozmeryPng, type ObrazekVDokumentu } from '@/lib/nataceniTextDocx';
import { sDedenim, popisDelky, type VystupData } from '@/lib/vystupy';
import { nactiVystupy } from '@/lib/vystupyServer';
import {
  nazevDokumentu,
  sestavHtmlNataceni,
  VYCHOZI_VZOR_NATACENI,
  type PodkladyTextu,
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

export type PodkladyListu = {
  ok: true;
  vzor: { uvod: string | null; blok: string };
  podklady: PodkladyTextu;
  vystupy: VystupProText[];
  nazevProjektu: string;
};

/**
 * Data natáčecího listu - JEDEN zdroj pro náhled v portálu i pro dokument na
 * Disku. Náhled se z nich vykreslí jako HTML (v prohlížeči), dokument jako
 * .docx (ten Disk převádí spolehlivě). Kdyby si každá podoba tahala data
 * po svém, dřív nebo později by ukazovaly něco jiného.
 */
export async function podkladyNataceciTextu(
  caflouProjectId: string,
  vzorId?: string | null,
): Promise<PodkladyListu | { ok: false; duvod: string }> {
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
      /**
       * Text schválně ze SYROVÉHO výstupu, ne ze zděděného (30. 9. 2026):
       * downcut si text po hlavním spotu nedědí, protože je kratší - a kdyby
       * se tu vzal ze `sDedenim`, měly by všechny zkrácené verze v listu text
       * minutové verze.
       */
      text: syrovy.text,
    };
  });

  /**
   * DATUM POSLEDNÍ ÚPRAVY, NE DNEŠEK (zadání 26. 9. 2026: „dejme pryč datum
   * na tom dokumentu, to je zavádějící - dejme tam spíš poslední datum úpravy
   * toho dokumentu"). Dnešní datum na natáčecím listu se čte jako den
   * natáčení; tohle říká, jak je list starý.
   */
  const posledni = (await prisma.vystup
    .findFirst({
      where: { caflouProjectId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    })
    .catch(() => null)) as { updatedAt: Date } | null;

  const nazevProjektu = meta.name || `Projekt ${caflouProjectId}`;
  return {
    ok: true,
    vzor: { uvod: vzor.uvod ?? null, blok: vzor.blok },
    podklady: {
      projekt: nazevProjektu,
      upraveno: (posledni?.updatedAt ?? new Date()).toLocaleDateString('cs-CZ', {
        timeZone: 'Europe/Prague',
      }),
      logoUrl: `${zakladPortalu()}/mediaspace-logo-still.png`,
    },
    vystupy,
    nazevProjektu,
  };
}

/** Náhled listu v portálu. Dokument na Disku se skládá z týchž dat jako .docx. */
export async function htmlNataceciTextu(
  caflouProjectId: string,
  vzorId?: string | null,
  ramecekA4 = false,
): Promise<{ ok: true; html: string; nazevProjektu: string } | { ok: false; duvod: string }> {
  const podklad = await podkladyNataceciTextu(caflouProjectId, vzorId);
  if (!podklad.ok) return podklad;
  return {
    ok: true,
    html: sestavHtmlNataceni(podklad.vzor, podklad.podklady, podklad.vystupy, ramecekA4),
    nazevProjektu: podklad.nazevProjektu,
  };
}

/**
 * Logo do hlavičky dokumentu. Když se nepodaří stáhnout, vrátí se `null`
 * a list se vyrobí bez něj - prázdný dokument kvůli chybějícímu obrázku by
 * byl horší než list bez loga.
 */
async function nactiLogo(): Promise<ObrazekVDokumentu | null> {
  try {
    const res = await fetch(`${zakladPortalu()}/mediaspace-logo-still.png`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    const rozmery = rozmeryPng(data);
    return rozmery ? { data, ...rozmery } : null;
  } catch (err) {
    console.error('Logo do natáčecího listu se nepodařilo načíst:', err);
    return null;
  }
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

    const podklad = await podkladyNataceciTextu(caflouProjectId, vzorId);
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

    const docx = docxNataceciTextu(podklad.vzor, podklad.podklady, podklad.vystupy, await nactiLogo());
    const vysledek = await vytvorDokumentZDocx(slozka, nazev, docx);
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
