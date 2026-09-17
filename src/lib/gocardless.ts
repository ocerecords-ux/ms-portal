/**
 * NAPOJENÍ NA BANKU (zadání 17. 9. 2026: „potřebuju, ať se ta banka páruje
 * sama").
 *
 * Air Bank má vlastní PSD2 API jen pro registrované poskytovatele s eIDAS
 * certifikátem - jako firma se na něj napojit nejde. Chodí se proto přes
 * GoCardless Bank Account Data (dřív Nordigen), což je licencovaný
 * prostředník: pro tenhle rozsah zdarma, Air Bank podporovaná
 * (AIRBANK_AIRACZPP), historie až 730 dnů.
 *
 * Jak to funguje:
 *   1. portál si vymění secret_id + secret_key za přístupový token,
 *   2. založí souhlas (requisition) a dostane odkaz,
 *   3. člověk na odkaz klikne, přihlásí se do své banky a souhlas potvrdí,
 *   4. od té chvíle si portál sám stahuje pohyby.
 *
 * Souhlas má omezenou platnost (u Air Bank zhruba 90 dnů). Až vyprší, stačí
 * projít krok 2-3 znovu; portál na to upozorní dopředu.
 *
 * TOKEN SE NIKAM NEUKLÁDÁ. Drží se jen v paměti běžící funkce a po vypršení
 * se vymění za nový - klíče v databázi by byly zbytečné riziko.
 */

const ZAKLAD = 'https://bankaccountdata.gocardless.com/api/v2';

/** Kód Air Bank u GoCardless - předvyplněný, jiné banky jdou taky. */
export const AIR_BANK = 'AIRBANK_AIRACZPP';

export type GcInstituce = {
  id: string;
  name: string;
  bic?: string;
  transaction_total_days?: string;
  max_access_valid_for_days?: string;
};

export type GcTransakce = {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  additionalInformation?: string;
  endToEndId?: string;
  debtorName?: string;
  creditorName?: string;
  debtorAccount?: { iban?: string; bban?: string };
  creditorAccount?: { iban?: string; bban?: string };
};

export function bankaNastavena(): boolean {
  return Boolean(process.env.GOCARDLESS_SECRET_ID && process.env.GOCARDLESS_SECRET_KEY);
}

// Token platí 24 hodin; v paměti funkce vydrží jen chvíli, ale i tak se tím
// ušetří výměna klíčů při každém dotazu.
let token: { value: string; expiresAt: number } | null = null;

async function ziskejToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;

  const secret_id = process.env.GOCARDLESS_SECRET_ID;
  const secret_key = process.env.GOCARDLESS_SECRET_KEY;
  if (!secret_id || !secret_key) {
    throw new Error('Chybí GOCARDLESS_SECRET_ID nebo GOCARDLESS_SECRET_KEY.');
  }

  const res = await fetch(`${ZAKLAD}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_id, secret_key }),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Přihlášení do GoCardless selhalo (${res.status}).`);
  }
  const data = (await res.json()) as { access?: string; access_expires?: number };
  if (!data.access) throw new Error('GoCardless nevrátil přístupový token.');

  token = { value: data.access, expiresAt: Date.now() + (data.access_expires ?? 86400) * 1000 };
  return token.value;
}

