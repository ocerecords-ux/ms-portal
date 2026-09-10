import { prisma } from '@/lib/db';

/**
 * Tvrdé smazání firmy nebo uživatele (zadání 10. 9. 2026: "mám tam i firmy,
 * které jsem zakládal jako testovací, ty bych potřeboval smazat natvrdo").
 *
 * PRAVIDLO: smazat jde jen záznam, na kterém opravdu nic nevisí. Testovací
 * firma založená omylem je jedna věc; firma s dvěma lety faktur druhá.
 * Kdyby se smazala i ta druhá, v účetnictví by zbyly doklady, u kterých už
 * nikdo nedohledá, čí byly.
 *
 * Portál proto nejdřív spočítá, co na záznamu visí, a když něco najde,
 * smazání odmítne a vypíše co - ať je hned vidět, jestli je to opravdu
 * odpadek, nebo omyl. Pro všechno ostatní je vyřazení.
 *
 * ODMÍTNUTÍ NENÍ KONEC (zadání 10. 9. 2026). Člověk se pak může rozhodnout,
 * že navázané věci uloží do archivu a smaže i tak, nebo že o ně prostě
 * přijde - viz lib/archivServer.ts. Tenhle soubor jen počítá, co to bude
 * stát.
 */

export type Prekazka = { co: string; pocet: number };

/** Věty typu "3 faktury, 1 projekt" - ať to jde přečíst, ne luštit. */
export function popisPrekazek(prekazky: Prekazka[]): string {
  return prekazky.map((p) => `${p.pocet}× ${p.co}`).join(', ');
}

/** Co všechno na firmě visí. Prázdné pole = jde smazat. */
export async function prekazkyFirmy(companyId: string): Promise<Prekazka[]> {
  const [uzivatele, projekty, objednavky, faktury, nabidky, vydaje, smlouvy, frekvence, rodneListy] =
    await Promise.all([
      prisma.user.count({ where: { companyId } }),
      prisma.projectMeta.count({ where: { companyId } }),
      prisma.order.count({ where: { companyId } }),
      prisma.invoice.count({ where: { companyId } }),
      prisma.offer.count({ where: { companyId } }),
      prisma.expense.count({ where: { supplierCompanyId: companyId } }),
      prisma.contract.count({ where: { companyId } }),
      prisma.recordingRequest.count({ where: { companyId } }),
      prisma.rodnyList.count({ where: { companyId } }),
    ]);

  return [
    { co: 'uživatel firmy', pocet: uzivatele },
    { co: 'projekt', pocet: projekty },
    { co: 'objednávka', pocet: objednavky },
    { co: 'faktura', pocet: faktury },
    { co: 'nabídka', pocet: nabidky },
    { co: 'výdaj', pocet: vydaje },
    { co: 'smlouva', pocet: smlouvy },
    { co: 'natáčecí frekvence', pocet: frekvence },
    { co: 'rodný list', pocet: rodneListy },
  ].filter((p) => p.pocet > 0);
}

/**
 * Co všechno na uživateli visí.
 *
 * Chat se schválně nepočítá: členství v konverzaci ani reakce nejsou stopa,
 * kvůli které by mělo smazání selhat, a mažou se s uživatelem samy. Zprávy
 * ale ano - historie chatu by se rozpadla.
 */
export async function prekazkyUzivatele(userId: string): Promise<Prekazka[]> {
  const [
    zpravy,
    vykazy,
    objednavky,
    projektyManazer,
    projektyHerec,
    projektyKlient,
    frekvence,
    frekvenceZalozil,
    kanaly,
  ] = await Promise.all([
    prisma.message.count({ where: { userId } }),
    prisma.timesheetEntry.count({ where: { userId } }),
    prisma.order.count({ where: { createdByUserId: userId } }),
    prisma.projectMeta.count({ where: { managerUserId: userId } }),
    prisma.projectMeta.count({ where: { actorUserId: userId } }),
    prisma.projectMeta.count({ where: { klientUserId: userId } }),
    prisma.recordingRequest.count({ where: { actorUserId: userId } }),
    // Zakladatel frekvence i kanalu je povinny udaj, takze i tohle brani
    // smazani - bez nich by v seznamu chybelo to podstatne.
    prisma.recordingRequest.count({ where: { createdById: userId } }),
    prisma.conversation.count({ where: { createdById: userId } }),
  ]);

  return [
    { co: 'zpráva v chatu', pocet: zpravy },
    { co: 'výkaz', pocet: vykazy },
    { co: 'objednávka', pocet: objednavky },
    { co: 'projekt (jako manažer)', pocet: projektyManazer },
    { co: 'projekt (jako herec)', pocet: projektyHerec },
    { co: 'projekt (jako klient)', pocet: projektyKlient },
    { co: 'natáčecí frekvence (jako herec)', pocet: frekvence },
    { co: 'natáčecí frekvence (založil)', pocet: frekvenceZalozil },
    { co: 'kanál v chatu (založil)', pocet: kanaly },
  ].filter((p) => p.pocet > 0);
}

/**
 * Co všechno na projektu visí (zadání 10. 9. 2026: "potřeboval bych, aby šly
 * smazat projekty").
 *
 * Vazba je přes ID projektu v textu, ne přes databázový vztah - proto se
 * počítá podle `caflouProjectId`, stejně jako se všude jinde dohledávají
 * doklady k projektu.
 */
export async function prekazkyProjektu(caflouProjectId: string): Promise<Prekazka[]> {
  const [faktury, nabidky, vydaje, smlouvy, vykazy, frekvence, rodneListy, konverzace] = await Promise.all([
    prisma.invoice.count({ where: { caflouProjectId } }),
    prisma.offer.count({ where: { caflouProjectId } }),
    prisma.expense.count({ where: { caflouProjectId } }),
    prisma.contract.count({ where: { caflouProjectId } }),
    prisma.timesheetEntry.count({ where: { caflouProjectId } }),
    prisma.recordingRequest.count({ where: { caflouProjectId } }),
    prisma.rodnyList.count({ where: { caflouProjectId } }),
    prisma.conversation.count({ where: { caflouProjectId } }),
  ]);

  return [
    { co: 'faktura', pocet: faktury },
    { co: 'nabídka', pocet: nabidky },
    { co: 'výdaj', pocet: vydaje },
    { co: 'smlouva', pocet: smlouvy },
    { co: 'výkaz', pocet: vykazy },
    { co: 'natáčecí frekvence', pocet: frekvence },
    { co: 'rodný list', pocet: rodneListy },
    { co: 'kanál v chatu', pocet: konverzace },
  ].filter((p) => p.pocet > 0);
}
