import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { formatAddress, expandNumberFormat } from '@/lib/doklady';
import { DEFAULT_CONTRACT_TEMPLATES, mistoNataceni } from '@/lib/contracts';
import { bezTitulu } from '@/lib/jmena';

/**
 * Serverová část smluv — sahá do databáze, takže se nesmí dostat do
 * prohlížeče. Čitelná část (popisky stavů, doplňování polí) je
 * v `contracts.ts`.
 */

/** Nasype výchozí šablony, pokud v databázi ještě žádné nejsou. */
export async function ensureContractTemplates(): Promise<void> {
  const count = await prisma.contractTemplate.count();
  if (count > 0) return;
  await prisma.contractTemplate.createMany({ data: DEFAULT_CONTRACT_TEMPLATES });
}

/**
 * Otisk textu smlouvy. Ukládá se ke každému podpisu, takže pozdější změna
 * textu je poznat — otisk už nesedí.
 */
export function documentHash(body: string): string {
  return createHash('sha256').update(body.trim(), 'utf8').digest('hex');
}

/** Krátký, lidsky čitelný tvar otisku do doložky. */
export function shortHash(hash: string | null | undefined): string {
  if (!hash) return '';
  return hash.slice(0, 16).replace(/(.{4})/g, '$1 ').trim().toUpperCase();
}

export function newAccessToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Přidělí číslo z řady vlastní firmy a posune ji. Když by číslo kolidovalo
 * (ručně posunutá řada), zkusí další — stejně jako u faktur a nabídek.
 */
export async function nextContractNumber(issuerCompanyId: string): Promise<string | null> {
  const issuer = await prisma.issuerCompany.findUnique({ where: { id: issuerCompanyId } });
  if (!issuer) return null;

  let sequence = issuer.contractNextNumber;
  for (let attempt = 0; attempt < 20; attempt++) {
    const number = expandNumberFormat(issuer.contractNumberFormat, sequence);
    const exists = await prisma.contract.findUnique({ where: { number }, select: { id: true } });
    if (exists) {
      sequence += 1;
      continue;
    }
    await prisma.issuerCompany.update({
      where: { id: issuerCompanyId },
      data: { contractNextNumber: sequence + 1 },
    });
    return number;
  }
  return null;
}

/** Hodnoty pro {{pole}} v šabloně. */
export async function contractValues(input: {
  issuerCompanyId: string;
  companyId?: string | null;
  signerName?: string | null;
  signerEmail?: string | null;
  projectName?: string | null;
  /** Cislo uz pridelene rady - do textu smlouvy patri hned v zahlavi. */
  contractNumber?: string | null;
  /**
   * Herec z projektu (zadani 13. 9. 2026: „tady tyto veci portal vi. Podle
   * projektu da na vyber RC nebo IC herce"). Kdyz je vyplneny, bere se z jeho
   * karty adresa i RC/IC - herec vetsinou firmu nema, takze `companyId`
   * zustane prazdne a bez nej by ve smlouve nebylo nic.
   */
  actorUserId?: string | null;
  /**
   * Projekt, ze kterého se bere termín (zadání 15. 9. 2026: „chybí tady
   * datum"). Formulář ho sice předvyplňuje, ale kdo smlouvu zakládá bez
   * projektu v prohlížeči nebo termín omylem smaže, ať to má portál odkud
   * vzít - datum odevzdání projektu je přesně ten termín, o který jde.
   */
  caflouProjectId?: string | null;
}): Promise<Record<string, string>> {
  const [issuer, company, herec, projekt] = await Promise.all([
    prisma.issuerCompany.findUnique({ where: { id: input.issuerCompanyId } }),
    input.companyId ? prisma.company.findUnique({ where: { id: input.companyId } }) : Promise.resolve(null),
    input.actorUserId
      ? prisma.user.findUnique({
          where: { id: input.actorUserId },
          select: {
            name: true,
            email: true,
            birthNumber: true,
            ic: true,
            dic: true,
            addressStreet: true,
            addressCity: true,
            addressZip: true,
            studioLocations: true,
          },
        })
      : Promise.resolve(null),
    input.caflouProjectId
      ? prisma.projectMeta.findUnique({
          where: { caflouProjectId: input.caflouProjectId },
          select: { endDate: true },
        })
      : Promise.resolve(null),
  ]);

  const denMesicRok = new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });

  const dnes = new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // Kam posilat fakturu. Prvni je e-mail vlastni firmy, jinak uctarna.
  const nasEmail = issuer?.email?.trim() || process.env.MAIL_UCTARNA?.trim() || 'uctarna@mediaspace.cz';

  const hercovaAdresa = herec
    ? formatAddress({
        addressStreet: herec.addressStreet,
        addressCity: herec.addressCity,
        addressZip: herec.addressZip,
      })
    : '';

  return {
    cislo_smlouvy: input.contractNumber ?? '',
    nase_firma: issuer?.name ?? '',
    nase_ic: issuer?.ic ?? '',
    nase_dic: issuer?.dic ?? '',
    nase_adresa: issuer
      ? formatAddress({
          addressStreet: issuer.addressStreet,
          addressCity: issuer.addressCity,
          addressZip: issuer.addressZip,
        })
      : '',
    nas_email: nasEmail,
    // Tituly pred a za jmenem se nevypisuji (zadani 15. 9. 2026).
    protistrana: company?.name ?? (herec ? bezTitulu(herec.name) : null) ?? input.signerName ?? '',
    protistrana_ic: company?.ic ?? herec?.ic ?? '',
    protistrana_dic: company?.dic ?? herec?.dic ?? '',
    protistrana_adresa:
      (company
        ? formatAddress({
            addressStreet: company.addressStreet,
            addressCity: company.addressCity,
            addressZip: company.addressZip,
          })
        : hercovaAdresa) || '',
    protistrana_identifikace: identifikace({
      ic: company?.ic ?? herec?.ic ?? null,
      dic: company?.dic ?? herec?.dic ?? null,
      rodneCislo: company ? null : (herec?.birthNumber ?? null),
    }),
    podepisujici: bezTitulu(input.signerName) || (input.signerName ?? ''),
    email: input.signerEmail ?? '',
    projekt: input.projectName ?? '',
    // Misto nataceni podle lokace herce, jinak Brno (zadani 15. 9. 2026).
    misto: mistoNataceni(herec?.studioLocations),
    // Nazev dila je nazev projektu - portal ho zna, neni proc se na nej ptat.
    nazev_dila: input.projectName ?? '',
    // Termin = datum odevzdani projektu. Co je napsane ve formulari, ma
    // prednost - prepise se to az v route.ts.
    termin: projekt?.endDate ? denMesicRok.format(projekt.endDate) : '',
    datum: dnes,
  };
}

