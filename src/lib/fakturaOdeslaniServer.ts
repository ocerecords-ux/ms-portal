import { prisma } from '@/lib/db';
import { sendInvoiceEmail } from '@/lib/email';
import { cisloUctuSKodem, computeTotals } from '@/lib/doklady';
import { pdfFaktury } from '@/lib/dokladNahledServer';
import { rodnyListKFakture } from '@/lib/rodnyListServer';

/**
 * ODESLÁNÍ FAKTURY ODBĚRATELI (zadání 6. 9. 2026). Mail nese všechno, co
 * klient potřebuje k zaplacení - částku, účet, variabilní symbol, splatnost
 * a PDF s QR platbou.
 *
 * PROČ TO BYDLÍ V `lib`, NE V API (19. 10. 2026): odesílání faktury dělají
 * dvě místa - člověk u dokladu, a automatika u reklam (viz
 * lib/automatickaFakturaServer.ts). Dokud to byl kód jedné route, druhé místo
 * by si ho muselo opsat - a opsaná verze posílání ostrých faktur klientům je
 * přesně to, co po pár měsících začne rozcházet. Route je proto jen obálka,
 * která řeší oprávnění a HTTP kódy; rozhoduje se tady.
 *
 * KOMU (zadání 13. 9. 2026): faktura jde na e-mail vedený u FIRMY - tam bývá
 * účetní odběratele. Jestli ji má dostat i KLIENT PROJEKTU (člověk, který má
 * u nich ten projekt na starost), se nastavuje u FIRMY zaškrtávátkem - ne při
 * každém odeslání. U každé faktury se pak vezme klient z projektu, ke kterému
 * je navázaná, takže vyjde vždycky ten správný.
 *
 * Jiná adresa než tyhle dvě se dosadit nedá; posílat faktury kamkoliv není
 * potřeba a je to zbytečná díra.
 *
 * RODNÝ LIST JEDE S FAKTUROU (zadání 15. 9. 2026: „kdyz posleme fakturu
 * klientovi, tak automaticky s tim odeslal i rodny list a zaroven se ulozil
 * na disk k danemu projektu"). Platí JEN u rádiových spotů - tam, kde se
 * rodný list dělá. Když u projektu chybí údaje (typicky hudba, nebo
 * zaškrtnutí, že ve spotu žádná nebyla), faktura NEODEJDE a vrátí se hláška,
 * co doplnit - tohle je to „musí to zařvat" ze zadání.
 */

/**
 * Automatické ukončení projektu po odeslání faktury - vypnuté 21. 9. 2026,
 * znovu zapnuté 22. 9. 2026 s podmínkou stavu (viz STAV_PRED_FAKTUROU).
 */
const UKONCIT_PROJEKT_PO_FAKTURE = true;

/**
 * Projekt se ukončí JEN z tohohle stavu (zadání 22. 9. 2026: „Bruno
 * automaticky ukončí projekt po tom, co se odešle faktura, ale s jednou
 * podmínkou. Projekt musí být v té chvíli ve stavu Schváleno - k fakturaci").
 * Zálohová faktura odchází, když se ještě točí - projekt je tehdy v jiném
 * stavu, takže ho neukončí.
 */
const STAV_PRED_FAKTUROU = 'Schváleno - k fakturaci';

export type OdeslaniFakturyVstup = {
  invoiceId: string;
  /**
   * Kdo odeslání spustil - píše se do záznamu o odeslání. Prázdné id má
   * jediný případ: fakturu spustilo schválení spotu klientem, kdy u toho
   * nikdo od nás nebyl (19. 10. 2026).
   */
  odeslal: { id: string | null; jmeno: string | null };
  /** Firmě (účetní odběratele). Nevyplněno = ano. */
  firme?: boolean;
  /** Klientovi projektu. Nevyplněno = podle karty firmy. */
  klientovi?: boolean;
};

export type OdeslaniFakturyVysledek =
  | {
      ok: true;
      to: string;
      kopie: string[];
      sPrilohou: boolean;
      sRodnymListem: boolean;
      nabidnoutUkonceni: boolean;
      caflouProjectId: string | null;
      projectName: string | null;
    }
  | { ok: false; status: number; error: string };

