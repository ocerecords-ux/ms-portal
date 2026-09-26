import { prisma } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { sendRodnyListEmail } from '@/lib/email';
import { uploadGeneratedPdf } from '@/lib/storage';
import { uploadPdfToDriveFolder } from '@/lib/googleDrive';
import { renderRodnyListPdf } from '@/lib/rodnyListPdf';
import { isRodnyListProjectType, listRodnyListProjectTypes } from '@/lib/priceList';
import { nazevSpotuZVystupu, sDedenim, type VystupData } from '@/lib/vystupy';
import { nactiVystupy } from '@/lib/vystupyServer';
import {
  bezStarePredpony,
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
 * KDY SE DĚLÁ: jen u rádiových spotů (upřesnění 9. 9. 2026 - "platí to jen
 * u rádiových spotů"). Pozná se to podle TYPU PROJEKTU: položka ceníku má
 * příznak, který se přepíná v administraci. Přepínač „Reklamy" u firmy o tom
 * záměrně nerozhoduje - rádiový spot je rádiový spot bez ohledu na to, jestli
 * si to někdo u klienta pamatoval zaškrtnout.
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
  /**
   * Firma z portálu, když ji projekt sám nemá. Používá to odeslání faktury -
   * u faktury firma vždycky je, takže RL nespadne na „není napojená firma"
   * jen proto, že si to u projektu nikdo nevyplnil.
   */
  portalCompanyId?: string | null;
};

/** Proc se Rodny list nepovedlo vyrobit - stejne duvody u nahledu i naostro. */
export type RodnyListFailure = 'NO_COMPANY' | 'NOT_RADIO_SPOT' | 'MISSING_FIELDS' | 'FAILED';

export type RodnyListResult =
  | { ok: true; rodnyListId: string; version: number }
  | {
      ok: false;
      reason: RodnyListFailure;
      message: string;
    };

/** Prázdné hodnoty RL - použije se, když projekt ještě žádnou ProjectMeta nemá. */
function fieldsFromMeta(meta: Record<string, unknown> | null, fallbackSpotName: string): RodnyListFields {
  return {
    // Ocisteni stare predpony RL_ (oprava 10. 9. 2026) - viz bezStarePredpony.
    spotName: bezStarePredpony((meta?.spotName as string | null) || fallbackSpotName, fallbackSpotName),
    spotLengthSeconds: (meta?.spotLengthSeconds as number | null) ?? null,
    directorName: (meta?.directorName as string | null) || '',
    musicTitle: (meta?.musicTitle as string | null) || '',
    musicAuthor: (meta?.musicAuthor as string | null) || '',
    noMusic: Boolean(meta?.noMusic),
    productionDate: (meta?.productionDate as Date | null) ?? null,
  };
}

/**
 * VÝSTUPY, KE KTERÝM SE DĚLÁ RODNÝ LIST (zadání 26. 9. 2026, rozhodnutí téhož
 * dne: „vlastní RL pro každou délku").
 *
 * Pod jedním projektem může být rádiový spot (RL ano) i online voiceover
 * (RL ne) - rozhoduje TYP VÝSTUPU, ne typ projektu. Když výstup vlastní typ
 * nemá, platí typ projektu; downcut si typ podědí po hlavním spotu.
 *
 * Prázdný seznam znamená „projekt ještě výstupy nemá" a všechno běží po staru
 * z polí na ProjectMetě.
 */
async function vystupySRodnymListem(
  caflouProjectId: string,
  typProjektu: string | null | undefined,
): Promise<VystupData[]> {
  const vsechny = await nactiVystupy(caflouProjectId);
  if (vsechny.length === 0) return [];

  const typy = await listRodnyListProjectTypes();
  const podleId = new Map(vsechny.map((v) => [v.id, v]));

  return vsechny
    .map((v) => sDedenim(v, v.odvozenoZId ? podleId.get(v.odvozenoZId) ?? null : null))
    .filter((v) => typy.includes((v.typKlic || typProjektu || '').trim()));
}

/**
 * Hodnoty do dokumentu z výstupu.
 *
 * VÝSTUP DÁVÁ JEN NÁZEV A DÉLKU (zjednodušení 26. 9. 2026: „jednoduše ho
 * pojmenujeme vždy názvem a u toho zadáme licence a délku"). Režie, hudba,
 * datum výroby i klient na dokumentu se vyplňují jednou za projekt v záložce
 * Rodný list - u čtyř délek téhož spotu jsou stejně stejné a čtyřikrát
 * opsané by se jen rozcházely. Když u výstupu přesto něco vyplněného je
 * (starší záznam, převod), má to přednost.
 */
function fieldsZVystupu(
  vystup: VystupData,
  meta: Record<string, unknown> | null,
  nazevProjektu: string,
): RodnyListFields {
  const zProjektu = fieldsFromMeta(meta, nazevProjektu);
  return {
    spotName: nazevSpotuZVystupu(vystup, nazevProjektu),
    spotLengthSeconds: vystup.delkaSekund ?? zProjektu.spotLengthSeconds,
    directorName: vystup.rezie || zProjektu.directorName,
    musicTitle: vystup.hudbaNazev || zProjektu.musicTitle,
    musicAuthor: vystup.hudbaAutor || zProjektu.musicAuthor,
    noMusic: vystup.bezHudby || zProjektu.noMusic,
    productionDate: vystup.datumVyroby
      ? new Date(`${vystup.datumVyroby}T00:00:00.000Z`)
      : zProjektu.productionDate,
  };
}

/**
 * Kolik změn stavu se vyřídí v rámci jednoho zobrazení stránky. Zbytek se
 * dorovná při dalším načtení - je lepší, když se stránka vždycky rychle
 * ukáže, než aby se čekalo na dávku o stovkách zápisů.
 */
const MAX_ZMEN_NA_POZADAVEK = 20;

/**
 * Vyrábí se Rodný list sám při přechodu stavu? (zadání 10. 9. 2026)
 *
 * Zatím ne: dokud se ladí, co v něm má být, je lepší si ho vyrobit
 * tlačítkem a podívat se na výsledek, než aby vznikal sám a klientovi
 * chodily maily o něčem nedodělaném. Stav projektu se pamatuje dál, takže
 * po zapnutí nevzniknou Rodné listy ke všem starým zakázkám naráz.
 */
const AUTOMATIKA_RL = false;

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

      // AUTOMATIKA JE VYPNUTA (zadani 10. 9. 2026: "pojdme to zatim prepnout
      // do rucniho modu, abych si ho mohl zkusit vygenerovat kdykoli").
      // Stav se dal pamatuje - az se automatika zapne, nezacne generovat
      // Rodne listy ke vsem projektum zpetne.
      if (!AUTOMATIKA_RL) continue;

      // Projekt s výstupy dostane celou sadu naráz (26. 9. 2026); starší
      // projekty dál jeden dokument z polí na ProjectMetě.
      const sada = await vyrobRodneListySady(projekt, { trigger: 'AUTO' });
      if (sada.length === 0) await vytvorRodnyList(projekt, { trigger: 'AUTO' });
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

/**
 * Rodný list k jednomu konkrétnímu výstupu - tlačítko u řádku v záložce
 * Výstupy. Vyrobí novou verzi i tehdy, když už tam nějaká je (typicky po
 * opravě údajů); klientovi se přitom neozýváme.
 */
export async function vytvorRodnyListVystupu(
  projekt: ProjectStatusSnapshot,
  vystupId: string,
  userId: string,
): Promise<RodnyListResult> {
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId: projekt.caflouProjectId },
    select: { projectType: true },
  });
  const vystupy = await vystupySRodnymListem(projekt.caflouProjectId, meta?.projectType);
  const vystup = vystupy.find((v) => v.id === vystupId);
  if (!vystup) {
    return {
      ok: false,
      reason: 'NOT_RADIO_SPOT',
      message: 'K tomuhle výstupu se rodný list nedělá — má jiný typ.',
    };
  }
  return vytvorRodnyList(projekt, { trigger: 'MANUAL', userId, vystup });
}

