import { prisma } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { sendRodnyListEmail } from '@/lib/email';
import { uploadGeneratedPdf } from '@/lib/storage';
import { uploadPdfToDriveFolder } from '@/lib/googleDrive';
import { renderRodnyListPdf } from '@/lib/rodnyListPdf';
import {
  formatProductionDate,
  formatSpotLength,
  isRodnyListTriggerStatus,
  missingFieldsMessage,
  missingRodnyListFields,
  musicLines,
  rodnyListFileName,
  RL_TRIGGER_STATUS,
  type RodnyListFields,
} from '@/lib/rodnyList';

/**
 * Běh Rodného listu - kdy vzniká, kam se ukládá, kdo se to dozví.
 * Zadání 9. 9. 2026.
 *
 * JAK SE POZNÁ „SKUTEČNÁ ZMĚNA STAVU"
 * Stav projektu žije v Caflou; portál do něj nezapisuje (viz lib/caflou.ts) a
 * žádnou událost o změně od Caflou nedostáváme. Poslední VIDĚNÝ stav se proto
 * drží u projektu (ProjectMeta.lastCaflouStatus) a RL se vyrobí jen tehdy,
 * když se stav oproti minule opravdu změnil na „Dokončeno - ke schválení".
 *
 * Dvě pojistky proti duplicitám:
 *   1) Když projekt vidíme poprvé (lastCaflouStatus je prázdný), stav se jen
 *      zapamatuje a NIC se negeneruje. Jinak by se při prvním nasazení
 *      hromadně vyrobily RL ke všem starým hotovým zakázkám.
 *   2) Když už RL k projektu existuje, automatika další nedělá - nová verze
 *      vzniká jen řízeně tlačítkem „Vygenerovat RL znovu".
 * Opakované otevření projektu ani refresh stránky tedy žádný dokument
 * nevyrobí - stav se od minule nezměnil.
 */

/** Co o projektu potřebujeme, abychom poznali přechod stavu. */
export type ProjectStatusSnapshot = {
  caflouProjectId: string;
  projectName: string;
  statusName: string;
  caflouCompanyId: string | null;
};

export type RodnyListResult =
  | { ok: true; rodnyListId: string; version: number }
  | { ok: false; reason: 'NO_COMPANY' | 'NOT_ADS' | 'MISSING_FIELDS' | 'FAILED'; message: string };

/** Prázdné hodnoty RL - použije se, když projekt ještě žádnou ProjectMeta nemá. */
function fieldsFromMeta(meta: Record<string, unknown> | null, fallbackSpotName: string): RodnyListFields {
  return {
    spotName: (meta?.spotName as string | null) || fallbackSpotName,
    spotLengthSeconds: (meta?.spotLengthSeconds as number | null) ?? null,
    directorName: (meta?.directorName as string | null) || '',
    musicTitle: (meta?.musicTitle as string | null) || '',
    musicAuthor: (meta?.musicAuthor as string | null) || '',
    noMusic: Boolean(meta?.noMusic),
    productionDate: (meta?.productionDate as Date | null) ?? null,
  };
}

/**
 * Kolik změn stavu se vyřídí v rámci jednoho zobrazení stránky. Zbytek se
 * dorovná při dalším načtení - je lepší, když se stránka vždycky rychle
 * ukáže, než aby se čekalo na dávku o stovkách zápisů.
 */
const MAX_ZMEN_NA_POZADAVEK = 20;

/**
 * Projede seznam projektů z Caflou a u těch, kde se stav od minule změnil,
 * zařídí, co má. Volá se ze stránek, které projekty stejně načítají
 * (přehled projektů, detail projektu) - žádný cron portál nemá.
 *
 * POZOR NA POČET ZÁPISŮ (oprava 9. 9. 2026): interní přehled sem posílá celý
 * účet Caflou, tedy stovky projektů. První verze na každý dosud neviděný
 * projekt pouštěla vlastní `upsert`, takže hned po nasazení musela stránka
 * počkat na ~700 zápisů do databáze za sebou (a každá instance funkce má jen
 * jedno spojení, viz lib/db.ts) - měřeno 12,5 s místo 1 s. Teď se projekty
 * viděné poprvé založí JEDNÍM dotazem a jednotlivě se řeší už jen skutečné
 * změny stavu, kterých bývá pár.
 *
 * Nikdy nevyhazuje: kdyby se RL nepodařil, projeví se to u projektu jako
 * chyba k prošetření, ne pádem stránky.
 */
