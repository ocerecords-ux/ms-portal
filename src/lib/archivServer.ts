import type { DruhArchivu } from '@prisma/client';
import { prisma } from '@/lib/db';
import { popisPrekazek, type Prekazka } from '@/lib/mazani';

/**
 * Archivace a smazání záznamu i s tím, co na něm visí (zadání 10. 9. 2026:
 * „nechal bych to, že to zavře, že tam jsou navázané věci, ale pak se ještě
 * můžu rozhodnout, zda o ně přijdu, nebo ty věci konkrétní archivuju a smažu
 * uživatele, firmu atd.").
 *
 * DVĚ CESTY, JEDNO CHOVÁNÍ. Odstraní se totéž; liší se jen tím, jestli se
 * předtím uloží archiv. Kdyby se lišilo i to, co se maže, nikdo by po půl
 * roce nevěděl, co vlastně tehdy zvolil.
 *
 * VŠECHNO V JEDNÉ TRANSAKCI. Archiv se zapisuje spolu s mazáním, takže když
 * cokoliv selže, nezůstane ani půlka: buď je záznam pryč a archiv uložený,
 * nebo se nestalo nic a člověk vidí chybu.
 *
 * CO SE MAŽE A CO JEN ODPOJUJE: maže se to, co bez smazaného záznamu nemá
 * smysl (rodný list projektu, natáčecí frekvence). Odpojuje se to, co žije
 * dál vlastním životem - faktura projektu si nechá název projektu textem
 * a jen přestane na projekt ukazovat. Účetnictví takhle zůstane celé.
 */

export type VysledekOdstraneni = {
  nazev: string;
  /** Kolik záznamů se uložilo do archivu. */
  pocetZaznamu: number;
  /** ID archivu, když se archivovalo. */
  archivId: string | null;
};

type Casti = Record<string, unknown[]>;

/** Kolik toho v archivu je - hlavní záznam se nepočítá. */
function spocitej(casti: Casti): number {
  return Object.values(casti).reduce((sum, radky) => sum + radky.length, 0);
}

/**
 * Data archivniho zaznamu. Zamerne to jen sestavi objekt a nic neuklada -
 * zapis pak dela `tx.archiv.create` UVNITR transakce, spolu s mazanim.
 * Kdyby se archiv ukladal mimo ni, zustal by po neuspesnem mazani viset
 * archiv zaznamu, ktery v portalu porad je.
 */
function dataArchivu(vstup: {
  druh: DruhArchivu;
  nazev: string;
  puvodniId: string;
  souhrn: string;
  hlavni: unknown;
  casti: Casti;
  puvodce: { id: string | null; jmeno: string | null };
}) {
  return {
    druh: vstup.druh,
    nazev: vstup.nazev,
    puvodniId: vstup.puvodniId,
    souhrn: vstup.souhrn,
    pocetZaznamu: spocitej(vstup.casti),
    // JSON.parse(JSON.stringify(...)) schvalne: data z Prismy nesou Date a
    // Decimal, ktere by se do sloupce Json samy neulozily.
    obsah: JSON.parse(JSON.stringify({ hlavni: vstup.hlavni, ...vstup.casti })),
    uzivatelId: vstup.puvodce.id,
    uzivatelJmeno: vstup.puvodce.jmeno,
  };
}

// ---------------------------------------------------------------------------
// FIRMA
// ---------------------------------------------------------------------------