/**
 * Řádek, kterým se protistrana ve smlouvě identifikuje. Firma i herec na IČ
 * se uvádějí IČem (a DIČem, když je plátce), herec bez IČ rodným číslem —
 * přesně jak to stojí v papírových smlouvách Mediaspace.
 */
function identifikace(vstup: { ic: string | null; dic: string | null; rodneCislo: string | null }): string {
  const ic = vstup.ic?.trim();
  const dic = vstup.dic?.trim();
  if (ic) return dic ? `IČO: ${ic}    DIČ: ${dic}` : `IČO: ${ic}`;
  const rc = vstup.rodneCislo?.trim();
  return rc ? `RČ: ${rc}` : '';
}

/** IP a prohlížeč do doložky. Za Vercelem je skutečná IP v x-forwarded-for. */
export function signatureContext(headers: Headers): { ip: string | null; userAgent: string | null } {
  const forwarded = headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : headers.get('x-real-ip');
  return { ip: ip || null, userAgent: headers.get('user-agent') };
}

/**
 * Kontrola obrázku podpisu. Přijímáme jen PNG v data URL a omezujeme
 * velikost — do databáze nemá smysl pouštět megabajtový obrázek.
 */
export function validSignatureImage(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!value.startsWith('data:image/png;base64,')) return false;
  return value.length > 200 && value.length < 400_000;
}

/**
 * ROZESLÁNÍ PODEPSANÉ SMLOUVY (zadání 14. 9. 2026: „u podepsaných smluv oboji.
 * Odkaz i pdf").
 *
 * Volá se z OBOU podpisových cest — z podpisu za Mediaspace i z podpisu
 * protistrany — vždycky až ve chvíli, kdy je podepsáno z obou stran. Která
 * strana byla poslední, je jedno; pošle se to samé.
 *
 * NIKDY NEVYHAZUJE. Podpis je hotový a uložený; kdyby ho shodilo to, že
 * nejede SMTP nebo se nepovedlo vykreslit PDF, byla by to ta horší varianta.
 * Chyba se jen zapíše do logu.
 */
