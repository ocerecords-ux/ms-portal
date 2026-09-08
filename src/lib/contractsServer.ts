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
}): Promise<Record<string, string>> {
  const [issuer, company] = await Promise.all([
    prisma.issuerCompany.findUnique({ where: { id: input.issuerCompanyId } }),
    input.companyId ? prisma.company.findUnique({ where: { id: input.companyId } }) : Promise.resolve(null),
  ]);

  const dnes = new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return {
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
    protistrana: company?.name ?? input.signerName ?? '',
    protistrana_ic: company?.ic ?? '',
    protistrana_dic: company?.dic ?? '',
    protistrana_adresa: company
      ? formatAddress({
          addressStreet: company.addressStreet,
          addressCity: company.addressCity,
          addressZip: company.addressZip,
        })
      : '',
    podepisujici: input.signerName ?? '',
    email: input.signerEmail ?? '',
    projekt: input.projectName ?? '',
    datum: dnes,
  };
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