export async function odstranFirmu(vstup: {
  companyId: string;
  nazev: string;
  prekazky: Prekazka[];
  archivovat: boolean;
  puvodce: { id: string | null; jmeno: string | null };
}): Promise<VysledekOdstraneni> {
  const { companyId } = vstup;

  const [firma, uzivatele, projekty, objednavky, faktury, nabidky, vydaje, smlouvy, frekvence, rodneListy] =
    await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.user.findMany({ where: { companyId } }),
      prisma.projectMeta.findMany({ where: { companyId } }),
      prisma.order.findMany({ where: { companyId } }),
      prisma.invoice.findMany({ where: { companyId }, include: { items: true } }),
      prisma.offer.findMany({ where: { companyId }, include: { items: true } }),
      prisma.expense.findMany({ where: { supplierCompanyId: companyId } }),
      prisma.contract.findMany({ where: { companyId } }),
      prisma.recordingRequest.findMany({ where: { companyId }, include: { slots: true } }),
      prisma.rodnyList.findMany({ where: { companyId } }),
    ]);

  const casti: Casti = {
    uzivatele,
    projekty,
    objednavky,
    faktury,
    nabidky,
    vydaje,
    smlouvy,
    frekvence,
    rodneListy,
  };

  let archivId: string | null = null;

  await prisma.$transaction(async (tx) => {
    if (vstup.archivovat) {
      const archiv = await tx.archiv.create({
        data: dataArchivu({
          druh: 'FIRMA',
          nazev: vstup.nazev,
          puvodniId: companyId,
          souhrn: popisPrekazek(vstup.prekazky),
          hlavni: firma,
          casti,
          puvodce: vstup.puvodce,
        }),
        select: { id: true },
      });
      archivId = archiv.id;
    }

    // Poradi neni libovolne: faktura ukazuje na nabidku, ze ktere vznikla,
    // takze nabidky musi jit az po fakturach.
    await tx.rodnyList.deleteMany({ where: { companyId } });
    await tx.recordingRequest.deleteMany({ where: { companyId } });
    await tx.contract.deleteMany({ where: { companyId } });
    await tx.expense.deleteMany({ where: { supplierCompanyId: companyId } });
    await tx.invoice.deleteMany({ where: { companyId } });
    await tx.offer.deleteMany({ where: { companyId } });
    await tx.order.deleteMany({ where: { companyId } });
    await tx.projectMeta.deleteMany({ where: { companyId } });
    // Ucty firmy odchazi s ni. Kdyby nekdo z nich vysel jeste jinde (napr.
    // jako klient projektu jine firmy), databaze to odmitne a z transakce
    // nezustane nic - to je spravne, takovy ucet se ma resit zvlast.
    await tx.user.deleteMany({ where: { companyId } });
    await tx.company.delete({ where: { id: companyId } });
  });

  return { nazev: vstup.nazev, pocetZaznamu: spocitej(casti), archivId };
}

// ---------------------------------------------------------------------------
// UZIVATEL
// ---------------------------------------------------------------------------