export async function posliPodepsanouSmlouvu(contractId: string): Promise<void> {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { issuer: true, signatures: { orderBy: { signedAt: 'asc' } } },
    });
    /**
     * STAČÍ PODPIS PROTISTRANY (oprava 15. 9. 2026: „ať po tom, co herec
     * smlouvu podepíše, ať mu přijde rovnou odkaz i samotné PDF podepsané
     * smlouvy do mailu"). Dřív se čekalo na stav SIGNED, tedy na podpisy obou
     * stran - když u nás podpis chyběl, herec nedostal nic a ani nevěděl proč.
     */
    if (!contract) return;
    if (!contract.signatures.some((s) => s.role === 'PROTISTRANA')) return;

    const { smlouvaPdf, nazevSouboruSmlouvy } = await import('@/lib/smlouvaPdf');
    const { sendPodepsanaSmlouvaEmail } = await import('@/lib/email');

    const hash = documentHash(contract.body);

    // PDF je to podstatne, ale ne za cenu celeho mailu - kdyz se nevykresli,
    // odejde aspon odkaz.
    let pdf: { nazev: string; obsah: Buffer } | null = null;
    try {
      pdf = {
        nazev: nazevSouboruSmlouvy(contract.number),
        obsah: smlouvaPdf({
          number: contract.number,
          title: contract.title,
          body: contract.body,
          currentHash: hash,
          issuerName: contract.issuer?.name ?? null,
          podpisy: contract.signatures.map((s) => ({
            role: s.role,
            name: s.name,
            email: s.email,
            signedAt: s.signedAt,
            ip: s.ip,
            documentHash: s.documentHash,
            imageData: s.imageData,
          })),
        }),
      };
    } catch (err) {
      console.error(`PDF smlouvy ${contract.number} se nepodařilo vykreslit:`, err);
    }

    const zaklad = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const odkaz = `${zaklad}/smlouva/${contract.accessToken}`;

    const podepsali = contract.signatures.map((s) => ({
      role: s.role as string,
      name: s.name,
      signedAt: s.signedAt,
    }));

    const spolecne = {
      number: contract.number,
      title: contract.title,
      issuerName: contract.issuer?.name ?? 'Mediaspace',
      projectName: contract.projectName,
      podepsali,
      contractUrl: odkaz,
      pdf,
    };

    // 1) Protistrana - na adresu, na kterou jsme smlouvu poslali k podpisu.
    if (contract.signerEmail) {
      await sendPodepsanaSmlouvaEmail({
        ...spolecne,
        prijemci: [contract.signerEmail],
        jmenoPrijemce: contract.signerName,
      });
    }

    /**
     * 2) My. Mail jde tomu, kdo smlouvu podepsal za Mediaspace; když u podpisu
     * adresa není (starší záznamy), zaskočí e-mail vlastní firmy. Zvlášť,
     * ne ve skryté kopii té první zprávy - naše kopie má mít vlastní oslovení
     * a hlavně ať se nestane, že se odpověď klienta rozejde do obou.
     */
    const nas = contract.signatures.find((s) => s.role === 'MEDIASPACE');
    const nasEmail = nas?.email?.trim() || contract.issuer?.email?.trim() || null;
    if (nasEmail) {
      await sendPodepsanaSmlouvaEmail({
        ...spolecne,
        prijemci: [nasEmail],
        jmenoPrijemce: nas?.name ?? null,
      });
    }

    // Podepsana smlouva je podklad pro honorar - at nikdo neprepisuje rucne,
    // co uz portal vi (zadani 15. 9. 2026).
    await zalozVydajZeSmlouvy(contract.id, pdf);
  } catch (err) {
    console.error('posliPodepsanouSmlouvu selhalo:', err);
  }
}

/**
 * VÝDAJ Z PODEPSANÉ SMLOUVY (zadání 15. 9. 2026: „podepsané smlouvy by se
 * měly automaticky uložit do výdajů").
 *
 * Smlouva s hercem JE závazek zaplatit - dokud se z ní výdaj nepřepisoval
 * ručně, chyběl v rozpočtu projektu do chvíle, než přišla faktura. Zakládá se
 * až po podpisu druhé strany a jen jednou (drží to `Contract.vydajId`).
 *
 * Když se částka ze smlouvy nedá spolehlivě přečíst (třeba „5 000 Kč za
 * natáčecí den"), doklad vznikne s nulou a nechá se NEZARAZENY - ať ho účetní
 * uvidí mezi nezařazenými a doplní, místo aby se do součtů dostalo číslo,
 * které si portál domyslel.
 */