export async function syncRodneListy(projects: ProjectStatusSnapshot[]): Promise<void> {
  const zajimave = projects.filter((p) => p.caflouProjectId && p.statusName);
  if (zajimave.length === 0) return;

  try {
    const metas = await prisma.projectMeta.findMany({
      where: { caflouProjectId: { in: zajimave.map((p) => p.caflouProjectId) } },
      select: { caflouProjectId: true, lastCaflouStatus: true },
    });
    const zname = new Map(metas.map((m) => [m.caflouProjectId, m.lastCaflouStatus]));

    // 1) Projekty, ke kterým ještě nemáme vůbec žádný záznam. Jedním dotazem
    //    si zapamatujeme jejich stav; nic se negeneruje, protože první setkání
    //    s projektem není přechod (jinak by po nasazení vznikly Rodné listy ke
    //    všem starým hotovým zakázkám naráz).
    const nove = zajimave.filter((p) => !zname.has(p.caflouProjectId));
    if (nove.length > 0) {
      await prisma.projectMeta.createMany({
        data: nove.map((p) => ({ caflouProjectId: p.caflouProjectId, lastCaflouStatus: p.statusName })),
        skipDuplicates: true,
      });
    }

    // 2) Projekty, které už v databázi máme a stav se u nich liší. Tady se
    //    zapisuje po jednom (každý má jinou hodnotu), proto ten strop.
    const zmenene = zajimave.filter(
      (p) => zname.has(p.caflouProjectId) && zname.get(p.caflouProjectId) !== p.statusName,
    );

    for (const projekt of zmenene.slice(0, MAX_ZMEN_NA_POZADAVEK)) {
      const predchozi = zname.get(projekt.caflouProjectId) ?? null;

      await prisma.projectMeta.update({
        where: { caflouProjectId: projekt.caflouProjectId },
        data: { lastCaflouStatus: projekt.statusName },
      });

      // Záznam bez zapamatovaného stavu (vznikl dřív kvůli jiným údajům
      // projektu) je pro nás taky první setkání - jen si stav poznamenáme.
      if (predchozi === null) continue;
      if (!isRodnyListTriggerStatus(projekt.statusName)) continue;

      await vytvorRodnyList(projekt, { trigger: 'AUTO' });
    }
  } catch (err) {
    console.error('syncRodneListy selhalo:', err);
  }
}

/**
 * Ruční znovuvygenerování (tlačítko „Vygenerovat RL znovu"). Na rozdíl od
 * automatiky vyrobí novou verzi i tehdy, když už RL existuje - typicky když
 * se opravily údaje. Klientovi se znovu neozýváme, aby mu po každé opravě
 * překlepu nechodil e-mail; od toho je automatický přechod stavu.
 */
export async function znovuVytvorRodnyList(
  projekt: ProjectStatusSnapshot,
  userId: string,
): Promise<RodnyListResult> {
  return vytvorRodnyList(projekt, { trigger: 'MANUAL', userId });
}