export async function odesliFakturu(
  vstup: OdeslaniFakturyVstup,
): Promise<OdeslaniFakturyVysledek> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: vstup.invoiceId },
    include: {
      issuer: true,
      company: true,
      bankAccount: true,
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!invoice) return { ok: false, status: 404, error: 'Faktura nenalezena.' };
  if (invoice.items.length === 0) {
    return { ok: false, status: 400, error: 'Faktura nemá žádné položky.' };
  }

  const chceFirmu = vstup.firme === undefined ? true : vstup.firme === true;
  // Vychozi je nastaveni firmy; volba muze prebit (jednorazove odeslani jen
  // nekomu), ale bezne se nic neposila a plati karta firmy.
  const chceKlienta =
    vstup.klientovi === undefined ? invoice.company.fakturyKlientovi : vstup.klientovi === true;

  const mailFirmy = invoice.company.contactEmail?.trim() || null;
  const meta = invoice.caflouProjectId
    ? await prisma.projectMeta.findUnique({
        where: { caflouProjectId: invoice.caflouProjectId },
        select: { statusName: true, finished: true, klient: { select: { email: true } } },
      })
    : null;
  const mailKlienta = meta?.klient?.email?.trim() || null;

  const prijemci = [chceFirmu ? mailFirmy : null, chceKlienta ? mailKlienta : null].filter(
    (m): m is string => Boolean(m),
  );
  // Duplicita nastane, kdyz je klient projektu zaroven kontaktem firmy.
  const [to, ...kopie] = [...new Set(prijemci)];
  /**
   * KDYZ CHYBI JEDNA ADRESA, POSILA SE NA TU DRUHOU (upresneni 15. 9. 2026:
   * „co se stane, kdyz u firmy nebudeme mit vyplneny mail, kde maji faktury,
   * ale mame zaskrtnute pole posilat i na klienta? ... Pokud ne, tak bych to
   * takhle chtel."). Chybejici e-mail firmy tedy odeslani neblokuje, dokud
   * je komu poslat - faktura odejde klientovi projektu.
   *
   * Odmitne se to, az kdyz neni ani jedna adresa; hlaska rekne, ktera chybi.
   */
  if (!to) {
    const duvody: string[] = [];
    if (chceFirmu && !mailFirmy) duvody.push(`firma „${invoice.company.name}" nemá kontaktní e-mail`);
    if (chceKlienta && !mailKlienta) duvody.push('projekt nemá klienta s e-mailem');
    if (duvody.length === 0) duvody.push('není vybraný žádný příjemce');
    return { ok: false, status: 400, error: `Fakturu není komu poslat — ${duvody.join(' a ')}.` };
  }
  if (!invoice.bankAccount) {
    return {
      ok: false,
      status: 400,
      error: 'Faktura nemá vybraný bankovní účet — bez něj klient neví, kam platit.',
    };
  }

  // Rodny list PRED odeslanim - kdyz neco chybi, faktura nikam nejde.
  const rodnyList = invoice.caflouProjectId
    ? await rodnyListKFakture({
        caflouProjectId: invoice.caflouProjectId,
        projectName: invoice.projectName || invoice.subject || `Projekt ${invoice.caflouProjectId}`,
        portalCompanyId: invoice.companyId,
        userId: vstup.odeslal.id ?? undefined,
      })
    : ({ potreba: false } as const);
  if (rodnyList.potreba && !rodnyList.ok) {
    return { ok: false, status: 400, error: rodnyList.message };
  }

  const totals = computeTotals(invoice.items, invoice);

  // Faktura jde klientovi i jako PDF - je na nem QR platba (zadani 13. 9.
  // 2026). Kdyz se PDF nepodari vykreslit, mail odejde bez nej: text v nem
  // ma vsechno potrebne k zaplaceni a je lepsi fakturu poslat nez neposlat.
  const dokument = await pdfFaktury(invoice.id).catch((err) => {
    console.error('PDF faktury se nepodarilo vyrobit:', err);
    return { ok: false as const, message: 'PDF se nepodařilo vyrobit.' };
  });
  if (!dokument.ok) console.error('PDF faktury se nepridava:', dokument.message);

  const result = await sendInvoiceEmail({
    to,
    cc: kopie,
    contactName: invoice.company.contactName,
    companyName: invoice.company.name,
    issuerName: invoice.issuer.name,
    number: invoice.number,
    subject: invoice.subject,
    currency: invoice.currency,
    totalExVat: totals.exVat,
    totalIncVat: totals.incVat,
    dueDate: invoice.dueDate,
    variableSymbol: invoice.variableSymbol,
    accountLabel: invoice.bankAccount.label,
    accountNumber: cisloUctuSKodem(invoice.bankAccount.accountNumber, invoice.bankAccount.bankName),
    iban: invoice.bankAccount.iban,
    pdf: dokument.ok ? { nazev: dokument.nazev, obsah: dokument.pdf } : null,
    // Rodných listů může být víc - pod jedním projektem je výstupů několik
    // a každý má svůj (26. 9. 2026).
    rodneListy:
      rodnyList.potreba && rodnyList.ok
        ? rodnyList.dokumenty.map((d) => ({ nazev: d.nazev, obsah: d.pdf }))
        : null,
  });

  if (!result.sent) {
    return {
      ok: false,
      status: 503,
      error: 'E-mail se nepodařilo odeslat — není nastavené SMTP.',
    };
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: invoice.status === 'DRAFT' ? 'SENT' : invoice.status, sentAt: new Date() },
  });

  /**
   * ZAZNAM O ODESLANI (zadani 15. 9. 2026: „a zaznam nekde o tom, kdy a na
   * koho ta faktura sla"). Faktura se posila i vickrat - `sentAt` rekne jen
   * to posledni, tady je videt cela historie i s adresami.
   *
   * Nikdy neshodi odeslani: mail uz je u klienta, zaznam patri do logu.
   */
  try {
    await prisma.odeslaniFaktury.create({
      data: {
        invoiceId: invoice.id,
        prijemci: [to, ...kopie],
        odeslalId: vstup.odeslal.id,
        odeslalJmeno: vstup.odeslal.jmeno,
        sPrilohou: dokument.ok,
        sRodnymListem: rodnyList.potreba && rodnyList.ok,
      },
    });
  } catch (err) {
    console.error(`Zaznam o odeslani faktury ${invoice.number} se nepodarilo ulozit:`, err);
  }

  /**
   * ODESLANA FAKTURA UKONCUJE PROJEKT (zadani 15. 9. 2026: „projekt by se
   * nemel ukoncit prehozenim stavu na Schvaleno - k fakturaci. Ukoncit by
   * se mel az ve chvili, kdy odesleme fakturu na klienta").
   *
   * Do te doby projekt spadl do Dokoncenych uz pri schvaleni nahravek,
   * takze zakazka, ktera jeste nebyla vyfakturovana, zmizela z Aktivnich.
   *
   * VYPNUTO 21. 9. 2026 („tak zrušme teď to automatické ukončení projektu po
   * fakturaci, než to domyslíme"): posíláme i ostré zálohové faktury s DPH
   * a projekt se pak uzavřel už po záloze.
   *
   * ZNOVU ZAPNUTO 22. 9. 2026 - ale jen když je projekt ve stavu
   * „Schváleno - k fakturaci" (STAV_PRED_FAKTUROU). Záloha odchází dřív,
   * v jiném stavu, takže projekt neukončí.
   *
   * POJISTKA MÍSTO AUTOMATU (zadání 25. 9. 2026: „nastavme ještě jednu
   * pojistku u automatického ukončování faktur. Jakmile se odešle faktura,
   * dejme ještě mezikrok, že se systém zeptá Ukončit projekt?").
   *
   * Projekt se tedy po odeslání faktury sám NEZAVÍRÁ. Portál jen řekne, že
   * by se zavřít mohl, a člověk to odklepne (nebo ne) - zavírá se pak
   * stejnou cestou jako ruční ukončení, /api/projekty/[id]/ukonceni.
   */
  const nabidnoutUkonceni = Boolean(
    UKONCIT_PROJEKT_PO_FAKTURE &&
      invoice.caflouProjectId &&
      meta &&
      !meta.finished &&
      (meta.statusName ?? '').trim() === STAV_PRED_FAKTUROU,
  );

  return {
    ok: true,
    to,
    kopie,
    sPrilohou: dokument.ok,
    sRodnymListem: rodnyList.potreba && rodnyList.ok,
    nabidnoutUkonceni,
    caflouProjectId: nabidnoutUkonceni ? invoice.caflouProjectId : null,
    projectName: nabidnoutUkonceni ? (invoice.projectName ?? null) : null,
  };
}