export async function zalozVydajZeSmlouvy(
  contractId: string,
  pdf: { nazev: string; obsah: Buffer } | null,
): Promise<void> {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        number: true,
        title: true,
        odmenaText: true,
        vydajId: true,
        companyId: true,
        issuerCompanyId: true,
        signerName: true,
        caflouProjectId: true,
        projectName: true,
        completedAt: true,
        company: { select: { dic: true } },
      },
    });
    if (!contract || contract.vydajId) return;

    const { parseMoneyToMinor } = await import('@/lib/doklady');

    // Holá částka v korunách - nic jiného se nepřepočítává.
    const text = contract.odmenaText?.trim() ?? '';
    const ciste = /^\d[\d\s\u00a0]*([.,]\d{1,2})?(\s*Kč)?$/i.test(text);
    const castka = ciste ? parseMoneyToMinor(text.replace(/Kč/i, '')) : 0;

    const kategorie = await prisma.expenseCategory.findFirst({
      where: { active: true, name: { contains: 'Honorář', mode: 'insensitive' } },
      select: { id: true },
    });

    // Priloha je ta sama podepsana smlouva, kterou dostal herec mailem.
    let priloha: { url: string; name: string } | null = null;
    if (pdf) {
      try {
        const { uploadExpenseBuffer } = await import('@/lib/storage');
        const vysledek = await uploadExpenseBuffer(pdf.obsah, pdf.nazev, 'application/pdf');
        if (vysledek && !('error' in vysledek)) priloha = vysledek;
      } catch (err) {
        console.error(`Přílohu výdaje ze smlouvy ${contract.number} se nepodařilo uložit:`, err);
      }
    }

    const vydaj = await prisma.expense.create({
      data: {
        number: contract.number,
        supplierCompanyId: contract.companyId,
        supplierName: bezTitulu(contract.signerName) || contract.signerName,
        categoryId: kategorie?.id ?? null,
        issuerCompanyId: contract.issuerCompanyId,
        description: contract.title,
        amountExVatMinor: castka,
        // Herci vetsinou platci DPH nejsou; kdyz protistrana DIC ma, 21 %.
        vatRate: contract.company?.dic ? 21 : 0,
        issueDate: contract.completedAt ?? new Date(),
        caflouProjectId: contract.caflouProjectId,
        projectName: contract.projectName,
        attachmentUrl: priloha?.url ?? null,
        attachmentName: priloha?.name ?? null,
        note: ciste ? `Ze smlouvy ${contract.number}.` : `Ze smlouvy ${contract.number}. Odměna ve smlouvě: ${text || 'neuvedena'}.`,
        stav: ciste && castka > 0 ? 'ZARAZENY' : 'NEZARAZENY',
        zdroj: 'SMLOUVA',
      },
      select: { id: true },
    });

    await prisma.contract.update({ where: { id: contract.id }, data: { vydajId: vydaj.id } });
  } catch (err) {
    console.error('zalozVydajZeSmlouvy selhalo:', err);
  }
}

/**
 * KDO ZA NÁS SMLOUVY PODEPISUJE (zadání 15. 9. 2026: „ve chvíli, kdy
 * posíláme smlouvu k podpisu, je z naší strany už za Karolínu podepsaná").
 *
 * Řídí se to příznakem na účtu (User.smlouvyPodepisuje), ne jménem v kódu —
 * lidi se mění a kód by o tom nevěděl. Když není označený nikdo, podpis se
 * nepřipojí a smlouva odejde jako dřív; portál na to upozorní v odpovědi.
 */
export async function kdoPodepisujeSmlouvy() {
  try {
    return await prisma.user.findFirst({
      where: { smlouvyPodepisuje: true, active: true },
      select: { id: true, name: true, email: true, podpisSmluv: true },
      orderBy: [{ name: 'asc' }],
    });
  } catch (err) {
    console.error('kdoPodepisujeSmlouvy selhalo:', err);
    return null;
  }
}

/**
 * Připojí ke smlouvě náš podpis, pokud tam ještě není. Volá se při odeslání
 * k podpisu - druhá strana tak dostane dokument, který je z naší strany
 * hotový, a jejím podpisem je smlouva rovnou uzavřená.
 *
 * Nikdy nevyhazuje: kdyby se podpis nepovedl, smlouva se pořád má odeslat.
 * Vrací, čí podpis se připojil (nebo null).
 */
export async function podepisZaNas(
  contractId: string,
  ctx: { ip: string | null; userAgent: string | null },
): Promise<string | null> {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { signatures: true },
    });
    if (!contract) return null;
    if (contract.signatures.some((s) => s.role === 'MEDIASPACE')) return null;

    const kdo = await kdoPodepisujeSmlouvy();
    if (!kdo) return null;

    const hash = documentHash(contract.body);
    await prisma.contractSignature.create({
      data: {
        contractId: contract.id,
        role: 'MEDIASPACE',
        name: kdo.name || kdo.email,
        email: kdo.email,
        // Bez uloženého podpisu se vykreslí jméno psaným písmem - viz
        // ContractPaper a smlouvaPdf.
        imageData: kdo.podpisSmluv ?? '',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        documentHash: hash,
      },
    });
    return kdo.name || kdo.email;
  } catch (err) {
    console.error(`Podpis za Mediaspace u smlouvy ${contractId} selhal:`, err);
    return null;
  }
}