async function vytvorRodnyList(
  projekt: ProjectStatusSnapshot,
  opts: { trigger: 'AUTO' | 'MANUAL'; userId?: string },
): Promise<RodnyListResult> {
  const { caflouProjectId, projectName } = projekt;

  try {
    const company = projekt.caflouCompanyId
      ? await prisma.company.findFirst({
          where: { caflouCompanyId: projekt.caflouCompanyId },
          select: { id: true, name: true, dealsAds: true, driveFolderUrl: true },
        })
      : null;

    if (!company) {
      return { ok: false, reason: 'NO_COMPANY', message: 'K projektu není v portálu napojená firma.' };
    }

    // Podmínka ze zadání: bez přepínače „Reklamy" se RL nedělá.
    if (!company.dealsAds) {
      return { ok: false, reason: 'NOT_ADS', message: 'Firma nemá zapnuté „Reklamy".' };
    }

    const meta = await prisma.projectMeta.findUnique({ where: { caflouProjectId } });
    const fields = fieldsFromMeta(meta as Record<string, unknown> | null, projectName);
    const chybi = missingRodnyListFields({ ...fields, clientName: company.name });

    if (chybi.length > 0) {
      const message = missingFieldsMessage(chybi);
      await oznacKProsetreni(caflouProjectId, message, projectName, meta?.managerUserId ?? null);
      return { ok: false, reason: 'MISSING_FIELDS', message };
    }

    // Pojistka 2: automatika nikdy nepřepisuje ani nezdvojuje existující RL.
    const posledni = await prisma.rodnyList.findFirst({
      where: { caflouProjectId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });
    if (posledni && opts.trigger === 'AUTO') {
      return { ok: true, rodnyListId: posledni.id, version: posledni.version };
    }

    const hudba = musicLines(fields);
    const spotName = fields.spotName.trim();
    const pdf = renderRodnyListPdf({
      clientName: company.name,
      spotName,
      spotLength: formatSpotLength(fields.spotLengthSeconds),
      director: fields.directorName.trim(),
      musicTitle: hudba.title,
      musicAuthor: hudba.author,
      productionDate: formatProductionDate(fields.productionDate),
    });

    const version = (posledni?.version ?? 0) + 1;
    const fileName = rodnyListFileName(spotName);
    const ulozeno = await uploadGeneratedPdf(pdf, `rodne-listy/${caflouProjectId}/v${version}`, fileName);
    if (!ulozeno) {
      throw new Error('PDF se nepodařilo uložit do úložiště.');
    }

    // Google Disk je „hezký k mít": složka projektu bývá jen ke čtení, takže
    // se nahrání zkusí a případné selhání se jen poznamená. Odkaz v portálu
    // funguje tak jako tak, aby klient nikdy nekoukal na rozbitý odkaz.
    const driveFolderUrl = meta?.driveUrl || company.driveFolderUrl || null;
    const drive = driveFolderUrl ? await uploadPdfToDriveFolder(driveFolderUrl, fileName, pdf) : null;

    const rl = await prisma.rodnyList.create({
      data: {
        caflouProjectId,
        projectName,
        companyId: company.id,
        version,
        fileName,
        url: ulozeno.url,
        driveFileId: drive?.id ?? null,
        driveUrl: drive?.webViewLink ?? null,
        clientName: company.name,
        spotName,
        spotLength: formatSpotLength(fields.spotLengthSeconds),
        director: fields.directorName.trim(),
        musicTitle: hudba.title,
        musicAuthor: hudba.author,
        productionDate: fields.productionDate!,
        createdByUserId: opts.userId ?? null,
      },
    });

    // Úspěch smaže případnou předchozí chybu.
    await prisma.projectMeta.upsert({
      where: { caflouProjectId },
      create: { caflouProjectId, rlError: null },
      update: { rlError: null },
    });

    if (opts.trigger === 'AUTO') {
      await upozorniKlienta(rl.id, company.id, projectName, driveFolderUrl);
    }

    return { ok: true, rodnyListId: rl.id, version };
  } catch (err) {
    console.error(`Rodný list k projektu ${caflouProjectId} se nepodařilo vytvořit:`, err);
    const detail = err instanceof Error ? err.message : 'neznámá chyba';
    const message = `Rodný list se nepodařilo vytvořit (${detail}).`;
    await oznacKProsetreni(caflouProjectId, message, projectName, null);
    return { ok: false, reason: 'FAILED', message };
  }
}

/**
 * Projekt se označí jako „vyžaduje kontrolu" a interní tým se to dozví.
 * Klientovi se v takové chvíli NIC neposílá - to je celý smysl téhle větve.
 */
async function oznacKProsetreni(
  caflouProjectId: string,
  message: string,
  projectName: string,
  managerUserId: string | null,
) {
  try {
    await prisma.projectMeta.upsert({
      where: { caflouProjectId },
      create: { caflouProjectId, rlError: message },
      update: { rlError: message },
    });

    const interni = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'PRODUKCE'] }, active: true },
      select: { id: true },
    });

    await notifyMany([...interni.map((u) => u.id), managerUserId], {
      kind: 'rodny-list-chyba',
      title: `Rodný list: ${projectName}`,
      body: message,
      url: `/projekty/${encodeURIComponent(caflouProjectId)}`,
    });
  } catch (err) {
    console.error('Chybu u Rodného listu se nepodařilo zaznamenat:', err);
  }
}