/**
 * CELÁ SADA NARÁZ (zadání 26. 9. 2026). Při přechodu stavu se vyrobí rodné
 * listy ke všem výstupům, které ho mají mít a ještě ho nemají - u Strabagu
 * tedy čtyři dokumenty jedním během, ne čtyři kliknutí.
 *
 * Co se nepovede, se vrátí jmenovitě: hláška pak řekne, U KTERÉHO výstupu co
 * chybí, místo obecného „chybí délka spotu".
 */
export async function vyrobRodneListySady(
  projekt: ProjectStatusSnapshot,
  opts: { trigger: 'AUTO' | 'MANUAL'; userId?: string },
): Promise<{ vystup: VystupData; vysledek: RodnyListResult }[]> {
  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId: projekt.caflouProjectId },
    select: { projectType: true },
  });
  const vystupy = await vystupySRodnymListem(projekt.caflouProjectId, meta?.projectType);

  const vysledky: { vystup: VystupData; vysledek: RodnyListResult }[] = [];
  for (const vystup of vystupy) {
    vysledky.push({
      vystup,
      vysledek: await vytvorRodnyList(projekt, { ...opts, vystup, odlozitNotifikaci: true }),
    });
  }

  // Jedna zpráva za celou sadu - odkaz vede na první hotový dokument, zbytek
  // najde klient u projektu.
  if (opts.trigger === 'AUTO') {
    const prvni = vysledky.find((v) => v.vysledek.ok);
    if (prvni && prvni.vysledek.ok) {
      const rl = await prisma.rodnyList.findUnique({
        where: { id: prvni.vysledek.rodnyListId },
        select: { companyId: true },
      });
      const metaProDisk = await prisma.projectMeta.findUnique({
        where: { caflouProjectId: projekt.caflouProjectId },
        select: { driveUrl: true },
      });
      if (rl?.companyId) {
        await upozorniKlienta(
          prvni.vysledek.rodnyListId,
          rl.companyId,
          projekt.projectName,
          metaProDisk?.driveUrl ?? null,
        );
      }
    }
  }

  return vysledky;
}