async function zavolej<T>(cesta: string, init?: RequestInit): Promise<T> {
  const pristup = await ziskejToken();
  const res = await fetch(`${ZAKLAD}${cesta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${pristup}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const telo = await res.text().catch(() => '');
    // Do logu jde stavový kód a odpověď banky; klíče v tom nejsou.
    console.error('GoCardless', cesta, res.status, telo.slice(0, 500));
    throw new Error(`GoCardless odpověděl ${res.status}.`);
  }
  return (await res.json()) as T;
}

/** Banky dostupné v dané zemi - kvůli výběru, když to nebude Air Bank. */
export async function nactiInstituce(country = 'cz'): Promise<GcInstituce[]> {
  return zavolej<GcInstituce[]>(`/institutions/?country=${encodeURIComponent(country)}`);
}

/**
 * Souhlas k účtu. Vrací odkaz, na který člověk klikne a přihlásí se do banky.
 *
 * `access_valid_for_days` říká, jak dlouho bude portál moct pohyby stahovat
 * bez dalšího odklikávání - bereme maximum, které banka dovolí.
 */
export async function zalozSouhlas(input: {
  institutionId: string;
  redirect: string;
  reference: string;
  dnuHistorie?: number;
  dnuPlatnosti?: number;
}): Promise<{ requisitionId: string; agreementId: string; link: string; platiDoDnu: number }> {
  const dnuHistorie = input.dnuHistorie ?? 90;
  const dnuPlatnosti = input.dnuPlatnosti ?? 90;

  const dohoda = await zavolej<{ id: string; access_valid_for_days?: number }>('/agreements/enduser/', {
    method: 'POST',
    body: JSON.stringify({
      institution_id: input.institutionId,
      max_historical_days: String(dnuHistorie),
      access_valid_for_days: String(dnuPlatnosti),
      access_scope: ['balances', 'details', 'transactions'],
    }),
  });

  const souhlas = await zavolej<{ id: string; link: string }>('/requisitions/', {
    method: 'POST',
    body: JSON.stringify({
      redirect: input.redirect,
      institution_id: input.institutionId,
      reference: input.reference,
      agreement: dohoda.id,
      user_language: 'CS',
    }),
  });

  return {
    requisitionId: souhlas.id,
    agreementId: dohoda.id,
    link: souhlas.link,
    platiDoDnu: Number(dohoda.access_valid_for_days ?? dnuPlatnosti),
  };
}

/** Stav souhlasu a účty, které z něj vzešly (po odkliknutí v bance). */
export async function nactiSouhlas(requisitionId: string): Promise<{ status: string; accounts: string[] }> {
  const data = await zavolej<{ status: string; accounts?: string[] }>(
    `/requisitions/${encodeURIComponent(requisitionId)}/`,
  );
  return { status: data.status, accounts: data.accounts ?? [] };
}

/** Základní údaje o účtu - kvůli IBANu v přehledu. */
export async function nactiUcet(accountId: string): Promise<{ iban?: string; ownerName?: string; currency?: string }> {
  try {
    const data = await zavolej<{ account?: { iban?: string; ownerName?: string; currency?: string } }>(
      `/accounts/${encodeURIComponent(accountId)}/details/`,
    );
    return data.account ?? {};
  } catch {
    // Detail účtu není k párování potřeba - když ho banka nedá, nevadí.
    return {};
  }
}

/** Zaúčtované pohyby od daného dne. Nezaúčtované (pending) se neberou. */
export async function nactiTransakce(accountId: string, odeDne?: Date): Promise<GcTransakce[]> {
  const parametry = odeDne ? `?date_from=${odeDne.toISOString().slice(0, 10)}` : '';
  const data = await zavolej<{ transactions?: { booked?: GcTransakce[] } }>(
    `/accounts/${encodeURIComponent(accountId)}/transactions/${parametry}`,
  );
  return data.transactions?.booked ?? [];
}

/** Zrušení souhlasu - když se účet z portálu odpojuje. */
export async function zrusSouhlas(requisitionId: string): Promise<void> {
  try {
    await zavolej(`/requisitions/${encodeURIComponent(requisitionId)}/`, { method: 'DELETE' });
  } catch (err) {
    console.error('Zrušení souhlasu u GoCardless selhalo:', err);
  }
}

/** Text, ve kterém se hledá variabilní symbol - banka ho dává různě. */
export function textPlatby(t: GcTransakce): string {
  return [
    t.remittanceInformationUnstructured,
    ...(t.remittanceInformationUnstructuredArray ?? []),
    t.additionalInformation,
    t.endToEndId,
  ]
    .filter((kus): kus is string => Boolean(kus && kus !== 'NOTPROVIDED'))
    .join(' ')
    .trim();
}