/**
 * Notifikace klientovi - zvonek v portálu i e-mail. Používá stávající systém
 * notifikací (lib/notifications.ts), žádný vlastní se nezavádí.
 */
async function upozorniKlienta(
  rodnyListId: string,
  companyId: string,
  projectName: string,
  driveFolderUrl: string | null,
) {
  try {
    const prijemci = await prisma.user.findMany({
      where: { companyId, role: 'CLIENT', active: true },
      select: { id: true, name: true, email: true },
    });
    if (prijemci.length === 0) return;

    const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const rlUrl = `${baseUrl}/api/rodny-list/${rodnyListId}`;
    const nahravkyUrl = driveFolderUrl || `${baseUrl}/nahravky`;

    await notifyMany(
      prijemci.map((u) => u.id),
      {
        kind: 'rodny-list',
        title: `${projectName} — dokončeno, ke schválení`,
        body: 'Nahrávky jsou připravené a rodný list spotu je k dispozici.',
        url: `/api/rodny-list/${rodnyListId}`,
      },
    );

    for (const prijemce of prijemci) {
      try {
        await sendRodnyListEmail({
          to: prijemce.email,
          recipientName: prijemce.name || prijemce.email,
          projectName,
          statusName: RL_TRIGGER_STATUS,
          rodnyListUrl: rlUrl,
          recordingsUrl: nahravkyUrl,
        });
      } catch (err) {
        // Notifikace v portálu už visí, e-mail je jen druhý kanál.
        console.error(`E-mail o Rodném listu na ${prijemce.email} se nepodařilo odeslat:`, err);
      }
    }
  } catch (err) {
    console.error('Klientskou notifikaci o Rodném listu se nepodařilo odeslat:', err);
  }
}

/** Rodné listy k projektu, nejnovější verze první. */
export async function loadRodneListy(caflouProjectId: string) {
  try {
    return await prisma.rodnyList.findMany({
      where: { caflouProjectId },
      orderBy: { version: 'desc' },
    });
  } catch (err) {
    console.error('Načtení Rodných listů selhalo:', err);
    return [];
  }
}

/**
 * Nejnovější RL k několika projektům naráz - pro klientský přehled projektů,
 * kde se u řádku ukazuje odkaz na dokument.
 */
export async function loadNejnovejsiRodneListy(
  caflouProjectIds: string[],
): Promise<Map<string, { id: string; fileName: string }>> {
  const vysledek = new Map<string, { id: string; fileName: string }>();
  if (caflouProjectIds.length === 0) return vysledek;

  try {
    const vsechny = await prisma.rodnyList.findMany({
      where: { caflouProjectId: { in: caflouProjectIds } },
      orderBy: { version: 'desc' },
      select: { id: true, fileName: true, caflouProjectId: true },
    });
    for (const rl of vsechny) {
      if (!vysledek.has(rl.caflouProjectId)) {
        vysledek.set(rl.caflouProjectId, { id: rl.id, fileName: rl.fileName });
      }
    }
  } catch (err) {
    console.error('Načtení Rodných listů pro přehled selhalo:', err);
  }
  return vysledek;
}