async function vytvorRodnyList(
  projekt: ProjectStatusSnapshot,
  opts: {
    trigger: 'AUTO' | 'MANUAL';
    userId?: string;
    vystup?: VystupData;
    /** Klientovi se ozve volající až za celou sadu - viz vyrobRodneListySady. */
    odlozitNotifikaci?: boolean;
  },
): Promise<RodnyListResult> {
  const { caflouProjectId, projectName } = projekt;

  try {
    const meta = await prisma.projectMeta.findUnique({ where: { caflouProjectId } });

    // Podmínka ze zadání (upřesnění 9. 9. 2026): rozhoduje TYP PROJEKTU, ne
    // firma. Rodný list se dělá jen u rádiových spotů - tedy u typů, které
    // mají v ceníku zapnutý příznak (viz lib/priceList.ts).
    //
    // U výstupu (26. 9. 2026) rozhoduje jeho vlastní typ; sem se dostane jen
    // výstup, který už tím sítem prošel ve vystupySRodnymListem.
    if (!opts.vystup && !(await isRodnyListProjectType(meta?.projectType))) {
      return {
        ok: false,
        reason: 'NOT_RADIO_SPOT',
        message: 'Rodný list se vyrábí jen u rádiových spotů — projekt má jiný typ.',
      };
    }

    // Firma projektu: nejdriv podle toho, co je vyplnene v portalu, teprve
    // pak podle ID z Caflou. Projekt zalozeny v portalu zadne caflouCompanyId
    // nema - drive na tom vyroba RL vzdycky spadla na "neni napojena firma".
    const companyId = meta?.companyId ?? projekt.portalCompanyId ?? null;
    const company =
      (companyId
        ? await prisma.company.findUnique({
            where: { id: companyId },
            select: { id: true, name: true, driveFolderUrl: true },
          })
        : null) ??
      (projekt.caflouCompanyId
        ? await prisma.company.findFirst({
            where: { caflouCompanyId: projekt.caflouCompanyId },
            select: { id: true, name: true, driveFolderUrl: true },
          })
        : null);

    if (!company) {
      return { ok: false, reason: 'NO_COMPANY', message: 'K projektu není v portálu napojená firma.' };
    }
    const fields = opts.vystup
      ? fieldsZVystupu(opts.vystup, meta as Record<string, unknown> | null, projectName)
      : fieldsFromMeta(meta as Record<string, unknown> | null, projectName);
    // Klient na dokumentu: co je vyplnene u vystupu, jinak u projektu, jinak
    // nazev firmy (zadani 10. 9. 2026). Na RL obcas patri neco jineho nez
    // firma, ktere se fakturuje - agentura, koncovy zadavatel.
    const klientNaRL =
      (opts.vystup?.klientNaRL || '').trim() ||
      ((meta?.rlClientName as string | null) || '').trim() ||
      company.name;
    const chybi = missingRodnyListFields({ ...fields, clientName: klientNaRL });

    if (chybi.length > 0) {
      // U sady se musí poznat, U KTERÉHO výstupu co chybí - jinak je hláška
      // o chybějící délce k ničemu, když jsou spoty čtyři.
      const message = opts.vystup
        ? `${missingFieldsMessage(chybi)} (výstup „${opts.vystup.nazev}")`
        : missingFieldsMessage(chybi);
      // Rucni pokus projekt neoznacuje jako "vyzaduje kontrolu" (oprava
      // 10. 9. 2026): clovek stoji u formulare a chybu vidi hned. Cervena
      // cedule u projektu je pro automatiku, kde se to jinak nikdo nedozvi -
      // a kdyz visela i po rucnim pokusu, schovavala vypis chybejicich poli.
      if (opts.trigger === 'AUTO') {
        await oznacKProsetreni(caflouProjectId, message, projectName, meta?.managerUserId ?? null);
      }
      return { ok: false, reason: 'MISSING_FIELDS', message };
    }

    // Pojistka 2: automatika nikdy nepřepisuje ani nezdvojuje existující RL.
    // Verze se počítají v rámci výstupu - každý spot má vlastní řadu.
    const posledni = await prisma.rodnyList.findFirst({
      where: opts.vystup ? { caflouProjectId, vystupId: opts.vystup.id } : { caflouProjectId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });
    if (posledni && opts.trigger === 'AUTO') {
      return { ok: true, rodnyListId: posledni.id, version: posledni.version };
    }

    const hudba = musicLines(fields);
    const spotName = fields.spotName.trim();
    const pdf = renderRodnyListPdf({
      clientName: klientNaRL,
      spotName,
      spotLength: formatSpotLength(fields.spotLengthSeconds),
      director: fields.directorName.trim(),
      musicTitle: hudba.title,
      musicAuthor: hudba.author,
      productionDate: formatProductionDate(fields.productionDate),
    });

    const version = (posledni?.version ?? 0) + 1;
    const fileName = rodnyListFileName(spotName);
    // Cesta v úložišti nese i výstup - pod jedním projektem jich je víc a
    // „v1" by si jinak přepisovaly navzájem.
    const slozka = opts.vystup
      ? `rodne-listy/${caflouProjectId}/${opts.vystup.id}/v${version}`
      : `rodne-listy/${caflouProjectId}/v${version}`;
    const ulozeno = await uploadGeneratedPdf(pdf, slozka, fileName);
    if (!ulozeno) {
      throw new Error('PDF se nepodařilo uložit do úložiště.');
    }

    // Google Disk je „hezký k mít": nahrání se zkusí a případné selhání se jen
    // poznamená - odkaz v portálu funguje tak jako tak, aby klient nikdy
    // nekoukal na rozbitý odkaz. Důvod se ale od 10. 9. 2026 ukládá k RL a
    // ukazuje v seznamu verzí; dřív mizel do logu serveru.
    const driveFolderUrl = meta?.driveUrl || company.driveFolderUrl || null;
    const doSlozkyProjektu = Boolean(meta?.driveUrl);
    const drive = driveFolderUrl ? await uploadPdfToDriveFolder(driveFolderUrl, fileName, pdf) : null;
    const driveError = !driveFolderUrl
      ? 'Projekt ani firma nemají vyplněnou složku na Disku.'
      : drive && !drive.ok
        ? drive.duvod
        : !doSlozkyProjektu
          ? 'Uloženo do složky firmy — projekt zatím nemá vlastní složku na Disku.'
          : null;

    const rl = await prisma.rodnyList.create({
      data: {
        caflouProjectId,
        projectName,
        companyId: company.id,
        vystupId: opts.vystup?.id ?? null,
        vystupNazev: opts.vystup?.nazev ?? null,
        version,
        fileName,
        url: ulozeno.url,
        driveFileId: drive?.ok ? drive.id : null,
        driveUrl: drive?.ok ? drive.webViewLink : null,
        driveError,
        clientName: klientNaRL,
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

    // U sady se klientovi ozve až vyrobRodneListySady, a to JEDNOU se
    // seznamem - čtyři maily o čtyřech délkách téhož spotu nikdo nechce.
    if (opts.trigger === 'AUTO' && !opts.odlozitNotifikaci) {
      await upozorniKlienta(rl.id, company.id, projectName, driveFolderUrl);
    }

    return { ok: true, rodnyListId: rl.id, version };
  } catch (err) {
    console.error(`Rodný list k projektu ${caflouProjectId} se nepodařilo vytvořit:`, err);
    const detail = err instanceof Error ? err.message : 'neznámá chyba';
    const message = `Rodný list se nepodařilo vytvořit (${detail}).`;
    if (opts.trigger === 'AUTO') {
      await oznacKProsetreni(caflouProjectId, message, projectName, null);
    }
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
        body: 'Nahrávky jsou připravené a rodný list je k dispozici.',
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

/**
 * Náhled Rodného listu (zadání 10. 9. 2026: „chtěl bych, než se to někam
 * uloží, vidět nejdřív náhled").
 *
 * Vyrobí TOTÉŽ PDF jako ostrá cesta, ale nic neuloží: nevzniká verze, nic
 * se nenahrává do úložiště ani na Disk, klientovi se neozýváme a chyba se
 * projektu nepřipisuje. Je to jen podívání.
 *
 * Záměrně to jde přes stejnou funkci jako ostré vyrobení - kdyby měl náhled
 * vlastní cestu, dřív nebo později by ukazoval něco jiného, než co pak
 * doopravdy vznikne.
 */
/**
 * Rozepsané hodnoty z formuláře. Když přijdou, mají přednost před tím, co je
 * uložené - jinak by náhled ukazoval stav před poslední úpravou a nedalo by
 * se podle něj nic doladit.
 */
export type RozepsanyRodnyList = {
  clientName?: string;
  spotName?: string;
  spotLengthSeconds?: number | null;
  directorName?: string;
  musicTitle?: string;
  musicAuthor?: string;
  noMusic?: boolean;
  /** YYYY-MM-DD, jak ho dává <input type="date">. */
  productionDate?: string;
};

export async function nahledRodnehoListu(
  caflouProjectId: string,
  projectName: string,
  caflouCompanyId: string | null,
  rozepsane?: RozepsanyRodnyList,
): Promise<
  | { ok: true; pdf: Buffer; fileName: string }
  | { ok: false; reason: RodnyListFailure; message: string }
> {
  try {
    const meta = await prisma.projectMeta.findUnique({ where: { caflouProjectId } });

    if (!(await isRodnyListProjectType(meta?.projectType))) {
      return {
        ok: false,
        reason: 'NOT_RADIO_SPOT',
        message: 'Rodný list se vyrábí jen u rádiových spotů — projekt má jiný typ.',
      };
    }

    const company =
      (meta?.companyId
        ? await prisma.company.findUnique({
            where: { id: meta.companyId },
            select: { name: true },
          })
        : null) ??
      (caflouCompanyId
        ? await prisma.company.findFirst({
            where: { caflouCompanyId },
            select: { name: true },
          })
        : null);

    if (!company) {
      return { ok: false, reason: 'NO_COMPANY', message: 'K projektu není v portálu napojená firma.' };
    }

    const ulozene = fieldsFromMeta(meta as Record<string, unknown> | null, projectName);
    // Rozepsane hodnoty prebijou ulozene. Jinak receno: co ve formulari
    // neni, zustava tak, jak je ulozene.
    const fields: RodnyListFields = {
      spotName: rozepsane?.spotName ?? ulozene.spotName,
      spotLengthSeconds:
        rozepsane?.spotLengthSeconds !== undefined ? rozepsane.spotLengthSeconds : ulozene.spotLengthSeconds,
      directorName: rozepsane?.directorName ?? ulozene.directorName,
      musicTitle: rozepsane?.musicTitle ?? ulozene.musicTitle,
      musicAuthor: rozepsane?.musicAuthor ?? ulozene.musicAuthor,
      noMusic: rozepsane?.noMusic ?? ulozene.noMusic,
      productionDate: rozepsane?.productionDate
        ? new Date(`${rozepsane.productionDate}T00:00:00.000Z`)
        : rozepsane?.productionDate === ''
          ? null
          : ulozene.productionDate,
    };
    const klientNaRL =
      (rozepsane?.clientName ?? ((meta?.rlClientName as string | null) || '')).trim() || company.name;
    const chybi = missingRodnyListFields({ ...fields, clientName: klientNaRL });
    if (chybi.length > 0) {
      return { ok: false, reason: 'MISSING_FIELDS', message: missingFieldsMessage(chybi) };
    }

    const hudba = musicLines(fields);
    const spotName = fields.spotName.trim();
    const pdf = renderRodnyListPdf({
      clientName: klientNaRL,
      spotName,
      spotLength: formatSpotLength(fields.spotLengthSeconds),
      director: fields.directorName.trim(),
      musicTitle: hudba.title,
      musicAuthor: hudba.author,
      productionDate: formatProductionDate(fields.productionDate),
    });

    return { ok: true, pdf, fileName: rodnyListFileName(spotName) };
  } catch (err) {
    console.error(`Náhled Rodného listu k projektu ${caflouProjectId} selhal:`, err);
    const detail = err instanceof Error ? err.message : 'neznámá chyba';
    return { ok: false, reason: 'FAILED', message: `Náhled se nepodařilo vyrobit (${detail}).` };
  }
}

// ---------------------------------------------------------------------------
// RODNÝ LIST K FAKTUŘE (zadání 15. 9. 2026)
//
// „Když pošleme fakturu klientovi, tak automaticky s tím odeslal i rodný list
// a zároveň se uložil na disk k danému projektu. Když nebude mít vyplněné
// údaje o hudbě, nebo zaškrtnuté tlačítko, že nebyla ve spotu použita hudba,
// tak to musí zařvat a bez toho se faktura neodešle. Nastavit jen u rádiových
// spotů, kde se dělá rodný list."
//
// Kontrola se dělá nad SOUČASNÝMI údaji projektu, ne nad tím, co bylo v RL
// vyrobeném před měsícem - jinak by odešel rodný list, který už neplatí.
// ---------------------------------------------------------------------------

/** Co odeslání faktury o rodném listu potřebuje vědět. */
export type RodnyListKFakture =
  | { potreba: false }
  | { potreba: true; ok: false; message: string }
  | {
      potreba: true;
      ok: true;
      /**
       * Přílohy do mailu. Od 26. 9. 2026 jich může být víc: pod jedním
       * projektem je výstupů několik a každý má vlastní rodný list.
       */
      dokumenty: { nazev: string; pdf: Buffer; rodnyListId: string; version: number }[];
    };

/**
 * Připraví rodné listy pro odeslání faktury: zkontroluje údaje, v případě
 * potřeby vyrobí novou verzi (a nahraje ji na Disk projektu) a vrátí PDF do
 * přílohy. U projektů, které nejsou rádiový spot, vrací `potreba: false` -
 * faktura pak odejde jako dřív.
 *
 * OD 26. 9. 2026 PO VÝSTUPECH: když projekt výstupy má, projdou se všechny,
 * ke kterým se rodný list dělá, a v mailu je jich tolik, kolik se jich
 * vyrobilo. Když chybí údaje byť u jednoho, faktura nikam nejde a hláška
 * řekne, u kterého výstupu - jinak by klient dostal fakturu za čtyři spoty
 * a dokumenty jen ke třem.
 */
export async function rodnyListKFakture(input: {
  caflouProjectId: string;
  projectName: string;
  portalCompanyId?: string | null;
  userId?: string;
}): Promise<RodnyListKFakture> {
  const { caflouProjectId, projectName } = input;
  try {
    const meta = await prisma.projectMeta.findUnique({ where: { caflouProjectId } });

    const vystupy = await vystupySRodnymListem(caflouProjectId, meta?.projectType);

    // Jen rádiové spoty - stejná podmínka jako u výroby RL (typ z ceníku, ne
    // zaškrtávátko u firmy). U projektu s výstupy rozhoduje typ výstupu.
    if (vystupy.length === 0 && !(await isRodnyListProjectType(meta?.projectType))) {
      return { potreba: false };
    }

    const company =
      (meta?.companyId ?? input.portalCompanyId)
        ? await prisma.company.findUnique({
            where: { id: (meta?.companyId ?? input.portalCompanyId) as string },
            select: { name: true },
          })
        : null;

    // Buď po výstupech, nebo jednou z polí projektu (starší zakázky).
    const jednotky: (VystupData | null)[] = vystupy.length > 0 ? vystupy : [null];
    const dokumenty: { nazev: string; pdf: Buffer; rodnyListId: string; version: number }[] = [];

    for (const vystup of jednotky) {
      const fields = vystup
        ? fieldsZVystupu(vystup, meta as Record<string, unknown> | null, projectName)
        : fieldsFromMeta(meta as Record<string, unknown> | null, projectName);
      const klientNaRL =
        (vystup?.klientNaRL || '').trim() ||
        ((meta?.rlClientName as string | null) || '').trim() ||
        company?.name ||
        '';

      const chybi = missingRodnyListFields({ ...fields, clientName: klientNaRL });
      if (chybi.length > 0) {
        const kde = vystup ? ` (výstup „${vystup.nazev}")` : '';
        return {
          potreba: true,
          ok: false,
          message: `${missingFieldsMessage(chybi)}${kde} Doplňte je v detailu projektu — bez rodného listu fakturu odeslat nejde.`,
        };
      }

      const hudba = musicLines(fields);
      const spotName = fields.spotName.trim();
      const spotLength = formatSpotLength(fields.spotLengthSeconds);
      const director = fields.directorName.trim();
      const datum = formatProductionDate(fields.productionDate);

      const posledni = await prisma.rodnyList.findFirst({
        where: vystup ? { caflouProjectId, vystupId: vystup.id } : { caflouProjectId },
        orderBy: { version: 'desc' },
      });

      // Sedí poslední verze na dnešní údaje? Když ne (nebo když ještě žádná
      // není), vyrobí se nová - ta se rovnou uloží i na Disk projektu.
      const sedi =
        posledni &&
        posledni.clientName === klientNaRL &&
        posledni.spotName === spotName &&
        posledni.spotLength === spotLength &&
        posledni.director === director &&
        (posledni.musicTitle ?? '') === hudba.title &&
        (posledni.musicAuthor ?? '') === hudba.author &&
        formatProductionDate(posledni.productionDate) === datum;

      if (!sedi) {
        const vysledek = await vytvorRodnyList(
          {
            caflouProjectId,
            projectName,
            statusName: meta?.statusName ?? '',
            caflouCompanyId: null,
            portalCompanyId: input.portalCompanyId ?? null,
          },
          { trigger: 'MANUAL', userId: input.userId, vystup: vystup ?? undefined },
        );
        if (!vysledek.ok) return { potreba: true, ok: false, message: vysledek.message };
        const novy = await prisma.rodnyList.findUnique({ where: { id: vysledek.rodnyListId } });
        if (!novy) return { potreba: true, ok: false, message: 'Rodný list se nepodařilo načíst.' };
        dokumenty.push({
          nazev: novy.fileName,
          pdf: renderRodnyListPdf({
            clientName: novy.clientName,
            spotName: novy.spotName,
            spotLength: novy.spotLength,
            director: novy.director,
            musicTitle: novy.musicTitle ?? '',
            musicAuthor: novy.musicAuthor ?? '',
            productionDate: formatProductionDate(novy.productionDate),
          }),
          rodnyListId: novy.id,
          version: novy.version,
        });
        continue;
      }

      // Platná verze existuje. PDF se vykreslí znovu z uložených hodnot -
      // je to levnější a spolehlivější než tahat soubor z úložiště.
      const pdf = renderRodnyListPdf({
        clientName: posledni.clientName,
        spotName: posledni.spotName,
        spotLength: posledni.spotLength,
        director: posledni.director,
        musicTitle: posledni.musicTitle ?? '',
        musicAuthor: posledni.musicAuthor ?? '',
        productionDate: formatProductionDate(posledni.productionDate),
      });

      // Na Disku ještě není? Zkusí se to znovu - „zároveň se uložil na disk
      // k danému projektu" platí i pro rodný list, který vznikl dřív, než měl
      // projekt vlastní složku. Když to nevyjde, faktura kvůli tomu nespadne.
      if (!posledni.driveFileId) {
        const slozkaProjektu = meta?.driveUrl || null;
        if (slozkaProjektu) {
          try {
            const drive = await uploadPdfToDriveFolder(slozkaProjektu, posledni.fileName, pdf);
            if (drive?.ok) {
              await prisma.rodnyList.update({
                where: { id: posledni.id },
                data: { driveFileId: drive.id, driveUrl: drive.webViewLink, driveError: null },
              });
            }
          } catch (err) {
            console.error(`Rodný list ${posledni.id} se na Disk nepodařilo uložit:`, err);
          }
        }
      }

      dokumenty.push({
        nazev: posledni.fileName,
        pdf,
        rodnyListId: posledni.id,
        version: posledni.version,
      });
    }

    return { potreba: true, ok: true, dokumenty };
  } catch (err) {
    console.error(`Rodný list k faktuře (projekt ${caflouProjectId}) selhal:`, err);
    return {
      potreba: true,
      ok: false,
      message: 'Rodný list se nepodařilo připravit — zkuste ho vyrobit v detailu projektu.',
    };
  }
}
