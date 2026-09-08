/**
 * Smlouvy s elektronickým podpisem (zadani 8. 9. 2026: "chtel bych udelat
 * vlastni podepisovani smluv, jak to ma treba Signi. Ale bez kodu
 * potvrzovacich.").
 *
 * Tenhle soubor je BEZ Prismy — používá ho i prohlížeč. Serverová část
 * (číslo smlouvy, otisk textu, výchozí šablony do databáze) je
 * v `contractsServer.ts`.
 *
 * Jak to funguje bez ověřovacích kódů: odkaz k podpisu je jednorázový token
 * poslaný na e-mail podepisujícího — stejný princip, jaký už používají
 * nabídky. Ke každému podpisu se ukládá doložka (čas, IP, prohlížeč) a otisk
 * textu, který měl člověk před sebou. Podle eIDAS je to prostý elektronický
 * podpis: pro herecké a klientské smlouvy běžná praxe.
 */

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rozpracovaná',
  SENT: 'Čeká na podpis',
  SIGNED: 'Podepsaná',
  REJECTED: 'Odmítnutá',
  CANCELLED: 'Zrušená',
};

export const CONTRACT_STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-field text-muted',
  SENT: 'bg-[#F1ECFF] text-brand-purpleDark',
  SIGNED: 'bg-[#E3F9EC] text-status-done',
  REJECTED: 'bg-red-50 text-red-600',
  CANCELLED: 'bg-red-50 text-red-600',
};

/** Pole, která se v šabloně doplní. Vypisují se u editoru šablony. */
export const CONTRACT_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'nase_firma', label: 'Naše firma (název)' },
  { key: 'nase_ic', label: 'Naše IČ' },
  { key: 'nase_dic', label: 'Naše DIČ' },
  { key: 'nase_adresa', label: 'Naše adresa' },
  { key: 'protistrana', label: 'Protistrana (jméno nebo firma)' },
  { key: 'protistrana_ic', label: 'IČ protistrany' },
  { key: 'protistrana_dic', label: 'DIČ protistrany' },
  { key: 'protistrana_adresa', label: 'Adresa protistrany' },
  { key: 'podepisujici', label: 'Jméno podepisujícího' },
  { key: 'email', label: 'E-mail podepisujícího' },
  { key: 'projekt', label: 'Název projektu' },
  { key: 'datum', label: 'Dnešní datum' },
];

/**
 * Doplní {{pole}} v šabloně. Co neznáme, necháme jako `…` — ať je při čtení
 * hned vidět, co se má doplnit ručně, místo prázdného místa.
 */
export function expandPlaceholders(body: string, values: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_full, key: string) => {
    const value = values[key.toLowerCase()];
    return value != null && String(value).trim() !== '' ? String(value) : '…';
  });
}

/** Kolik podpisů smlouva potřebuje: obě strany. */
export const REQUIRED_SIGNERS = ['MEDIASPACE', 'PROTISTRANA'] as const;

export function formatSignedAt(iso: string | Date | null): string {
  if (!iso) return '';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Výchozí šablony. Nasypou se do databáze při prvním otevření sekce a dál si
 * je admin upravuje sám — nejsou zadrátované v kódu.
 */
export const DEFAULT_CONTRACT_TEMPLATES: { name: string; body: string; sortOrder: number }[] = [
  {
    name: 'Smlouva o poskytnutí hlasového výkonu (herec)',
    sortOrder: 10,
    body: `SMLOUVA O POSKYTNUTÍ HLASOVÉHO VÝKONU

Smluvní strany

Objednatel:
{{nase_firma}}, IČ {{nase_ic}}, DIČ {{nase_dic}}
{{nase_adresa}}

Interpret:
{{protistrana}}
{{protistrana_adresa}}
e-mail: {{email}}

1. Předmět smlouvy
Interpret se zavazuje poskytnout objednateli svůj hlasový (umělecký) výkon
při výrobě díla „{{projekt}}" a objednatel se zavazuje zaplatit za něj
sjednanou odměnu.

2. Termín a místo
Nahrávání proběhne v termínech dohodnutých s produkcí objednatele, ve studiu
určeném objednatelem.

3. Odměna
Odměna činí … Kč a je splatná do 14 dnů od odevzdání výkonu na základě
daňového dokladu vystaveného interpretem.

4. Licence
Interpret poskytuje objednateli výhradní licenci k užití svého výkonu, a to
v neomezeném rozsahu co do množství, území a času, pro účel výroby a šíření
díla „{{projekt}}" ve všech zvukových formátech.

5. Závěrečná ujednání
Smlouva se řídí právním řádem České republiky. Uzavírá se elektronicky;
obě strany ji podepisují prostým elektronickým podpisem v portálu MS portal.

V Brně dne {{datum}}`,
  },
  {
    name: 'Smlouva o dílo (klient)',
    sortOrder: 20,
    body: `SMLOUVA O DÍLO

Smluvní strany

Zhotovitel:
{{nase_firma}}, IČ {{nase_ic}}, DIČ {{nase_dic}}
{{nase_adresa}}

Objednatel:
{{protistrana}}, IČ {{protistrana_ic}}, DIČ {{protistrana_dic}}
{{protistrana_adresa}}

1. Předmět smlouvy
Zhotovitel se zavazuje pro objednatele vyrobit dílo „{{projekt}}" v rozsahu
a kvalitě podle odsouhlasené nabídky a předat je objednateli.

2. Cena a platební podmínky
Cena díla je stanovena odsouhlasenou nabídkou. Faktura je splatná do 14 dnů
od jejího vystavení.

3. Termín plnění
Dílo bude předáno v termínu dohodnutém v nabídce, nedohodnou-li se strany
jinak.

4. Licence
Zhotovitel poskytuje objednateli licenci k užití díla v rozsahu sjednaném
v nabídce.

5. Závěrečná ujednání
Smlouva se řídí právním řádem České republiky. Uzavírá se elektronicky;
obě strany ji podepisují prostým elektronickým podpisem v portálu MS portal.

V Brně dne {{datum}}`,
  },
  {
    name: 'Prázdná smlouva',
    sortOrder: 90,
    body: `NÁZEV SMLOUVY

Smluvní strany

{{nase_firma}}, IČ {{nase_ic}}
{{nase_adresa}}

{{protistrana}}
{{protistrana_adresa}}

1. Předmět smlouvy


2. Odměna


3. Závěrečná ujednání
Smlouva se řídí právním řádem České republiky. Uzavírá se elektronicky.

V Brně dne {{datum}}`,
  },
];
