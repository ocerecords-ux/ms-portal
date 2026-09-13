import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { formatAddress, expandNumberFormat } from '@/lib/doklady';
import { DEFAULT_CONTRACT_TEMPLATES } from '@/lib/contracts';

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
}): Promise<Record<string, string>> {
  const [issuer, company, herec] = await Promise.all([
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
          },
        })
      : Promise.resolve(null),
  ]);

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
    protistrana: company?.name ?? herec?.name ?? input.signerName ?? '',
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
    podepisujici: input.signerName ?? '',
    email: input.signerEmail ?? '',
    projekt: input.projectName ?? '',
    // Nazev dila je nazev projektu - portal ho zna, neni proc se na nej ptat.
    nazev_dila: input.projectName ?? '',
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
