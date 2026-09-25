import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { sendInvoiceEmail } from '@/lib/email';
import { cisloUctuSKodem, computeTotals } from '@/lib/doklady';
import { pdfFaktury } from '@/lib/dokladNahledServer';
import { zapisZmenyProjektu } from '@/lib/projektLogServer';
import { rodnyListKFakture } from '@/lib/rodnyListServer';

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

/** Stav, do ktereho projekt prejde odeslanim faktury (zadani 15. 9. 2026). */
const STAV_PO_FAKTURE = 'Vyfakturováno';

/**
 * Odeslani faktury odberateli (zadani 6. 9. 2026). Mail nese vsechno, co klient
 * potrebuje k zaplaceni - castku, ucet, variabilni symbol, splatnost a PDF
 * s QR platbou.
 *
 * KOMU (zadani 13. 9. 2026): faktura jde na e-mail vedeny u FIRMY - tam byva
 * ucetni odberatele. Jestli ji ma dostat i KLIENT PROJEKTU (clovek, ktery ma
 * u nich ten projekt na starost), se nastavuje u FIRMY zaskrtavatkem - ne pri
 * kazdem odeslani. U kazde faktury se pak vezme klient z projektu, ke kteremu
 * je navazana, takze vyjde vzdycky ten spravny.
 *
 * Jina adresa nez tyhle dve se dosadit neda; posilat faktury kamkoliv neni
 * potreba a je to zbytecna dira.
 *
 * RODNY LIST JEDE S FAKTUROU (zadani 15. 9. 2026: „kdyz posleme fakturu
 * klientovi, tak automaticky s tim odeslal i rodny list a zaroven se ulozil
 * na disk k danemu projektu"). Plati JEN u radiovych spotu - tam, kde se
 * rodny list dela. Kdyz u projektu chybi udaje (typicky hudba, nebo
 * zaskrtnuti, ze ve spotu zadna nebyla), faktura NEODEJDE a vrati se hlaska,
 * co doplnit - tohle je to „musi to zarvat" ze zadani.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        issuer: true,
        company: true,
        bankAccount: true,
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Faktura nenalezena.' }, { status: 404 });
    if (invoice.items.length === 0) {
      return NextResponse.json({ error: 'Faktura nemá žádné položky.' }, { status: 400 });
    }

    const volba = (await req.json().catch(() => null)) as
      | { firme?: unknown; klientovi?: unknown }
      | null;
    const chceFirmu = volba?.firme === undefined ? true : volba.firme === true;
    // Vychozi je nastaveni firmy; telo pozadavku ho muze prebit (jednorazove
    // odeslani jen nekomu), ale bezne se nic neposila a plati karta firmy.
    const chceKlienta =
      volba?.klientovi === undefined ? invoice.company.fakturyKlientovi : volba.klientovi === true;

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
      return NextResponse.json(
        { error: `Fakturu není komu poslat — ${duvody.join(' a ')}.` },
        { status: 400 },
      );
    }
    if (!invoice.bankAccount) {
      return NextResponse.json(
        { error: 'Faktura nemá vybraný bankovní účet — bez něj klient neví, kam platit.' },
        { status: 400 },
      );
    }

    // Rodny list PRED odeslanim - kdyz neco chybi, faktura nikam nejde.
    const rodnyList = invoice.caflouProjectId
      ? await rodnyListKFakture({
          caflouProjectId: invoice.caflouProjectId,
          projectName: invoice.projectName || invoice.subject || `Projekt ${invoice.caflouProjectId}`,
          portalCompanyId: invoice.companyId,
          userId: session.user.id,
        })
      : ({ potreba: false } as const);
    if (rodnyList.potreba && !rodnyList.ok) {
      return NextResponse.json({ error: rodnyList.message }, { status: 400 });
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
      rodnyList: rodnyList.potreba && rodnyList.ok ? { nazev: rodnyList.nazev, obsah: rodnyList.pdf } : null,
    });

    if (!result.sent) {
      return NextResponse.json({ error: 'E-mail se nepodařilo odeslat — není nastavené SMTP.' }, { status: 503 });
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
          odeslalId: session.user.id,
          odeslalJmeno: session.user.name || session.user.email || null,
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
     * Deje se to jen u projektu, ktery jeste ukonceny neni, a nikdy to
     * neshodi odeslani faktury - ta uz je u klienta, chyba patri do logu.
     */
    /*
     * VYPNUTO 21. 9. 2026 („tak zrušme teď to automatické ukončení projektu po
     * fakturaci, než to domyslíme"): posíláme i ostré zálohové faktury s DPH
     * a projekt se pak uzavřel už po záloze. Než bude u faktury druh
     * (zálohová / konečná) a volba při odeslání, ukončuje se projekt jen
     * ručně. Kód zůstává, zapíná ho UKONCIT_PROJEKT_PO_FAKTURE.
     *
     * ZNOVU ZAPNUTO 22. 9. 2026 - ale jen když je projekt ve stavu
     * „Schváleno - k fakturaci“ (STAV_PRED_FAKTUROU). Záloha odchází dřív,
     * v jiném stavu, takže projekt neukončí.
     */
    /**
     * POJISTKA MÍSTO AUTOMATU (zadání 25. 9. 2026: „nastavme ještě jednu
     * pojistku u automatického ukončování faktur. Jakmile se odešle faktura,
     * dejme ještě mezikrok, že se systém zeptá Ukončit projekt?").
     *
     * Projekt se tedy po odeslání faktury sám NEZAVÍRÁ. Portál jen řekne, že
     * by se zavřít mohl, a člověk to odklepne (nebo ne) - zavírá se pak
     * stejnou cestou jako ruční ukončení, /api/projekty/[id]/ukonceni.
     *
     * Ptá se jen tam, kde by se dřív ukončovalo samo: projekt ještě neběží
     * jako hotový a stojí ve stavu „Schváleno - k fakturaci". Záloha odchází
     * v jiném stavu a ta se nikdy ptát nemá.
     */
    const nabidnoutUkonceni = Boolean(
      UKONCIT_PROJEKT_PO_FAKTURE &&
        invoice.caflouProjectId &&
        meta &&
        !meta.finished &&
        (meta.statusName ?? '').trim() === STAV_PRED_FAKTUROU,
    );

    return NextResponse.json({
      ok: true,
      to,
      kopie,
      sPrilohou: dokument.ok,
      sRodnymListem: rodnyList.potreba && rodnyList.ok,
      // Zůstává kvůli starším voláním; projekt se po faktuře sám neukončuje.
      projektUkoncen: false,
      nabidnoutUkonceni,
      caflouProjectId: nabidnoutUkonceni ? invoice.caflouProjectId : null,
      projectName: nabidnoutUkonceni ? (invoice.projectName ?? null) : null,
    });
  } catch (err) {
    console.error('POST /api/admin/invoices/[id]/send selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Odeslání se nezdařilo (${message}).` }, { status: 500 });
  }
}