export async function odstranUzivatele(vstup: {
  userId: string;
  jmeno: string;
  prekazky: Prekazka[];
  archivovat: boolean;
  puvodce: { id: string | null; jmeno: string | null };
}): Promise<VysledekOdstraneni> {
  const { userId } = vstup;

  const [ucet, zpravy, vykazy, objednavky, kanaly, frekvenceZalozil, projektyManazer, projektyHerec, projektyKlient, frekvenceHerec] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.message.findMany({ where: { userId } }),
      prisma.timesheetEntry.findMany({ where: { userId } }),
      prisma.order.findMany({ where: { createdByUserId: userId } }),
      prisma.conversation.findMany({ where: { createdById: userId } }),
      prisma.recordingRequest.findMany({ where: { createdById: userId }, include: { slots: true } }),
      prisma.projectMeta.findMany({ where: { managerUserId: userId }, select: { caflouProjectId: true, name: true } }),
      prisma.projectMeta.findMany({
        where: { herci: { some: { id: userId } } },
        select: { caflouProjectId: true, name: true },
      }),
      prisma.projectMeta.findMany({ where: { klientUserId: userId }, select: { caflouProjectId: true, name: true } }),
      prisma.recordingRequest.findMany({ where: { actorUserId: userId }, select: { id: true, projectName: true } }),
    ]);

  const casti: Casti = {
    zpravy,
    vykazy,
    objednavky,
    kanaly,
    frekvenceZalozil,
    // U techto se ucet jen odpojuje - projekt ani frekvence nezanikaji.
    odpojenoOdProjektu: [...projektyManazer, ...projektyHerec, ...projektyKlient],
    odpojenoOdFrekvenci: frekvenceHerec,
  };

  let archivId: string | null = null;

  await prisma.$transaction(async (tx) => {
    if (vstup.archivovat) {
      const archiv = await tx.archiv.create({
        data: dataArchivu({
          druh: 'UZIVATEL',
          nazev: vstup.jmeno,
          puvodniId: userId,
          souhrn: popisPrekazek(vstup.prekazky),
          hlavni: ucet,
          casti,
          puvodce: vstup.puvodce,
        }),
        select: { id: true },
      });
      archivId = archiv.id;
    }

    // Projekt se smazanim cloveka neztraci - jen u nej prestane byt vyplneny.
    // Smazat projekt proto, ze odchazi jeho manazer, by bylo spatne.
    await tx.projectMeta.updateMany({ where: { managerUserId: userId }, data: { managerUserId: null } });
    await tx.projectMeta.updateMany({ where: { actorUserId: userId }, data: { actorUserId: null } });
    // Odpojit i ze seznamu hercu - projekt zustava, jen uz u nej ten clovek
    // nefiguruje (zadani 10. 9. 2026, vic hercu na projekt).
    for (const projekt of await tx.projectMeta.findMany({
      where: { herci: { some: { id: userId } } },
      select: { id: true },
    })) {
      await tx.projectMeta.update({
        where: { id: projekt.id },
        data: { herci: { disconnect: { id: userId } } },
      });
    }
    await tx.projectMeta.updateMany({ where: { klientUserId: userId }, data: { klientUserId: null } });
    await tx.recordingRequest.updateMany({ where: { actorUserId: userId }, data: { actorUserId: null } });

    // Tohle bez nej smysl nedava - zpravu, vykaz ani objednavku nikdo jiny
    // nenapsal.
    await tx.message.deleteMany({ where: { userId } });
    await tx.timesheetEntry.deleteMany({ where: { userId } });
    await tx.order.deleteMany({ where: { createdByUserId: userId } });
    await tx.recordingRequest.deleteMany({ where: { createdById: userId } });
    await tx.conversation.deleteMany({ where: { createdById: userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  return { nazev: vstup.jmeno, pocetZaznamu: spocitej(casti), archivId };
}

// ---------------------------------------------------------------------------
// PROJEKT
// ---------------------------------------------------------------------------

export async function odstranProjekt(vstup: {
  caflouProjectId: string;
  nazev: string;
  prekazky: Prekazka[];
  archivovat: boolean;
  puvodce: { id: string | null; jmeno: string | null };
}): Promise<VysledekOdstraneni> {
  const { caflouProjectId } = vstup;

  const [projekt, faktury, nabidky, vydaje, smlouvy, vykazy, frekvence, rodneListy, kanaly, historie] =
    await Promise.all([
      prisma.projectMeta.findUnique({ where: { caflouProjectId } }),
      prisma.invoice.findMany({ where: { caflouProjectId }, select: { id: true, number: true, projectName: true } }),
      prisma.offer.findMany({ where: { caflouProjectId }, select: { id: true, number: true, projectName: true } }),
      prisma.expense.findMany({ where: { caflouProjectId }, select: { id: true, number: true, projectName: true } }),
      prisma.contract.findMany({ where: { caflouProjectId }, select: { id: true, projectName: true } }),
      prisma.timesheetEntry.findMany({ where: { caflouProjectId } }),
      prisma.recordingRequest.findMany({ where: { caflouProjectId }, include: { slots: true } }),
      prisma.rodnyList.findMany({ where: { caflouProjectId } }),
      prisma.conversation.findMany({ where: { caflouProjectId }, select: { id: true, name: true } }),
      prisma.projektUdalost.findMany({ where: { caflouProjectId } }),
    ]);

  const casti: Casti = {
    // Doklady se jen odpojuji - nazev projektu si nesou textem, takze
    // v ucetnictvi zustanou citelne.
    odpojeneFaktury: faktury,
    odpojeneNabidky: nabidky,
    odpojeneVydaje: vydaje,
    odpojeneSmlouvy: smlouvy,
    odpojeneVykazy: vykazy.map((v) => ({ id: v.id, projectName: v.projectName })),
    odpojeneKanaly: kanaly,
    // Tohle bez projektu smysl nedava.
    frekvence,
    rodneListy,
    historie,
  };

  let archivId: string | null = null;

  await prisma.$transaction(async (tx) => {
    if (vstup.archivovat) {
      const archiv = await tx.archiv.create({
        data: dataArchivu({
          druh: 'PROJEKT',
          nazev: vstup.nazev,
          puvodniId: caflouProjectId,
          souhrn: popisPrekazek(vstup.prekazky),
          hlavni: projekt,
          casti,
          puvodce: vstup.puvodce,
        }),
        select: { id: true },
      });
      archivId = archiv.id;
    }

    const odpojit = { where: { caflouProjectId }, data: { caflouProjectId: null } };
    await tx.invoice.updateMany(odpojit);
    await tx.offer.updateMany(odpojit);
    await tx.expense.updateMany(odpojit);
    await tx.contract.updateMany(odpojit);
    await tx.timesheetEntry.updateMany(odpojit);
    await tx.conversation.updateMany(odpojit);

    await tx.recordingRequest.deleteMany({ where: { caflouProjectId } });
    await tx.rodnyList.deleteMany({ where: { caflouProjectId } });
    await tx.notifikaceOdeslana.deleteMany({ where: { caflouProjectId } });
    await tx.projektUdalost.deleteMany({ where: { caflouProjectId } });
    await tx.projectMeta.delete({ where: { caflouProjectId } });
  });

  return { nazev: vstup.nazev, pocetZaznamu: spocitej(casti), archivId };
}
