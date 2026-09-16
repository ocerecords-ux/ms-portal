import nodemailer from 'nodemailer';
import { pozdrav, sedmyPad } from '@/lib/osloveni';
import { bezZnacek, znackyNaHtml } from '@/lib/formatovaniZpravy';

/**
 * SPOJENÍ SE SMTP SE DRŽÍ (oprava 15. 9. 2026: „smlouvy chodí na mail se
 * strašným zpožděním a musím dát několikrát odeslat znovu").
 *
 * Dřív se pro KAŽDÝ e-mail vyráběl nový transport, tedy nové TCP spojení,
 * TLS handshake a přihlášení - u pomalého poštovního serveru to je klidně
 * deset vteřin, a když se do toho vejde limit funkce, odeslání spadne
 * a člověk klikne znovu. Odtud „strašné zpoždění" i několik kopií naráz.
 *
 * Teď se transport drží v paměti instance (na Vercelu jich běží víc, ale
 * teplá instance obslouží několik mailů za sebou bez dalšího přihlašování)
 * a má POOL a ROZUMNÉ ČASOVÉ LIMITY: když poštovní server neodpovídá, chyba
 * přijde za pár vteřin a je vidět, místo aby požadavek visel do limitu.
 */
let transportCache: { klic: string; transport: nodemailer.Transporter } | null = null;

function getTransport() {
  // Hodnoty se ORIZAVAJI: heslo i jmeno se do nastaveni vkladaji ze schranky
  // a nalepena mezera nebo konec radku znamena "535 authentication failed",
  // na kterem se da hledat hodne dlouho.
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const heslo = process.env.SMTP_PASSWORD?.trim();
  if (!host || !user || !heslo) return null;

  const port = Number(process.env.SMTP_PORT?.trim()) || 587;
  const klic = `${host}:${port}:${user}`;
  if (transportCache?.klic === klic) return transportCache.transport;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: heslo },
    // Spojeni se drzi a pouzije na dalsi mail - viz komentar vyse.
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    // Kdyz server neodpovida, at to spadne rychle a s jasnou hlaskou.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 25_000,
  });
  transportCache = { klic, transport };
  return transport;
}

/**
 * JEDNA SCHRÁNKA NA VŠECHNU ODCHOZÍ POŠTU (rozhodnuto 13. 9. 2026: „založíme
 * univerzální mail pro odesílání: mediaspace@msportal.cz").
 *
 * Napřed měla každá agenda odesílat ze své vlastní adresy (nabidky@, uctarna@
 * na mediaspace.cz). Neprošlo to: poštovní server pustí do „Od" jen adresu
 * z domény, kterou má ověřenou, a mail s cizí doménou odmítl rovnou —
 * „551 Domain name mismatch between authenticated sender ... and source
 * address". Odesílá proto jediná schránka a rozlišení nese JMÉNO odesílatele
 * a REPLY-TO:
 *
 * Jméno v „Od" je vždycky Mediaspace; liší se jen PŘEDMĚT a REPLY-TO:
 *
 *   nabídka → odpověď jde manažerovi projektu
 *   faktura → odpověď jde účtárně
 *   ostatní → odpověď jde do společné schránky
 *
 * Adresa je jen jedna a mění se na jednom místě - tady.
 */

/**
 * Adresa, ze které portál posílá VŠECHNU poštu (zadání 14. 9. 2026: „chci, aby
 * to šlo normálně z adresy mediaspace@msportal.cz").
 *
 * SCHVÁLNĚ V KÓDU, NE V PROMĚNNÉ PROSTŘEDÍ. Do 14. 9. 2026 o viditelné adrese
 * rozhodovalo `SMTP_FROM` na Vercelu. Ta proměnná je tam ale citlivá (nejde
 * přečíst) a zůstala v ní stará adresa `objednavka-audioknihy@msportal.cz`,
 * takže se rozhodnutí z 13. 9. („odesílatel je vždycky Mediaspace") v poště
 * vůbec neprojevilo a nikdo to nemohl ověřit. Přihlašovací údaje k poště
 * zůstávají v prostředí (SMTP_HOST / SMTP_USER / SMTP_PASS); tohle je jen
 * hlavička „Od", a ta patří do kódu, kde je vidět.
 */
const ADRESA_ODESILATELE = 'mediaspace@msportal.cz';
const ODESILATEL = `Mediaspace <${ADRESA_ODESILATELE}>`;

function adresaOdesilatele(): string {
  return ADRESA_ODESILATELE;
}

/**
 * Kam chodí odpovědi na faktury. Účtárna je jiná schránka než ta odesílací -
 * odpovědi na doklady patří k dokladům, ne do obecné pošty.
 */
const ODPOVED_UCTARNA = process.env.MAIL_UCTARNA?.trim() || 'uctarna@mediaspace.cz';

/**
 * Odesílatel VŠÍ odchozí pošty (rozhodnuto 13. 9. 2026: „jméno schránky bude
 * vždy Mediaspace a bude se lišit jen předmět").
 *
 * V poště se tedy vždycky ukáže „Mediaspace <mediaspace@msportal.cz>" - i
 * u nabídek, faktur a zpráv o stavu projektu. Že za nabídkou stojí konkrétní
 * člověk, se pozná z PŘEDMĚTU, z podpisu s fotkou v těle zprávy a hlavně
 * z REPLY-TO: odpověď jde přímo jemu, ne do společné schránky.
 *
 * @param odpovedNa adresa, na kterou má klientovi odejít odpověď
 */
export function odesilatelMediaspace(odpovedNa?: string | null): {
  from: { name: string; address: string };
  replyTo?: string;
} {
  const odpoved = odpovedNa?.trim();
  return {
    from: { name: 'Mediaspace', address: adresaOdesilatele() },
    replyTo: odpoved || undefined,
  };
}

/**
 * Stav odesílání pošty pro diagnostiku (zadání 11. 9. 2026: „zvukař si
 * vyresetoval heslo a nepřišel mu žádný e-mail").
 *
 * Odesílání se dělo potichu: endpoint na zapomenuté heslo schválně odpovídá
 * vždycky stejně, aby neprozradil, které e-maily v portálu existují — jenže
 * tím zmizela i informace, že se vůbec nic neodeslalo. Tohle se zeptá serveru
 * napřímo: spojí se, přihlásí a zase odejde. Nic neposílá.
 *
 * Vrací i jméno serveru a adresu odesílatele — ani jedno není tajné a obojí
 * je první, na co se při nedoručené poště kouká.
 */
export async function stavPosty(): Promise<{
  nastaveno: boolean;
  host: string | null;
  port: number | null;
  odesilatel: string | null;
  spojeni: 'ok' | 'chyba' | 'nenastaveno';
  chyba: string | null;
  /** Kam chodí odpovědi na faktury. */
  odpovedUctarna: string;
}> {
  const host = process.env.SMTP_HOST || null;
  const port = Number(process.env.SMTP_PORT) || 587;
  const odesilatel = ODESILATEL;
  const transport = getTransport();
  if (!transport) {
    return { nastaveno: false, host, port, odesilatel, spojeni: 'nenastaveno', chyba: null, odpovedUctarna: ODPOVED_UCTARNA };
  }
  try {
    await transport.verify();
    return { nastaveno: true, host, port, odesilatel, spojeni: 'ok', chyba: null, odpovedUctarna: ODPOVED_UCTARNA };
  } catch (err) {
    return {
      nastaveno: true,
      host,
      port,
      odesilatel,
      spojeni: 'chyba',
      chyba: err instanceof Error ? err.message.slice(0, 300) : 'Neznámá chyba.',
      odpovedUctarna: ODPOVED_UCTARNA,
    };
  }
}

// Animovane logo Mediaspace v hlavicce e-mailu (schvaleno 4. 9. 2026 -
// varianta B, s pruhlednym pozadim aby splyvalo s fialovym gradientem
// hlavicky). Zamerne NENI vlozene jako base64 (na rozdil od puvodni staticke
// PNG) - jako animovany GIF ma cca 550 KB, coz by base64 (~+33 %) nafouklo
// kazdy odeslany e-mail o ~750 KB a Gmail takove e-maily oriznuje ("message
// clipped"). Misto toho se hostuje jako staticky soubor na portalu a
// natahuje se pres URL - standardni postup pro animovana loga v e-mailech.
const LOGO_GIF_PATH = '/mediaspace-logo.gif';

/** Escapuje hodnoty vkladane do HTML e-mailu (jde o data od klienta/uzivatele). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type OrderEmailInput = {
  /**
   * Komu zpráva jde - adresy členů týmu, kteří mají na kartě uživatele
   * zaškrtnuté „Dostává objednávky" (zadání 14. 9. 2026). Prázdné pole
   * znamená, že to zatím nikdo nemá zaškrtnuté; viz sendOrderNotificationEmail.
   */
  prijemci: string[];
  companyId: string;
  companyName: string;
  title: string;
  pageCount: number | null;
  priceEstimate: number | null;
  deadline: string | null;
  preferredNarrator: string | null;
  note: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  requestedByName: string | null;
  requestedByEmail: string;
  /**
   * Zpráva BEZ PŘEDBĚŽNÉ CENY (zadání 16. 9. 2026: „Helča, která má přístup
   * Produkce, by neměla vidět cenu. Jen normostrany").
   *
   * Řádek s cenou se vynechá celý — ne prázdný, ne „—". Prázdná kolonka
   * vypadá jako chybějící údaj a člověk pak shání, co se nespočítalo.
   * Rozhoduje o tom volající podle role příjemce (viz vidiCenuObjednavky
   * v lib/roles.ts), ne e-mailová vrstva.
   */
  bezCeny?: boolean;
};

// HTML sablona interniho e-mailu (tym Mediaspace) - schvaleny design, viz
// e-mailovy mockup z 4. 9. 2026 (fialovo-zelena identita msportal.cz,
// rychle skenovatelny prehled objednavky s odkazem do adminu).
function buildInternalNotificationHtml(input: OrderEmailInput): string {
  const priceText = input.priceEstimate != null ? `${input.priceEstimate.toLocaleString('cs-CZ')} Kč` : '—';
  const pageCountText = input.pageCount != null ? String(input.pageCount) : '—';
  const deadlineText = input.deadline ?? '—';
  const narratorText = input.preferredNarrator ? escapeHtml(input.preferredNarrator) : '—';
  const noteText = input.note ? escapeHtml(input.note) : '—';
  const attachmentCell = input.attachmentUrl
    ? `<a href="${escapeHtml(input.attachmentUrl)}">${escapeHtml(input.attachmentName || 'příloha')} ↗</a>`
    : '—';
  const nameText = input.requestedByName ? escapeHtml(input.requestedByName) : '—';
  const receivedAt = new Date().toLocaleString('cs-CZ', {
    timeZone: 'Europe/Prague',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
  const companyAdminUrl = `${baseUrl}/admin/companies/${encodeURIComponent(input.companyId)}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<style>
  /* Sablona ma jeden pevny (brand) vzhled - schvalne NENI adaptivni na tmavy
     rezim. Bez tohohle si nektere klienty (napr. Apple Mail) barvy "opravi"
     samy a text/logo se stane necitelnym. */
  :root { color-scheme: light only; supported-color-schemes: light; }
  body { margin: 0 !important; padding: 0 !important; background: #FBFAFF !important; }
  table { border-collapse: collapse; width: 100%; }
  .email-hero { background: #6B2AF0 !important; background: linear-gradient(135deg, #7B55FF, #6B2AF0) !important; padding: 28px 32px 24px; }
  .email-hero .word { display: block; height: 150px; width: 150px; }
  .email-hero .tag { font-family: 'Acid Grotesk', Helvetica, Arial, sans-serif; color: #C9FFDF !important; font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; margin-top: 16px; }
  .email-hero .bar { height: 3px; width: 46px; background: #1FDF67 !important; border-radius: 2px; margin-top: 14px; }
  .email-content { padding: 30px 32px 8px; font-family: 'Acid Grotesk', Helvetica, Arial, sans-serif; background: #FFFFFF !important; color: #201A33 !important; }
  .email-content h2 { font-size: 19px; margin: 0 0 14px; font-weight: 600; color: #201A33 !important; }
  .badge { display: inline-block; background: #E9FFF2 !important; color: #149E4B !important; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 4px 9px; border-radius: 999px; margin-bottom: 12px; }
  .field-table { border: 1px solid #E4DFFB; border-radius: 10px; overflow: hidden; margin: 4px 0 18px; }
  .field-table tr:not(:last-child) td { border-bottom: 1px solid #E4DFFB; }
  .field-table td { padding: 11px 14px; font-size: 13.5px; vertical-align: top; background: #FFFFFF !important; }
  .field-table td.label { color: #6E6580 !important; width: 42%; background: #F6F6F6 !important; font-weight: 500; }
  .field-table td.value { color: #201A33 !important; font-weight: 600; }
  .field-table td.value.regular { font-weight: 400; }
  .field-table td.value a { color: #6B2AF0 !important; text-decoration: none; font-weight: 600; }
  .cta-row { padding: 4px 0 26px; background: #FFFFFF !important; }
  .cta { display: inline-block; background: #201A33 !important; color: #ffffff !important; text-decoration: none; font-size: 13.5px; font-weight: 600; padding: 11px 20px; border-radius: 8px; }
  .email-footer { padding: 18px 32px 26px; border-top: 1px solid #E4DFFB; background: #FFFFFF !important; }
  .email-footer p { margin: 0; font-size: 11.5px; color: #6E6580 !important; }
  .email-footer .brand { color: #6B2AF0 !important; font-weight: 600; }
  /* Nektere klienty (napr. Apple Mail) i pres color-scheme meta vyse pridaji
     vlastni "prefers-color-scheme: dark" pravidla - tady jim schvalne
     podstrcime STEJNE barvy jako u svetleho vzhledu, aby uz nemely co menit. */
  @media (prefers-color-scheme: dark) {
    body { background: #FBFAFF !important; }
    .email-hero { background: #6B2AF0 !important; }
    .email-hero .tag { color: #C9FFDF !important; }
    .email-content, .field-table td, .cta-row, .email-footer { background: #FFFFFF !important; color: #201A33 !important; }
    .field-table td.label { background: #F6F6F6 !important; color: #6E6580 !important; }
    .field-table td.value { color: #201A33 !important; }
    .field-table td.value a, .email-footer .brand { color: #6B2AF0 !important; }
    .email-footer p { color: #6E6580 !important; }
    .cta { background: #201A33 !important; color: #ffffff !important; }
  }
</style>
</head>
<body>
<table role="presentation">
  <tr><td class="email-hero">
    <img class="word" src="${baseUrl}${LOGO_GIF_PATH}" width="150" height="150" alt="Mediaspace" />
    <div class="tag">MS Portal - Objednávka audioknihy</div>
    <div class="bar"></div>
  </td></tr>
  <tr><td class="email-content">
    <span class="badge">Nová objednávka</span>
    <h2>${escapeHtml(input.title)} — ${escapeHtml(input.companyName)}</h2>

    <table class="field-table" role="presentation">
      <tr><td class="label">Firma</td><td class="value">${escapeHtml(input.companyName)}</td></tr>
      <tr><td class="label">Počet normostran</td><td class="value">${pageCountText}</td></tr>
      ${input.bezCeny ? '' : `<tr><td class="label">Předběžná cena</td><td class="value">${priceText}</td></tr>`}
      <tr><td class="label">Termín odevzdání</td><td class="value">${deadlineText}</td></tr>
      <tr><td class="label">Preferovaný herec</td><td class="value">${narratorText}</td></tr>
      <tr><td class="label">Poznámka klienta</td><td class="value regular">${noteText}</td></tr>
      <tr><td class="label">Příloha</td><td class="value">${attachmentCell}</td></tr>
      <tr><td class="label">Jméno</td><td class="value regular">${nameText}</td></tr>
      <tr><td class="label">E-mail</td><td class="value regular">${escapeHtml(input.requestedByEmail)}</td></tr>
      <tr><td class="label">Přijato</td><td class="value regular">${receivedAt}</td></tr>
    </table>

    <div class="cta-row">
      <a href="${companyAdminUrl}" class="cta">Otevřít firmu v adminu →</a>
    </div>
  </td></tr>
  <tr><td class="email-footer">
    <p><span class="brand">Mediaspace</span> · automatická notifikace z MS Portal, neodpovídat</p>
  </td></tr>
</table>
</body>
</html>`;
}

function buildInternalNotificationText(input: OrderEmailInput): string {
  return [
    `Nova objednavka audioknihy - ${input.companyName}`,
    '',
    `Nazev: ${input.title}`,
    `Pocet normostran: ${input.pageCount ?? '-'}`,
    ...(input.bezCeny
      ? []
      : [`Predbezna cena: ${input.priceEstimate != null ? input.priceEstimate + ' Kc' : '-'}`]),
    `Datum odevzdani: ${input.deadline ?? '-'}`,
    `Preferovany herec: ${input.preferredNarrator ?? '-'}`,
    `Poznamka: ${input.note ?? '-'}`,
    `Priloha: ${input.attachmentUrl ?? 'zadna'}`,
    `Jmeno: ${input.requestedByName ?? '-'}`,
    `Objednal: ${input.requestedByEmail}`,
  ].join('\n');
}

/**
 * Zpráva o nové objednávce týmu Mediaspace. KLIENT JI NIKDY NEDOSTANE - jde
 * výhradně na adresy z `input.prijemci`.
 *
 * Adresáti se nastavují v portálu na kartě uživatele („Dostává objednávky"),
 * ne proměnnou prostředí. Od 15. 9. 2026 už není žádná společná záložní
 * schránka: kdo objednávky hlídá, je vidět v portálu, a když si to nikdo
 * nezaškrtne, sáhne volající po adminech (viz /api/orders). Sem se pak
 * dostane hotový seznam adres.
 */
export async function sendOrderNotificationEmail(input: OrderEmailInput) {
  const transport = getTransport();
  // Spolecna schranka objednavky@mediaspace.cz uz se nepouziva (zadani
  // 15. 9. 2026: „ten mail bych nakonec vynechal a nepouzival"). Komu
  // objednavka jde, urcuje volajici podle zaskrtnuti na kartach uzivatelu;
  // kdyz nikomu, neni co odesilat.
  const to = input.prijemci.map((a) => a.trim()).filter(Boolean);
  if (to.length === 0) {
    console.warn(`Objednávka „${input.title}": není komu ji poslat.`);
    return { sent: false, reason: 'BEZ_PRIJEMCE' as const };
  }

  if (!transport) {
    // SMTP zatim neni nakonfigurovane - objednavka se presto ulozi,
    // jen se neodesle e-mail. Volajici kod tuto informaci zaloguje.
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to,
    subject: `Objednávka audioknihy – ${input.title}`,
    text: buildInternalNotificationText(input),
    html: buildInternalNotificationHtml(input),
  });

  return { sent: true as const, komu: to };
}

// ---------------------------------------------------------------------------
// Pozvanka do portalu (zadani 5. 9. 2026)
// ---------------------------------------------------------------------------
// Admin uzivateli posle pozvanku; odkaz v ni obsahuje jednorazovy token,
// kterym si uzivatel sam nastavi heslo (viz /api/admin/users/[id]/invite a
// stranka /nastaveni-hesla). Sablona zamerne drzi stejnou fialovo-zelenou
// identitu jako notifikace objednavky vyse - vytvarne se jeste doladi.

/**
 * Komu pozvanka jde (zadani 5. 9. 2026: "Když budeme posílat pozvánky
 * uživatelům Mediaspace nebo hercům, musí to vypadat jinak. Hlavně mi jde o
 * ten seznam, co v portálu najdete."). Odvozuje se z role uzivatele - viz
 * /api/admin/users/[id]/invite.
 */
export type InviteAudience = 'CLIENT' | 'INTERNAL' | 'HEREC';

type InviteEmailInput = {
  to: string;
  name: string | null;
  inviteUrl: string;
  expiresAt: Date;
  audience: InviteAudience;
};

/** Uvodni odstavec a "co v portalu najdete" podle toho, komu pozvanka jde. */
const INVITE_COPY: Record<
  InviteAudience,
  { tag: string; badge: string; heading: string; intro: string; listTitle: string | null; list: string[] }
> = {
  CLIENT: {
    tag: 'Pozvánka do portálu',
    badge: 'Nový přístup',
    heading: 'Vítejte v MS Portalu',
    intro:
      'připravili jsme vám přístup do klientského portálu Mediaspace. Heslo si nastavíte sami - stačí jedno kliknutí.',
    listTitle: 'Co v portálu najdete',
    list: [
      'Přehled vašich projektů a jejich stavu',
      'Objednávkový formulář s předběžnou cenou',
      'Hotové i rozpracované nahrávky ke stažení',
    ],
  },
  INTERNAL: {
    tag: 'Interní přístup',
    badge: 'Interní účet',
    heading: 'Váš přístup do MS Portalu',
    intro: 'založili jsme ti interní účet do MS Portalu. Heslo si nastavíš sám - stačí jedno kliknutí.',
    listTitle: 'Co v portálu najdeš',
    list: [
      'Přehled všech projektů z Caflou - aktivní i dokončené',
      'Detail projektu: manažer, priorita, typ zakázky a odkaz na KZ',
      'Správu firem a uživatelů (podle role)',
    ],
  },
  HEREC: {
    tag: 'Pozvánka do portálu',
    badge: 'Nový přístup',
    heading: 'Vítejte v MS Portalu',
    intro:
      'založili jsme vám účet do MS Portalu, kde vedeme spolupráci s herci. Heslo si nastavíte sami - stačí jedno kliknutí.',
    // Hercovska cast portalu se teprve stavi - schvalne tu neslibujeme nic,
    // co uzivatel po prihlaseni nenajde.
    listTitle: null,
    list: [],
  },
};

/**
 * Spolecny "obal" e-mailu MS Portal (grafika schvalena 5. 9. 2026):
 * fialovy gradientovy hero s animovanym logem a zelenym prouzkem, bila karta
 * s obsahem, decentni paticka. Vsechny nase e-maily pouzivaji tenhle ramec,
 * aby portal posilal jednu vizualni radu.
 *
 * Pozn.: pevny svetly vzhled (color-scheme light only + zdvojena pravidla v
 * prefers-color-scheme: dark) je zamerny - bez toho si nektere klienty
 * (Apple Mail) barvy "opravi" samy a logo/text zesednou.
 */
function emailShell(options: { tag: string; preheader: string; body: string }): string {
  const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<style>
  :root { color-scheme: light only; supported-color-schemes: light; }
  body { margin: 0 !important; padding: 0 !important; background: #FBFAFF !important; }
  .preheader { display: none !important; visibility: hidden; opacity: 0; height: 0; width: 0; overflow: hidden; mso-hide: all; }
  table { border-collapse: collapse; }
  .wrap { width: 100%; background: #FBFAFF !important; padding: 28px 12px 40px; }
  .card { width: 100%; max-width: 560px; margin: 0 auto; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(32,26,51,0.08); }
  .hero { background: #6B2AF0 !important; background: linear-gradient(135deg, #7B55FF, #6B2AF0) !important; padding: 30px 34px 26px; text-align: left; }
  .hero .logo { display: block; height: 96px; width: 96px; border: 0; }
  .hero .word { font-family: 'Acid Grotesk', Helvetica, Arial, sans-serif; font-size: 21px; font-weight: 700; color: #1FDF67 !important; letter-spacing: 0.01em; padding-right: 14px; }
  .hero .rule { display: inline-block; width: 1px; height: 26px; background: rgba(255,255,255,0.4) !important; }
  .hero .tag { font-family: 'Acid Grotesk', Helvetica, Arial, sans-serif; color: #C9FFDF !important; font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; padding-top: 18px; }
  .hero .bar { height: 3px; width: 46px; background: #1FDF67 !important; border-radius: 2px; margin-top: 12px; }
  .content { padding: 30px 34px 10px; font-family: 'Acid Grotesk', Helvetica, Arial, sans-serif; background: #FFFFFF !important; color: #201A33 !important; }
  .content h2 { font-size: 21px; line-height: 1.3; margin: 0 0 14px; font-weight: 600; color: #201A33 !important; }
  .content p { font-size: 14.5px; line-height: 1.65; margin: 0 0 14px; color: #201A33 !important; }
  .content .small { font-size: 12px; line-height: 1.6; color: #6E6580 !important; }
  .badge { display: inline-block; background: #E9FFF2 !important; color: #149E4B !important; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 5px 10px; border-radius: 999px; margin-bottom: 14px; }
  .field-table { width: 100%; border: 1px solid #E4DFFB; border-radius: 12px; overflow: hidden; margin: 4px 0 20px; }
  .field-table tr:not(:last-child) td { border-bottom: 1px solid #E4DFFB; }
  .field-table td { padding: 11px 14px; font-size: 13.5px; vertical-align: top; background: #FFFFFF !important; }
  .field-table td.label { color: #6E6580 !important; width: 44%; background: #F7F5FF !important; font-weight: 500; }
  .field-table td.value { color: #201A33 !important; font-weight: 600; }
  .field-table td.value.regular { font-weight: 400; }
  .field-table td.value a { color: #6B2AF0 !important; text-decoration: none; font-weight: 600; }
  .cta-row { padding: 2px 0 24px; background: #FFFFFF !important; }
  .cta { display: inline-block; background: #1FDF67 !important; color: #10331F !important; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 10px; }
  .cta-dark { display: inline-block; background: #201A33 !important; color: #ffffff !important; text-decoration: none; font-size: 13.5px; font-weight: 600; padding: 11px 20px; border-radius: 8px; }
  .steps td { font-family: 'Acid Grotesk', Helvetica, Arial, sans-serif; font-size: 13.5px; color: #201A33 !important; padding: 0 0 10px; background: #FFFFFF !important; }
  .steps .num { width: 26px; color: #6B2AF0 !important; font-weight: 700; }
  .tagger { width: 100%; background: #F7F5FF !important; border-radius: 12px; margin: 0 0 8px; }
  .tagger td { padding: 16px 18px; background: #F7F5FF !important; }
  .tagger .t-title { margin: 0 0 10px; font-family: 'Acid Grotesk', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #6B2AF0 !important; }
  .tagger .t-steps td { padding: 0 0 8px; font-size: 13px; line-height: 1.5; background: #F7F5FF !important; color: #201A33 !important; }
  .footer { padding: 18px 34px 26px; border-top: 1px solid #E4DFFB; background: #FFFFFF !important; }
  .footer p { margin: 0; font-family: 'Acid Grotesk', Helvetica, Arial, sans-serif; font-size: 11.5px; line-height: 1.6; color: #6E6580 !important; }
  .footer .brand { color: #6B2AF0 !important; font-weight: 600; }
  @media (prefers-color-scheme: dark) {
    body, .wrap { background: #FBFAFF !important; }
    .hero { background: #6B2AF0 !important; }
    .hero .word { color: #1FDF67 !important; }
    .hero .tag { color: #C9FFDF !important; }
    .content, .cta-row, .footer, .steps td, .field-table td { background: #FFFFFF !important; color: #201A33 !important; }
    .tagger, .tagger td, .tagger .t-steps td { background: #F7F5FF !important; color: #201A33 !important; }
    .tagger .t-title { color: #6B2AF0 !important; }
    .content h2, .content p, .field-table td.value { color: #201A33 !important; }
    .content .small, .footer p, .field-table td.label { color: #6E6580 !important; }
    .field-table td.label { background: #F7F5FF !important; }
    .cta { background: #1FDF67 !important; color: #10331F !important; }
    .cta-dark { background: #201A33 !important; color: #ffffff !important; }
  }
  @media (max-width: 520px) {
    .hero, .content, .footer { padding-left: 22px !important; padding-right: 22px !important; }
    .hero .logo { height: 76px !important; width: 76px !important; }
  }
</style>
</head>
<body>
<span class="preheader">${escapeHtml(options.preheader)}</span>
<table role="presentation" class="wrap" width="100%"><tr><td>
  <table role="presentation" class="card" width="560">
    <tr><td class="hero">
      <table role="presentation"><tr>
        <td class="word">Mediaspace</td>
        <td><span class="rule"></span></td>
        <td style="padding-left:14px;">
          <img class="logo" src="${baseUrl}${LOGO_GIF_PATH}" width="96" height="96" alt="Mediaspace" />
        </td>
      </tr></table>
      <div class="tag">${escapeHtml(options.tag)}</div>
      <div class="bar"></div>
    </td></tr>
    <tr><td class="content">${options.body}</td></tr>
    <tr><td class="footer">
      <p><span class="brand">Mediaspace</span> · <a href="${baseUrl}" style="color:#6B2AF0;text-decoration:none;">www.msportal.cz</a></p>
    </td></tr>
  </table>
</td></tr></table>
</body>
</html>`;
}

export function buildInviteHtml(input: InviteEmailInput): string {
  const greeting = escapeHtml(pozdrav(input.name));
  const expiresText = input.expiresAt.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' });

  const copy = INVITE_COPY[input.audience];
  const listHtml = copy.listTitle
    ? `
    <p style="font-weight:600;margin-bottom:10px;">${copy.listTitle}</p>
    <table role="presentation" class="steps" width="100%">
      ${copy.list
        .map((item, i) => `<tr><td class="num">${i + 1}</td><td>${item}</td></tr>`)
        .join('\n      ')}
    </table>
`
    : '';
  const closing =
    input.audience === 'INTERNAL'
      ? 'Pokud odkaz vyprší, řekni si o nový. Kdyby něco nefungovalo, dej vědět.'
      : 'Pokud odkaz vyprší, napište nám a pošleme vám nový. Tuto pozvánku jste dostali, protože pro vás Mediaspace založila účet - pokud si ji neumíte vysvětlit, dejte nám prosím vědět.';

  return emailShell({
    tag: copy.tag,
    preheader: 'Váš přístup do MS Portalu je připravený - stačí si nastavit heslo.',
    body: `
    <span class="badge">${copy.badge}</span>
    <h2>${copy.heading}</h2>
    <p>${greeting}</p>
    <p>${copy.intro}</p>

    <table role="presentation" class="field-table">
      <tr><td class="label">Přihlašovací jméno</td><td class="value">${escapeHtml(input.to)}</td></tr>
      <tr><td class="label">Odkaz platí do</td><td class="value regular">${expiresText}</td></tr>
    </table>

    <div class="cta-row">
      <a href="${escapeHtml(input.inviteUrl)}" class="cta">Nastavit heslo</a>
    </div>
${listHtml}
    <p class="small">${closing}</p>
  `,
  });
}

export async function sendInviteEmail(input: InviteEmailInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: input.audience === 'INTERNAL' ? 'Přístup do MS Portalu' : 'Pozvánka do MS Portalu',
    text: [
      pozdrav(input.name),
      '',
      'pripravili jsme vam pristup do portalu Mediaspace (MS Portal).',
      `Prihlasovaci jmeno: ${input.to}`,
      '',
      'Heslo si nastavite zde:',
      input.inviteUrl,
      '',
      `Odkaz plati do ${input.expiresAt.toLocaleDateString('cs-CZ')}.`,
    ].join('\n'),
    html: buildInviteHtml(input),
  });

  return { sent: true as const };
}

// ---------------------------------------------------------------------------
// Potvrzeni objednavky klientovi (zadani 5. 9. 2026: "Nastav už i mail na
// potvrzení objednávky pro klienta ve chvíli, kdy ji odešle.")
// ---------------------------------------------------------------------------
// Chodi na e-mail uzivatele, ktery objednavku odeslal, hned po jejim ulozeni.
// Interni notifikace timu zustava beze zmeny (viz sendOrderNotificationEmail).

type OrderConfirmationInput = {
  to: string;
  name: string | null;
  isAudiobook: boolean;
  title: string;
  companyName: string;
  pageCount: number | null;
  priceEstimate: number | null;
  deadline: string | null;
  preferredNarrator: string | null;
  note: string | null;
  attachmentName: string | null;
};

export function buildOrderConfirmationHtml(input: OrderConfirmationInput): string {
  const greeting = escapeHtml(pozdrav(input.name));
  const rows: string[] = [
    `<tr><td class="label">Název</td><td class="value">${escapeHtml(input.title)}</td></tr>`,
  ];
  if (input.isAudiobook) {
    rows.push(
      `<tr><td class="label">Počet normostran</td><td class="value regular">${input.pageCount ?? '—'}</td></tr>`,
    );
    rows.push(
      `<tr><td class="label">Předběžná cena</td><td class="value">${
        input.priceEstimate != null ? `${input.priceEstimate.toLocaleString('cs-CZ')} Kč` : '—'
      }</td></tr>`,
    );
  }
  rows.push(
    `<tr><td class="label">Termín odevzdání</td><td class="value regular">${input.deadline ?? '—'}</td></tr>`,
  );
  if (input.preferredNarrator) {
    rows.push(
      `<tr><td class="label">Preferovaný herec</td><td class="value regular">${escapeHtml(
        input.preferredNarrator,
      )}</td></tr>`,
    );
  }
  if (input.note) {
    rows.push(`<tr><td class="label">Poznámka</td><td class="value regular">${escapeHtml(input.note)}</td></tr>`);
  }
  if (input.attachmentName) {
    rows.push(
      `<tr><td class="label">Příloha</td><td class="value regular">${escapeHtml(input.attachmentName)}</td></tr>`,
    );
  }

  const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');

  return emailShell({
    tag: input.isAudiobook ? 'Objednávka audioknihy' : 'Objednávka',
    preheader: `Objednávku ${input.title} jsme přijali.`,
    body: `
    <span class="badge">Objednávka přijata</span>
    <h2>Máme vaši objednávku</h2>
    <p>${greeting}</p>
    <p>děkujeme za objednávku. Přijali jsme ji a ozveme se vám s potvrzením termínu${
      input.isAudiobook ? ' a konečné ceny' : ''
    }.</p>

    <table role="presentation" class="field-table">
      ${rows.join('\n      ')}
    </table>

    <div class="cta-row">
      <a href="${baseUrl}/projekty" class="cta-dark">Zobrazit v portálu →</a>
    </div>

    ${
      input.isAudiobook
        ? '<p class="small">Uvedená cena je předběžná - vychází z počtu normostran a vaší sjednané sazby. Konečnou cenu potvrdíme po kontrole podkladů.</p>'
        : ''
    }
    <p class="small">Tento e-mail je automatické potvrzení z MS Portalu. Když něco nesedí, odpovězte nám nebo napište na
       <a href="mailto:${ADRESA_ODESILATELE}" style="color:#6B2AF0;text-decoration:none;">${ADRESA_ODESILATELE}</a>.</p>
  `,
  });
}

export async function sendOrderConfirmationEmail(input: OrderConfirmationInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  await transport.sendMail({
    // ADRESY TYMU SEM NESMI (zadani 14. 9. 2026: „klient nevidi adresy tymu").
    // Do 14. 9. 2026 tu v Reply-To svitila interni schranka na objednavky;
    // ted odpoved jde zpatky na mediaspace@msportal.cz, tedy tam, odkud
    // zprava prisla. Kdo ji uvnitr cte, je nase vec, ne klientova.
    ...odesilatelMediaspace(),
    to: input.to,
    subject: `Potvrzení objednávky – ${input.title}`,
    text: [
      pozdrav(input.name),
      '',
      'dekujeme za objednavku, prijali jsme ji.',
      '',
      `Nazev: ${input.title}`,
      ...(input.isAudiobook
        ? [
            `Pocet normostran: ${input.pageCount ?? '-'}`,
            `Predbezna cena: ${input.priceEstimate != null ? input.priceEstimate + ' Kc' : '-'}`,
          ]
        : []),
      `Termin odevzdani: ${input.deadline ?? '-'}`,
      `Preferovany herec: ${input.preferredNarrator ?? '-'}`,
      `Poznamka: ${input.note ?? '-'}`,
      '',
      'Ozveme se vam s potvrzenim terminu.',
      'Mediaspace / MS Portal',
    ].join('\n'),
    html: buildOrderConfirmationHtml(input),
  });

  return { sent: true as const };
}

// ---------------------------------------------------------------------------
// Zapomenute heslo (zadani 5. 9. 2026)
// ---------------------------------------------------------------------------

type PasswordResetInput = {
  to: string;
  name: string | null;
  resetUrl: string;
  expiresAt: Date;
};

export function buildPasswordResetHtml(input: PasswordResetInput): string {
  const greeting = escapeHtml(pozdrav(input.name));
  const expiresText = input.expiresAt.toLocaleString('cs-CZ', {
    timeZone: 'Europe/Prague',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return emailShell({
    tag: 'Obnovení hesla',
    preheader: 'Odkaz pro nastavení nového hesla do MS Portalu.',
    body: `
    <span class="badge">Nové heslo</span>
    <h2>Nastavení nového hesla</h2>
    <p>${greeting}</p>
    <p>někdo (snad vy) požádal o nové heslo k účtu <strong>${escapeHtml(input.to)}</strong> v MS Portalu.
       Nastavíte si ho tímto odkazem:</p>

    <div class="cta-row">
      <a href="${escapeHtml(input.resetUrl)}" class="cta">Nastavit nové heslo</a>
    </div>

    <p class="small">Odkaz platí do ${expiresText}. Pokud jste o nové heslo nežádali, nemusíte nic dělat -
       stávající heslo zůstává v platnosti a odkaz po uplynutí té doby přestane fungovat.</p>
  `,
  });
}

// ===========================================================================
// DOTOČENÝ HEREC (zadání 11. 9. 2026)
// ===========================================================================

type HerecDotocenInput = {
  prijemci: string[];
  jmenoHerce: string;
  nazevProjektu: string;
  nazevFirmy: string | null;
  /** Kdo to v portálu odškrtl. */
  potvrdil: string | null;
  odkazNaProjekt: string;
};

export function buildHerecDotocenHtml(input: HerecDotocenInput): string {
  return emailShell({
    tag: 'Dotočeno',
    preheader: `${input.jmenoHerce} dotočil ${input.nazevProjektu}.`,
    body: `
    <span class="badge">Dotočeno</span>
    <h2>${escapeHtml(input.jmenoHerce)} má dotočeno</h2>
    <table role="presentation" class="field-table">
      <tr><td class="label">Projekt</td><td class="value">${escapeHtml(input.nazevProjektu)}</td></tr>
      ${input.nazevFirmy ? `<tr><td class="label">Firma</td><td class="value regular">${escapeHtml(input.nazevFirmy)}</td></tr>` : ''}
      <tr><td class="label">Herec</td><td class="value">${escapeHtml(input.jmenoHerce)}</td></tr>
      ${input.potvrdil ? `<tr><td class="label">Odškrtl(a)</td><td class="value regular">${escapeHtml(input.potvrdil)}</td></tr>` : ''}
    </table>
    <div class="cta-row">
      <a href="${escapeHtml(input.odkazNaProjekt)}" class="cta">Otevřít projekt</a>
    </div>
    <p class="small">Tahle zpráva chodí každému, kdo má na kartě uživatele zaškrtnuté „Dostává zprávy o dotočení".</p>
`,
  });
}

export async function sendHerecDotocenEmail(input: HerecDotocenInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (input.prijemci.length === 0) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.prijemci.join(', '),
    subject: `Dotočeno - ${input.jmenoHerce} - ${input.nazevProjektu}`,
    text: [
      `${input.jmenoHerce} ma dotoceno.`,
      '',
      `Projekt: ${input.nazevProjektu}${input.nazevFirmy ? ` (${input.nazevFirmy})` : ''}`,
      input.potvrdil ? `Odskrtl(a): ${input.potvrdil}` : '',
      '',
      input.odkazNaProjekt,
    ]
      .filter(Boolean)
      .join('\n'),
    html: buildHerecDotocenHtml(input),
  });

  return { sent: true as const, reason: undefined };
}

// ---------------------------------------------------------------------------
// DOTOČENO — ZPRÁVA KLIENTOVI (zadání 16. 9. 2026)
//
// „Potřebuji mít možnost nastavit u konkrétních klientů, aby jim chodily
// notifikace o tom, že jsme dotočili s konkrétním hercem."
//
// Je to JINÝ mail než ten pro nás, ne tentýž s jiným příjemcem. Klientovi
// nic neříká, kdo to v portálu odškrtl, ani odkaz do detailu projektu — ten
// se mu stejně neotevře. Čte to jako zprávu od nás: s hercem jsme hotovi.
// ---------------------------------------------------------------------------

type HerecDotocenKlientoviInput = {
  to: string;
  /** Oslovení — jméno člověka u klienta. */
  jmenoKlienta: string | null;
  jmenoHerce: string;
  nazevProjektu: string;
  /** Kam v portálu klient kouká na svoje projekty. */
  odkazNaPortal: string;
};

/**
 * Věta o dotočení. Jméno herce jde do 7. pádu — „s Lubošem Ondráčkem"
 * (zadání 16. 9. 2026). Když se jméno skloňovat nedá (přezdívka, závorka,
 * cizí tvar), věta se o něj zkrátí; první pád uprostřed věty by byl horší
 * než žádné jméno.
 */
function vetaODotoceni(jmenoHerce: string): string {
  const sedmy = sedmyPad(jmenoHerce);
  return sedmy
    ? `právě jsme dokončili natáčení s ${sedmy}.`
    : 'právě jsme dokončili natáčení.';
}

export function buildHerecDotocenKlientoviHtml(input: HerecDotocenKlientoviInput): string {
  return emailShell({
    tag: 'Dotočeno',
    preheader: `${input.nazevProjektu} — dotočeno, ${input.jmenoHerce}.`,
    // KRATKÁ ZPRÁVA (zadání 16. 9. 2026: „zbytek pryč, jen nechat tlačítko
    // do portálu"). Pozdrav, jedna věta, tlačítko - nic víc. Název projektu
    // nese předmět mailu.
    body: `
    <p>${escapeHtml(pozdrav(input.jmenoKlienta))}</p>
    <p>${escapeHtml(vetaODotoceni(input.jmenoHerce))}</p>

    <div class="cta-row">
      <a href="${escapeHtml(input.odkazNaPortal)}" class="cta">Otevřít portál</a>
    </div>
`,
  });
}

export async function sendHerecDotocenKlientoviEmail(input: HerecDotocenKlientoviInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (!input.to) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: `Dotoceno - ${input.jmenoHerce} - ${input.nazevProjektu}`,
    text: [
      pozdrav(input.jmenoKlienta),
      '',
      vetaODotoceni(input.jmenoHerce),
      '',
      input.odkazNaPortal,
    ].join('\n'),
    html: buildHerecDotocenKlientoviHtml(input),
  });

  return { sent: true as const, reason: undefined };
}

export async function sendPasswordResetEmail(input: PasswordResetInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: 'Nové heslo do MS Portalu',
    text: [
      pozdrav(input.name),
      '',
      `nekdo pozadal o nove heslo k uctu ${input.to} v MS Portalu.`,
      'Nastavite si ho zde:',
      input.resetUrl,
      '',
      `Odkaz plati do ${input.expiresAt.toLocaleString('cs-CZ')}.`,
      'Pokud jste o nove heslo nezadali, nemusite nic delat.',
    ].join('\n'),
    html: buildPasswordResetHtml(input),
  });

  return { sent: true as const };
}


// ===========================================================================
// NABÍDKA (zadani 6. 9. 2026)
//
// Klient dostane mail s odkazem, kde nabídku uvidí a jedním tlačítkem ji
// schválí nebo odmítne - nikam se kvůli tomu nepřihlašuje.
// ===========================================================================

type OfferEmailInput = {
  to: string;
  contactName: string | null;
  companyName: string;
  issuerName: string;
  number: string;
  subject: string | null;
  currency: 'CZK' | 'EUR' | 'GBP';
  totalExVat: number; // v halerich/centech
  totalIncVat: number;
  validUntil: Date | null;
  offerUrl: string;
  /** Projekt, ke kteremu nabidka patri - jde do predmetu mailu. */
  projectName?: string | null;
  /** Manazer projektu: pod jeho jmenem (a pokud to jde, i adresou) mail odejde. */
  senderName?: string | null;
  senderEmail?: string | null;
  senderPhone?: string | null;
  /** Adresa fotky manazera (viz /api/nabidka/[token]/fotka). */
  senderPhotoUrl?: string | null;
};

const OFFER_CURRENCY_SYMBOL: Record<string, string> = { CZK: 'Kč', EUR: '€', GBP: '£' };

function formatOfferMoney(minor: number, currency: string): string {
  const value = minor / 100;
  const formatted = new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} ${OFFER_CURRENCY_SYMBOL[currency] ?? currency}`;
}

/**
 * PODPIS ČLOVĚKA POD NABÍDKOU (zadání 13. 9. 2026: „a co kdybychom to udělali
 * více osobní? Fotku manažera, jméno a kontakt. Abych to psal jako já").
 *
 * Nabídku domlouvá konkrétní člověk, ne systém - tak ať je pod ní podepsaný
 * i s tváří a telefonem. Styly jsou psané přímo u prvků: podpis se skládá
 * i v poštovních klientech, které si se stylopisem v hlavičce neporadí.
 *
 * Fotka je odkaz, ne příloha - poštovní klient si ji stáhne sám, a když ji
 * nestáhne (nebo manažer fotku nemá), zůstane jen jméno a kontakt.
 */
function podpisCloveka(input: OfferEmailInput): string {
  const jmeno = input.senderName?.trim();
  if (!jmeno) return '';

  const radky = [
    `<div style="font-weight:600;color:#201A33;">${escapeHtml(jmeno)}</div>`,
    '<div style="color:#6E6580;font-size:13px;">Mediaspace</div>',
    input.senderEmail
      ? `<div style="font-size:13px;"><a href="mailto:${escapeHtml(input.senderEmail)}" style="color:#6B2AF0;text-decoration:none;">${escapeHtml(input.senderEmail)}</a></div>`
      : '',
    input.senderPhone
      ? `<div style="font-size:13px;"><a href="tel:${escapeHtml(input.senderPhone.replace(/\s+/g, ''))}" style="color:#6E6580;text-decoration:none;">${escapeHtml(input.senderPhone)}</a></div>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  const fotka = input.senderPhotoUrl
    ? `<td style="padding-right:14px;vertical-align:top;width:64px;">
         <img src="${escapeHtml(input.senderPhotoUrl)}" width="64" height="64" alt="${escapeHtml(jmeno)}"
              style="display:block;width:64px;height:64px;border-radius:32px;object-fit:cover;" />
       </td>`
    : '';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
      <tr>
        ${fotka}
        <td style="vertical-align:top;font-family:Arial,Helvetica,sans-serif;line-height:1.45;">${radky}</td>
      </tr>
    </table>`;
}

export function buildOfferHtml(input: OfferEmailInput): string {
  /**
   * MAIL JE JEN POZVÁNKA (zadání 13. 9. 2026: „nic jiného už tam nebude,
   * detaily se zobrazí po otevření").
   *
   * Dřív nesl i rozpis cen a platnost. Jenže pak si klient udělal obrázek
   * z mailu a na stránku, kde se nabídka schvaluje, vůbec neklikl - a čísla
   * v mailu mezitím mohla zestárnout. Teď je v mailu jedna věta a tlačítko;
   * závazné je to, co je na stránce.
   */
  const nazev = input.projectName?.trim() || input.subject?.trim() || input.number;

  return emailShell({
    tag: 'Nabídka',
    preheader: `Nabídka pro projekt ${nazev}.`,
    body: `
    <p>Dobrý den,</p>
    <p>posílám nabídku pro projekt <strong>${escapeHtml(nazev)}</strong>.</p>

    <div class="cta-row">
      <a href="${escapeHtml(input.offerUrl)}" class="cta">Zobrazit nabídku</a>
    </div>

    ${podpisCloveka(input)}
  `,
  });
}

export async function sendOfferEmail(input: OfferEmailInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  // Predmet mailu pojmenovava projekt, ne cislo dokladu (zadani 13. 9. 2026:
  // „Predmet: Cenova nabidka - (nazev projektu)"). Kdyz nabidka na projekt
  // navazana neni, zaskoci predmet nabidky a az nakonec jeji cislo.
  const nazevVPredmetu = input.projectName?.trim() || input.subject?.trim() || input.number;
  const obalka = odesilatelMediaspace(input.senderEmail);

  const zprava = {
    ...obalka,
    to: input.to,
    subject: `Cenová nabídka - ${nazevVPredmetu}`,
    text: [
      'Dobry den,',
      '',
      `posilam nabidku pro projekt ${nazevVPredmetu}.`,
      '',
      input.offerUrl,
      '',
      input.senderName || input.issuerName,
      'Mediaspace',
      input.senderEmail,
      input.senderPhone,
    ]
      .filter((radek) => radek !== null && radek !== undefined)
      .join('\n'),
    html: buildOfferHtml(input),
  };

  await transport.sendMail(zprava);

  return { sent: true as const };
}


// ===========================================================================
// FAKTURA (zadani 6. 9. 2026)
//
// Mail nese vše, co odběratel potřebuje k zaplacení - částku, účet,
// variabilní symbol a splatnost.
// ===========================================================================

type InvoiceEmailInput = {
  to: string;
  /** Kopie - typicky klient projektu vedle účtárny odběratele (13. 9. 2026). */
  cc?: string[];
  contactName: string | null;
  companyName: string;
  issuerName: string;
  number: string;
  subject: string | null;
  currency: 'CZK' | 'EUR' | 'GBP';
  totalExVat: number;
  totalIncVat: number;
  dueDate: Date | null;
  variableSymbol: string;
  accountLabel: string;
  accountNumber: string | null;
  iban: string | null;
  /** Faktura v PDF - jde do přílohy a nese QR platbu (zadání 13. 9. 2026). */
  pdf?: { nazev: string; obsah: Buffer } | null;
  /**
   * Rodný list spotu (zadání 15. 9. 2026: „když pošleme fakturu klientovi,
   * tak automaticky s tím odeslal i rodný list"). Jen u rádiových spotů —
   * u ostatních projektů žádný rodný list neexistuje.
   */
  rodnyList?: { nazev: string; obsah: Buffer } | null;
};

export function buildInvoiceHtml(input: InvoiceEmailInput): string {
  const greeting = escapeHtml(pozdrav(input.contactName));
  const dueText = input.dueDate ? input.dueDate.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' }) : null;
  const account = [input.accountNumber, input.iban].filter(Boolean).join(' · ');

  return emailShell({
    tag: 'Faktura',
    preheader: `Faktura ${input.number} od ${input.issuerName}.`,
    body: `
    <span class="badge">Faktura ${escapeHtml(input.number)}</span>
    <h2>${input.subject ? escapeHtml(input.subject) : 'Faktura k úhradě'}</h2>
    <p>${greeting}</p>
    <p>posíláme fakturu pro <strong>${escapeHtml(input.companyName)}</strong>.</p>

    <table role="presentation" class="field-table">
      <tr><td class="label">Číslo faktury</td><td class="value">${escapeHtml(input.number)}</td></tr>
      <tr><td class="label">Částka bez DPH</td><td class="value regular">${escapeHtml(formatOfferMoney(input.totalExVat, input.currency))}</td></tr>
      <tr><td class="label">K úhradě</td><td class="value">${escapeHtml(formatOfferMoney(input.totalIncVat, input.currency))}</td></tr>
      ${dueText ? `<tr><td class="label">Splatnost</td><td class="value">${escapeHtml(dueText)}</td></tr>` : ''}
      <tr><td class="label">Bankovní účet</td><td class="value regular">${escapeHtml(account || input.accountLabel)}</td></tr>
      <tr><td class="label">Variabilní symbol</td><td class="value">${escapeHtml(input.variableSymbol)}</td></tr>
    </table>

    ${input.pdf ? '<p class="small">Fakturu posíláme i v příloze — je na ní QR kód, kterým se platba v bankovní aplikaci vyplní sama.</p>' : ''}
    ${input.rodnyList ? '<p class="small">V příloze je i rodný list spotu.</p>' : ''}

    <p class="small">Kdyby cokoliv nesedělo, stačí na tento e-mail odpovědět.</p>
    <p class="small">${escapeHtml(input.issuerName)}</p>
  `,
  });
}

export async function sendInvoiceEmail(input: InvoiceEmailInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  // Fakturu posila FIRMA, ne clovek (zadani 13. 9. 2026: „fakturu pak uz za
  // Mediaspace") - je to ucetni doklad, ne domluva mezi dvema lidmi.
  const zprava = {
    ...odesilatelMediaspace(ODPOVED_UCTARNA),
    to: input.to,
    // Kopie schvalne v Cc, ne skryta: ucetni i clovek od projektu maji o sobe
    // vedet, at si fakturu nepreposilaji dokola.
    ...(input.cc?.length ? { cc: input.cc } : {}),
    subject: `Faktura ${input.number}${input.subject ? ` — ${input.subject}` : ''}`,
    text: [
      pozdrav(input.contactName),
      '',
      `posilame fakturu ${input.number} pro ${input.companyName}.`,
      `K uhrade: ${formatOfferMoney(input.totalIncVat, input.currency)}`,
      input.dueDate ? `Splatnost: ${input.dueDate.toLocaleDateString('cs-CZ')}` : '',
      `Bankovni ucet: ${[input.accountNumber, input.iban].filter(Boolean).join(' / ') || input.accountLabel}`,
      `Variabilni symbol: ${input.variableSymbol}`,
      input.pdf ? 'Fakturu posilame i v priloze, je na ni QR kod k platbe.' : '',
      input.rodnyList ? 'V priloze je i rodny list spotu.' : '',
      '',
      input.issuerName,
    ]
      .filter(Boolean)
      .join('\n'),
    html: buildInvoiceHtml(input),
    ...(() => {
      const prilohy = [
        input.pdf ? { filename: input.pdf.nazev, content: input.pdf.obsah } : null,
        input.rodnyList ? { filename: input.rodnyList.nazev, content: input.rodnyList.obsah } : null,
      ].filter((p): p is { filename: string; content: Buffer } => p !== null);
      return prilohy.length ? { attachments: prilohy } : {};
    })(),
  };

  await transport.sendMail(zprava);

  return { sent: true as const };
}


// ===========================================================================
// SMLOUVA K PODPISU (zadani 8. 9. 2026)
//
// Odkaz v mailu JE overeni totoznosti - zadny SMS kod se nikde nezadava.
// Proto je v mailu vyslovne napsane, ze odkaz patri jen adresatovi.
// ===========================================================================

type ContractEmailInput = {
  to: string;
  signerName: string;
  issuerName: string;
  number: string;
  title: string;
  projectName: string | null;
  alreadySignedByUs: boolean;
  contractUrl: string;
};

export function buildContractHtml(input: ContractEmailInput): string {
  return emailShell({
    tag: 'Smlouva k podpisu',
    preheader: `Smlouva ${input.number} od ${input.issuerName} čeká na váš podpis.`,
    body: `
    <span class="badge">Smlouva ${escapeHtml(input.number)}</span>
    <h2>${escapeHtml(input.title)}</h2>
    <p>${escapeHtml(pozdrav(input.signerName))}</p>
    <p>posíláme vám k podpisu smlouvu se společností <strong>${escapeHtml(input.issuerName)}</strong>.
       Otevřete ji odkazem níže, přečtěte si ji a podepište se rovnou v prohlížeči — myší nebo
       prstem na mobilu. Nemusíte se nikam přihlašovat ani opisovat žádný kód.</p>

    <table role="presentation" class="field-table">
      <tr><td class="label">Číslo smlouvy</td><td class="value">${escapeHtml(input.number)}</td></tr>
      ${input.projectName ? `<tr><td class="label">Projekt</td><td class="value regular">${escapeHtml(input.projectName)}</td></tr>` : ''}
      <tr><td class="label">Druhá strana</td><td class="value regular">${escapeHtml(input.issuerName)}</td></tr>
      ${input.alreadySignedByUs ? '<tr><td class="label">Stav</td><td class="value regular">Za nás už je podepsaná</td></tr>' : ''}
    </table>

    <div class="cta-row">
      <a href="${escapeHtml(input.contractUrl)}" class="cta">Otevřít a podepsat smlouvu</a>
    </div>

    <p class="small">Tenhle odkaz je váš podpisový klíč — nesdílejte ho prosím dál. K podpisu se
       uloží čas, IP adresa a otisk textu, který jste měli před sebou. Kdyby vám ve smlouvě něco
       nesedělo, stačí na tento e-mail odpovědět nebo podpis přímo na stránce odmítnout.</p>
  `,
  });
}

export async function sendContractEmail(input: ContractEmailInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: `Smlouva ${input.number} k podpisu — ${input.title}`,
    text: [
      pozdrav(input.signerName),
      '',
      `posilame vam k podpisu smlouvu ${input.number} se spolecnosti ${input.issuerName}.`,
      input.projectName ? `Projekt: ${input.projectName}` : '',
      '',
      'Smlouvu si otevrete a podepisete zde:',
      input.contractUrl,
      '',
      'Odkaz je urceny jen vam - nesdilejte ho dal.',
      '',
      input.issuerName,
    ]
      .filter(Boolean)
      .join('\n'),
    html: buildContractHtml(input),
  });

  return { sent: true as const };
}


// ===========================================================================
// PODEPSANA SMLOUVA (zadani 14. 9. 2026: „u podepsanych smluv oboji. Odkaz
// i pdf")
//
// Odchazi ve chvili, kdy podepsou OBE strany - protistrane i nam. Odkaz vede
// na tutez stranku, kde se podepisovalo, a v priloze je PDF, aby se smlouva
// dala zalozit do slozky zakazky a do ucetnictvi bez toho, aby si ji nekdo
// musel stahovat z webu.
// ===========================================================================

type PodepsanaSmlouvaInput = {
  prijemci: string[];
  /** Nase adresy do skryte kopie - klient nema videt, kdo vsechno u nas o smlouve vi. */
  skrytaKopie?: string[];
  /** Komu je zprava adresovana (osloveni). Kdyz jde vic lidem, nechat prazdne. */
  jmenoPrijemce: string | null;
  number: string;
  title: string;
  issuerName: string;
  projectName: string | null;
  podepsali: { role: string; name: string; signedAt: Date }[];
  contractUrl: string;
  pdf: { nazev: string; obsah: Buffer } | null;
};

function podpisRadek(p: { role: string; name: string; signedAt: Date }): string {
  const kdy = new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  }).format(p.signedAt);
  return `${p.name} (${kdy})`;
}

export function buildPodepsanaSmlouvaHtml(input: PodepsanaSmlouvaInput): string {
  const nase = input.podepsali.find((p) => p.role === 'MEDIASPACE') ?? null;
  const protistrana = input.podepsali.find((p) => p.role === 'PROTISTRANA') ?? null;

  return emailShell({
    tag: `Podepsaná smlouva ${input.number}`,
    preheader: `Smlouva ${input.number} je podepsaná oběma stranami.`,
    body: `
    <span class="badge">Smlouva ${escapeHtml(input.number)}</span>
    <h2>${escapeHtml(input.title)}</h2>
    <p>${escapeHtml(pozdrav(input.jmenoPrijemce))}</p>
    <p>smlouva je podepsaná oběma stranami. Kompletní znění i s podpisy máte
       <strong>v příloze jako PDF</strong>; odkazem níž se k ní kdykoliv dostanete i online.</p>

    <table role="presentation" class="field-table">
      <tr><td class="label">Číslo smlouvy</td><td class="value">${escapeHtml(input.number)}</td></tr>
      ${input.projectName ? `<tr><td class="label">Projekt</td><td class="value regular">${escapeHtml(input.projectName)}</td></tr>` : ''}
      ${nase ? `<tr><td class="label">Za ${escapeHtml(input.issuerName)}</td><td class="value regular">${escapeHtml(podpisRadek(nase))}</td></tr>` : ''}
      ${protistrana ? `<tr><td class="label">Za protistranu</td><td class="value regular">${escapeHtml(podpisRadek(protistrana))}</td></tr>` : ''}
    </table>

    <div class="cta-row">
      <a href="${escapeHtml(input.contractUrl)}" class="cta">Otevřít podepsanou smlouvu</a>
    </div>

    <p class="small">U každého podpisu je uložený čas, IP adresa a otisk textu, který měl
       podepisující před sebou — podle něj je poznat, že se smlouva od podpisu nezměnila.</p>
  `,
  });
}

export async function sendPodepsanaSmlouvaEmail(input: PodepsanaSmlouvaInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (input.prijemci.length === 0) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };

  const skryta = (input.skrytaKopie ?? []).filter((e) => !input.prijemci.includes(e));

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.prijemci.join(', '),
    bcc: skryta.length > 0 ? skryta.join(', ') : undefined,
    subject: `Podepsaná smlouva ${input.number} — ${input.title}`,
    text: [
      pozdrav(input.jmenoPrijemce),
      '',
      `smlouva ${input.number} je podepsana obema stranami.`,
      input.projectName ? `Projekt: ${input.projectName}` : '',
      ...input.podepsali.map((p) => `Podepsal: ${podpisRadek(p)}`),
      '',
      'Kompletni zneni je v priloze jako PDF. Online ji najdete zde:',
      input.contractUrl,
      '',
      input.issuerName,
    ]
      .filter(Boolean)
      .join('\n'),
    html: buildPodepsanaSmlouvaHtml(input),
    ...(input.pdf ? { attachments: [{ filename: input.pdf.nazev, content: input.pdf.obsah }] } : {}),
  });

  return { sent: true as const, reason: undefined };
}


// ===========================================================================
// SCHVALENY BONUS ZVUKARI (zadani 15. 9. 2026: „mela by tomu danemu zvukari
// prijit notifikace, ze bonus byl schvalen")
//
// Kratka zprava - je to dobra zprava, ne dokument. Podstatne je, ZA CO to je
// a KOLIK to je; zbytek najde ve Vykazech. Od 15. 9. 2026 bez osloveni a bez
// uvodni vety - zustava jen tabulka s udaji.
// ===========================================================================

type BonusEmailInput = {
  to: string;
  projekt: string;
  castka: string;
  /** Podil na strihu v procentech; 0 = bonus pridany rucne. */
  podilProcent: number;
  /** Za co - u rucne pridaneho bonusu to je jedina vysvetlujici veta. */
  poznamka: string | null;
  schvalil: string | null;
  odkaz: string;
};

export function buildBonusHtml(input: BonusEmailInput): string {
  /**
   * BEZ OSLOVENÍ A BEZ ÚVODNÍ VĚTY (zadání 15. 9. 2026: „dejme pryč tu
   * zprávu: Dobrý den, Richarde… Nechme tam jen tu tabulku").
   *
   * Všechno podstatné je proto v tabulce - i důvod, který dřív stál v textu
   * pod ní: u návrhu podíl na střihu, u ručně přidaného bonusu to, co k němu
   * někdo napsal.
   */
  const radky = [
    `<tr><td class="label">Bonus</td><td class="value">${escapeHtml(input.castka)}</td></tr>`,
    `<tr><td class="label">Kniha</td><td class="value regular">${escapeHtml(input.projekt)}</td></tr>`,
    input.podilProcent > 0
      ? `<tr><td class="label">Podíl na střihu</td><td class="value regular">${input.podilProcent} %</td></tr>`
      : '',
    input.poznamka
      ? `<tr><td class="label">Za co</td><td class="value regular">${escapeHtml(input.poznamka)}</td></tr>`
      : '',
    input.schvalil
      ? `<tr><td class="label">Schválil(a)</td><td class="value regular">${escapeHtml(input.schvalil)}</td></tr>`
      : '',
  ].filter(Boolean);

  return emailShell({
    tag: 'Schválený bonus',
    preheader: `${input.projekt}: bonus ${input.castka} je schválený.`,
    body: `
    <span class="badge">Bonus</span>
    <h2>${escapeHtml(input.projekt)}</h2>

    <table role="presentation" class="field-table">
      ${radky.join('\n      ')}
    </table>

    <div class="cta-row">
      <a href="${escapeHtml(input.odkaz)}" class="cta">Otevřít ve Výkazech</a>
    </div>

    <p class="small">Bonus je jednorázová odměna nad rámec výkazu — do odpracovaných hodin se
       nezapočítává a proti rozpočtu projektu nestojí.</p>
  `,
  });
}

export async function sendBonusEmail(input: BonusEmailInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: `Schválený bonus — ${input.projekt}`,
    // Prosty text drzi krok s HTML - taky bez osloveni, jen udaje.
    text: [
      `Bonus: ${input.castka}`,
      `Kniha: ${input.projekt}`,
      input.podilProcent > 0 ? `Podil na strihu: ${input.podilProcent} %` : '',
      input.poznamka ? `Za co: ${input.poznamka}` : '',
      input.schvalil ? `Schvalil(a): ${input.schvalil}` : '',
      '',
      'Ve Vykazech ho najdete tady:',
      input.odkaz,
    ]
      .filter(Boolean)
      .join('\n'),
    html: buildBonusHtml(input),
  });

  return { sent: true as const };
}


// ===========================================================================
// MESICNI PREHLED VYKAZU (zadani 15. 9. 2026: „jednou za mesic prijde
// notifikace s prehledem vykazu za minuly mesic zvukari na mail")
//
// Neni to vyzva k akci, je to vypis - proto tabulky a zadne velke tlacitko
// navic krome odkazu do Vykazu, kdyby chtel videt jednotlive dny.
// ===========================================================================

type MesicniPrehledInput = {
  to: string;
  /** „Srpen 2026". */
  mesic: string;
  hodiny: string;
  /** Castka za odpracovanou praci. */
  castka: string;
  /** Castka vcetne bonusu. */
  celkem: string;
  druhy: { nazev: string; hodiny: string; castka: string }[];
  projekty: { nazev: string; hodiny: string }[];
  bonusy: { nazev: string; castka: string }[];
  /** Null, kdyz v mesici zadny bonus nebyl. */
  bonusCelkem: string | null;
  odkaz: string;
};

export function buildMesicniPrehledHtml(input: MesicniPrehledInput): string {
  const radekDruhu = (d: { nazev: string; hodiny: string; castka: string }) =>
    `<tr><td class="label">${escapeHtml(d.nazev)}</td><td class="value regular">${escapeHtml(d.hodiny)} · ${escapeHtml(d.castka)}</td></tr>`;

  const projekty = input.projekty.length
    ? `<table role="presentation" class="field-table">
      ${input.projekty
        .map(
          (p) =>
            `<tr><td class="label">${escapeHtml(p.nazev)}</td><td class="value regular">${escapeHtml(p.hodiny)}</td></tr>`,
        )
        .join('\n      ')}
    </table>`
    : '';

  const bonusy = input.bonusCelkem
    ? `<h3 style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#6B2AF0;margin:22px 0 8px;">Bonusy</h3>
    <table role="presentation" class="field-table">
      ${input.bonusy
        .map(
          (b) =>
            `<tr><td class="label">${escapeHtml(b.nazev)}</td><td class="value">${escapeHtml(b.castka)}</td></tr>`,
        )
        .join('\n      ')}
    </table>`
    : '';

  return emailShell({
    tag: `Přehled výkazů · ${input.mesic}`,
    preheader: `${input.mesic}: ${input.hodiny}, ${input.celkem}.`,
    body: `
    <span class="badge">${escapeHtml(input.mesic)}</span>
    <h2>${escapeHtml(input.hodiny)} · ${escapeHtml(input.celkem)}</h2>

    <table role="presentation" class="field-table">
      <tr><td class="label">Odpracováno</td><td class="value">${escapeHtml(input.hodiny)}</td></tr>
      <tr><td class="label">Za práci</td><td class="value">${escapeHtml(input.castka)}</td></tr>
      ${input.bonusCelkem ? `<tr><td class="label">Bonusy</td><td class="value">${escapeHtml(input.bonusCelkem)}</td></tr>` : ''}
      <tr><td class="label">Celkem</td><td class="value">${escapeHtml(input.celkem)}</td></tr>
    </table>

    <h3 style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#6B2AF0;margin:22px 0 8px;">Podle druhu práce</h3>
    <table role="presentation" class="field-table">
      ${input.druhy.map(radekDruhu).join('\n      ')}
    </table>

    ${input.projekty.length ? '<h3 style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#6B2AF0;margin:22px 0 8px;">Projekty</h3>' : ''}
    ${projekty}

    ${bonusy}

    <div class="cta-row">
      <a href="${escapeHtml(input.odkaz)}" class="cta">Otevřít výkazy</a>
    </div>

    <p class="small">Přehled chodí vždycky šestého za měsíc minulý. Když v něm něco nesedí, výkaz
       se dá opravit ve Výkazech — a napište nám, ať to víme.</p>
  `,
  });
}

export async function sendMesicniPrehledEmail(input: MesicniPrehledInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: `Přehled výkazů — ${input.mesic}`,
    text: [
      `Prehled vykazu za ${input.mesic}`,
      '',
      `Odpracovano: ${input.hodiny}`,
      `Za praci: ${input.castka}`,
      input.bonusCelkem ? `Bonusy: ${input.bonusCelkem}` : '',
      `Celkem: ${input.celkem}`,
      '',
      'Podle druhu prace:',
      ...input.druhy.map((d) => `  ${d.nazev}: ${d.hodiny} · ${d.castka}`),
      input.projekty.length ? '' : '',
      input.projekty.length ? 'Projekty:' : '',
      ...input.projekty.map((p) => `  ${p.nazev}: ${p.hodiny}`),
      input.bonusy.length ? '' : '',
      input.bonusy.length ? 'Bonusy:' : '',
      ...input.bonusy.map((b) => `  ${b.nazev}: ${b.castka}`),
      '',
      'Jednotlive dny najdete tady:',
      input.odkaz,
    ]
      .filter((r) => r !== '')
      .join('\n'),
    html: buildMesicniPrehledHtml(input),
  });

  return { sent: true as const };
}


// ===========================================================================
// NABIDKA NATACECICH TERMINU (zadani 8. 9. 2026)
//
// Herec dostane odkaz s jednorazovym tokenem - vybere si terminy bez
// prihlasovani. Odkaz je zaroven overeni, ze je to on, proto je v mailu
// napsane, ze ho nema posilat dal.
// ===========================================================================

type RecordingOfferEmailInput = {
  to: string;
  actorName: string;
  projectName: string;
  studioName: string;
  requiredSessions: number;
  offeredCount: number;
  periodFrom: Date;
  periodTo: Date;
  note: string | null;
  offerUrl: string;
};

function pocetTerminu(n: number): string {
  if (n === 1) return '1 termín';
  if (n < 5) return `${n} termíny`;
  return `${n} termínů`;
}

export function buildRecordingOfferHtml(input: RecordingOfferEmailInput): string {
  const obdobi = `${input.periodFrom.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' })} – ${input.periodTo.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' })}`;
  return emailShell({
    tag: 'Natáčecí termíny',
    preheader: `Vyberte si ${pocetTerminu(input.requiredSessions)} pro projekt ${input.projectName}.`,
    body: `
    <span class="badge">Výběr termínů</span>
    <h2>${escapeHtml(input.projectName)}</h2>
    <p>${escapeHtml(pozdrav(input.actorName))}</p>
    <p>máme pro vás připravené termíny natáčení. Otevřete odkaz níže a vyberte si
       <strong>${escapeHtml(pocetTerminu(input.requiredSessions))}</strong>, které vám sedí —
       přihlašovat se nemusíte.</p>

    <table role="presentation" class="field-table">
      <tr><td class="label">Projekt</td><td class="value">${escapeHtml(input.projectName)}</td></tr>
      <tr><td class="label">Studio</td><td class="value regular">${escapeHtml(input.studioName)}</td></tr>
      <tr><td class="label">Období</td><td class="value regular">${escapeHtml(obdobi)}</td></tr>
      <tr><td class="label">Vyberte</td><td class="value">${escapeHtml(pocetTerminu(input.requiredSessions))} z ${input.offeredCount} nabídnutých</td></tr>
    </table>

    ${input.note ? `<p class="small"><strong>Poznámka produkce:</strong> ${escapeHtml(input.note)}</p>` : ''}

    <div class="cta-row">
      <a href="${escapeHtml(input.offerUrl)}" class="cta">Vybrat termíny</a>
    </div>

    <p class="small">Odkaz je určený jen vám — nesdílejte ho prosím dál. Kdyby vám žádný
       z termínů nevyhovoval, stačí na tento e-mail odpovědět.</p>
  `,
  });
}

export async function sendRecordingOfferEmail(input: RecordingOfferEmailInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: `Výběr natáčecích termínů — ${input.projectName}`,
    text: [
      pozdrav(input.actorName),
      '',
      `mame pro vas pripravene terminy nataceni projektu ${input.projectName}.`,
      `Studio: ${input.studioName}`,
      `Vyberte si ${input.requiredSessions} terminu z ${input.offeredCount} nabidnutych.`,
      input.note ? `Poznamka produkce: ${input.note}` : '',
      '',
      'Vyber terminu:',
      input.offerUrl,
      '',
      'Odkaz je urceny jen vam - nesdilejte ho dal.',
    ]
      .filter(Boolean)
      .join('\n'),
    html: buildRecordingOfferHtml(input),
  });

  return { sent: true as const };
}


// ===========================================================================
// ROZHODNUTI O VYBERU TERMINU (zadani 8. 9. 2026)
//
// Herec se musi dozvedet, jak jeho vyber dopadl - potvrzeno, vraceno
// k prepracovani, nebo zamitnuto.
// ===========================================================================

type RecordingDecisionEmailInput = {
  to: string;
  actorName: string;
  projectName: string;
  studioName: string;
  decision: 'CONFIRMED' | 'RETURNED' | 'REJECTED';
  note: string | null;
  /** Potvrzene terminy, uz naformatovane ("pondělí 14. 9. · 9:00–13:00"). */
  slots: string[];
  offerUrl: string;
};

const DECISION_TEXTS: Record<string, { tag: string; nadpis: string; uvod: string }> = {
  CONFIRMED: {
    tag: 'Termíny potvrzeny',
    nadpis: 'Termíny jsou potvrzené',
    uvod: 'vaše termíny jsou potvrzené — těšíme se na vás ve studiu.',
  },
  RETURNED: {
    tag: 'Prosíme o nový výběr',
    nadpis: 'Prosíme o nový výběr termínů',
    uvod: 'potřebovali bychom váš výběr ještě jednou upravit.',
  },
  REJECTED: {
    tag: 'Výběr zamítnut',
    nadpis: 'Výběr termínů zamítnut',
    uvod: 'váš výběr termínů se bohužel nepodařilo potvrdit.',
  },
};

export function buildRecordingDecisionHtml(input: RecordingDecisionEmailInput): string {
  const t = DECISION_TEXTS[input.decision];
  const seznam = input.slots.length
    ? `<table role="presentation" class="field-table">${input.slots
        .map((s) => `<tr><td class="label">Termín</td><td class="value">${escapeHtml(s)}</td></tr>`)
        .join('')}</table>`
    : '';

  return emailShell({
    tag: t.tag,
    preheader: `${t.nadpis} — ${input.projectName}.`,
    body: `
    <span class="badge">${escapeHtml(input.projectName)}</span>
    <h2>${escapeHtml(t.nadpis)}</h2>
    <p>${escapeHtml(pozdrav(input.actorName))}</p>
    <p>${escapeHtml(t.uvod)}</p>
    ${seznam}
    ${input.note ? `<p class="small"><strong>Vzkaz produkce:</strong> ${escapeHtml(input.note)}</p>` : ''}
    <p class="small">Studio: ${escapeHtml(input.studioName)}</p>
    ${
      input.decision === 'RETURNED'
        ? `<div class="cta-row"><a href="${escapeHtml(input.offerUrl)}" class="cta">Vybrat termíny znovu</a></div>`
        : `<div class="cta-row"><a href="${escapeHtml(input.offerUrl)}" class="cta">Zobrazit termíny</a></div>`
    }
  `,
  });
}

export async function sendRecordingDecisionEmail(input: RecordingDecisionEmailInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  const t = DECISION_TEXTS[input.decision];
  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: `${t.nadpis} — ${input.projectName}`,
    text: [
      pozdrav(input.actorName),
      '',
      t.uvod,
      ...input.slots.map((s) => `- ${s}`),
      input.note ? `Vzkaz produkce: ${input.note}` : '',
      `Studio: ${input.studioName}`,
      '',
      input.offerUrl,
    ]
      .filter(Boolean)
      .join('\n'),
    html: buildRecordingDecisionHtml(input),
  });

  return { sent: true as const };
}


// ===========================================================================
// RODNY LIST REKLAMNIHO SPOTU (zadani 9. 9. 2026)
//
// Odchazi klientovi ve chvili, kdy projekt prejde do stavu "Dokonceno - ke
// schvaleni" a Rodny list se UZ USPESNE vyrobil. Kdyz se dokument nepodari
// vytvorit, tenhle e-mail se zamerne neposila - projekt se misto toho oznaci
// jako vyzadujici kontrolu (viz lib/rodnyListServer.ts).
// ===========================================================================

type RodnyListEmailInput = {
  to: string;
  recipientName: string;
  projectName: string;
  statusName: string;
  rodnyListUrl: string;
  recordingsUrl: string;
};

export function buildRodnyListHtml(input: RodnyListEmailInput): string {
  return emailShell({
    tag: 'Projekt ke schválení',
    preheader: `${input.projectName} je hotový — nahrávky i rodný list jsou připravené.`,
    body: `
    <span class="badge">${escapeHtml(input.statusName)}</span>
    <h2>${escapeHtml(input.projectName)}</h2>
    <p>${escapeHtml(pozdrav(input.recipientName))}</p>
    <p>spot máme hotový. Projekt je ve stavu <strong>${escapeHtml(input.statusName)}</strong> —
       nahrávky jsou připravené a spolu s nimi posíláme i <strong>rodný list</strong> spotu
       s údaji o délce, režii a použité hudbě.</p>

    <table role="presentation" class="field-table">
      <tr><td class="label">Projekt</td><td class="value">${escapeHtml(input.projectName)}</td></tr>
      <tr><td class="label">Stav</td><td class="value regular">${escapeHtml(input.statusName)}</td></tr>
    </table>

    <div class="cta-row">
      <a href="${escapeHtml(input.rodnyListUrl)}" class="cta">Otevřít rodný list (PDF)</a>
    </div>

    <div class="cta-row">
      <a href="${escapeHtml(input.recordingsUrl)}" class="cta-dark">Přejít na nahrávky →</a>
    </div>

    <p class="small">Kdyby vám v rodném listu nebo v nahrávkách cokoliv nesedělo, stačí na tenhle
       e-mail odpovědět — rádi to opravíme.</p>
  `,
  });
}

export async function sendRodnyListEmail(input: RodnyListEmailInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: `${input.projectName} — hotovo, ke schválení`,
    text: [
      pozdrav(input.recipientName),
      '',
      `spot ${input.projectName} mame hotovy - projekt je ve stavu "${input.statusName}".`,
      '',
      'Rodny list spotu (PDF):',
      input.rodnyListUrl,
      '',
      'Pripravene nahravky:',
      input.recordingsUrl,
      '',
      'Mediaspace',
    ].join('\n'),
    html: buildRodnyListHtml(input),
  });

  return { sent: true as const };
}
// ===========================================================================
// ZPRÁVA O ZMĚNĚ STAVU PROJEKTU (zadání 10. 9. 2026)
//
// Chodí klientovi, když projekt přejde do stavu, který má firma zapnutý
// (karta firmy → Notifikace). Nese jedno tlačítko - odkaz do NAŠICH Nahrávek
// v portálu (zadání 10. 9. 2026), ne na Google Disk.
// Druhé tlačítko (Audiotagger) přibude, až bude kam odkazovat.
// ===========================================================================

export type StavProjektuInput = {
  prijemci: string[];
  /**
   * Naše adresy do SKRYTÉ kopie (zadání 11. 9. 2026: „je tam i u klienta
   * v mailu, že to jde na nás v kopii, nemůžeme tam být vidět, kdyžtak to
   * musí být ve skryté kopii").
   *
   * Klient nemá vidět, kdo všechno u nás o jeho projektu ví — a hlavně: když
   * na zprávu odpoví „všem", nemá odpověď chodit celé produkci.
   */
  skrytaKopie?: string[];
  /** Zpráva jen pro nás - klient ji nedostane, tak ať to je v mailu vidět. */
  jenInterne: boolean;
  jmenoKlienta: string | null;
  nazevProjektu: string;
  /**
   * Ve zpravé samotné uz nefiguruje (zadání 11. 9. 2026: „dejme tam jen název
   * titulu, ne firmu") — klient svoji firmu zná. Zůstává kvůli proměnné
   * {firma} ve vzoru, kterou si tam produkce může dát sama.
   */
  nazevFirmy: string;
  stav: string;
  /** Věta, co se v tomhle stavu klientovi říká. */
  text: string;
  odkazNaDisk: string | null;
  /**
   * Popisek tlačítka na složku (zadání 14. 9. 2026 - reklamy se formulují
   * jinak než audioknihy). Prázdné = „Stáhnout nahrávky ze složky", jak to
   * chodilo doteď.
   */
  popisekOdkazu?: string | null;
  /**
   * Druhé tlačítko — celoobrazovkový AudioTagger (zadání 11. 9. 2026).
   * Posílá se jen u zprávy o prvních tracích; jindy zůstává prázdné.
   */
  odkazNaPreposlech?: string | null;
  /**
   * Věta navíc nad textem ze vzoru - píše se ručně u konkrétního odeslání
   * (zadání 11. 9. 2026: „popošli to rovnou jen na Radku a omluv se").
   * Vzor zůstává nedotčený, tohle platí jen pro tuhle jednu zprávu.
   */
  uvod?: string | null;
  /** Předmět mailu ze vzoru; prázdné = „{projekt} - {stav}". */
  predmet?: string | null;
  /**
   * Velký nadpis nad textem (zadání 11. 9. 2026). Prázdný = zpráva nadpis
   * nemá, jak to bylo do té doby — vzor s prázdným nadpisem tedy vypadá
   * přesně jako dřív.
   */
  nadpis?: string | null;
};

export function buildStavProjektuHtml(input: StavProjektuInput): string {
  /**
   * Dvě výrazná tlačítka (zadání 11. 9. 2026). Zelené je to hlavní —
   * přeposlech v AudioTaggeru; tmavé vede do složky projektu. Když
   * AudioTagger po ruce není, zůstane jen složka a ta je pak ta hlavní.
   *
   * POŘADÍ JE ZÁMĚR (zadání 12. 9. 2026: „audiotagger je pro nás lepší
   * a budeme se ho snažit prodat"). Chvíli to bylo obráceně, protože
   * padlo, že je AudioTagger zatím jen alternativa — není.
   *
   * Třídy `cta` a `cta-dark` jsou definované v emailShell. (Dřív tu bylo
   * `class="btn"`, které ve stylopisu nikdy nebylo, takže se tlačítko
   * posílalo jako obyčejný odkaz.)
   */
  const tlacitka: string[] = [];
  if (input.odkazNaPreposlech) {
    tlacitka.push(
      `<a href="${escapeHtml(input.odkazNaPreposlech)}" class="cta">Přeposlechnout v AudioTaggeru</a>`,
    );
  }
  if (input.odkazNaDisk) {
    tlacitka.push(
      `<a href="${escapeHtml(input.odkazNaDisk)}" class="${
        input.odkazNaPreposlech ? 'cta-dark' : 'cta'
      }">${escapeHtml(input.popisekOdkazu?.trim() || 'Stáhnout nahrávky ze složky')}</a>`,
    );
  }
  // Kazde tlacitko na svem radku - na telefonu by se vedle sebe nevesla.
  const tlacitko = tlacitka.length
    ? `<table role="presentation">${tlacitka
        .map((odkaz) => `<tr><td style="padding-bottom:10px;">${odkaz}</td></tr>`)
        .join('')}</table>`
    : '<p style="color:#6C6580;">Odkaz na složku zatím u projektu není vyplněný.</p>';

  const interniPoznamka = input.jenInterne
    ? '<p style="background:#F3EEFF;border-radius:10px;padding:10px 14px;font-size:13px;">Tohle je interní zpráva — klientovi nic nešlo.</p>'
    : '';

  /**
   * Text může mít víc odstavců - prázdný řádek je oddělí. Vzor se píše jako
   * obyčejný text, ne jako HTML; všechno se escapuje, takže do zprávy nejde
   * propašovat značky ani z uloženého vzoru.
   */
  const odstavce = input.text
    .split(/\n\s*\n/)
    .map((o) => o.trim())
    .filter(Boolean)
    .map(
      (o) =>
        // Nejdriv escapovat, teprve pak z povolenych znacek udelat HTML -
        // viz lib/formatovaniZpravy.ts (zadani 15. 9. 2026). Do zpravy se
        // tak z ulozeneho vzoru neda propasovat zadna vlastni znacka.
        `<p>${znackyNaHtml(escapeHtml(o).replace(/\n/g, '<br />'))}</p>`,
    )
    .join('\n    ');

  const nadpis = input.nadpis?.trim()
    ? `<h2>${escapeHtml(input.nadpis.trim())}</h2>`
    : '';

  /**
   * Krátké shrnutí, o co v AudioTaggeru jde (zadání 12. 9. 2026: „chtělo by
   * to krátké grafické shrnutí, o co jde").
   *
   * Ukazuje se JEN u zprávy s odkazem na přeposlech - jinde by to byla
   * reklama bez tlačítka. Tři řádky, žádné obrázky: obrázky v mailu klienti
   * často nemají zapnuté a vypadalo by to rozbitě.
   */
  const oTaggeru = input.odkazNaPreposlech
    ? `
    <table role="presentation" class="tagger" width="100%" style="background:#F7F5FF;border-radius:12px;">
      <tr><td style="padding:16px 18px;background:#F7F5FF;">
        <p class="t-title" style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6B2AF0;">AudioTagger — přeposlech v prohlížeči</p>
        <table role="presentation" class="steps t-steps" width="100%">
          <tr><td class="num" style="background:#F7F5FF;color:#6B2AF0;font-weight:700;width:24px;">1</td><td style="background:#F7F5FF;">Nahrávka se pustí hned, nic se nestahuje.</td></tr>
          <tr><td class="num" style="background:#F7F5FF;color:#6B2AF0;font-weight:700;width:24px;">2</td><td style="background:#F7F5FF;">Text běží vedle — chybu v něm rovnou označíte a nám sedí na vteřinu.</td></tr>
          <tr><td class="num" style="background:#F7F5FF;color:#6B2AF0;font-weight:700;width:24px;">3</td><td style="background:#F7F5FF;">Na konci kliknete na Přeposlechnuto a my se do oprav pustíme.</td></tr>
        </table>
      </td></tr>
    </table>`
    : '';

  // Veta navic - odlisena, at je hned videt, ze tohle neni sablona.
  const uvod = input.uvod?.trim()
    ? `<p style="background:#F3EEFF;border-radius:10px;padding:12px 14px;">${escapeHtml(
        input.uvod.trim(),
      ).replace(/\n/g, '<br />')}</p>`
    : '';

  /**
   * ŠTÍTEK V HLAVIČCE JDE Z PŘEDMĚTU (zadání 14. 9. 2026: „v předmětu jsem
   * změnil to schváleno k fakturaci, ale v té grafice mailu mi to zůstalo.
   * Potřebuji měnit i to v tom obrázku podle předmětu mailu").
   *
   * Do té doby tu stálo natvrdo „MS Portal - <stav>", takže si klient v jedné
   * zprávě přečetl dvě různé věty o tomtéž - jednu v předmětu a druhou na
   * fialovém pruhu. Teď je to jedna věta; když je předmět prázdný, zůstává
   * původní tvar, ať zpráva nezačíná prázdným pruhem.
   *
   * emailShell si štítek escapuje sám - proto se sem posílá syrový text.
   */
  return emailShell({
    tag: input.predmet?.trim() || `MS Portal - ${input.stav}`,
    // Radek, ktery klient vidi v seznamu posty pod predmetem. Hvezdicky
    // tucneho textu by v nem byly videt jako hvezdicky.
    preheader: `${input.nazevProjektu}: ${bezZnacek(input.text).replace(/\s+/g, ' ').slice(0, 120)}`,
    /**
     * CELÉ TĚLO JE ZE VZORU (zadání 15. 9. 2026: „potřebuji měnit celý ten
     * text zprávy. Dobrý den Radko a Annie bot se nedá měnit").
     *
     * Do té doby tu bylo oslovení i název projektu natvrdo a produkce je
     * nemohla přepsat ani odebrat. Teď jsou to proměnné {osloveni}
     * a {projekt} ve vzoru - viz lib/vzoryZprav.ts.
     */
    body: `
    ${nadpis}
    ${interniPoznamka}
    ${uvod}
    ${odstavce}
    <div class="cta-row" style="padding-top:8px;">${tlacitko}</div>
    ${oTaggeru}
`,
  });
}

export async function sendStavProjektuEmail(input: StavProjektuInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  }
  if (input.prijemci.length === 0) {
    return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };
  }

  const skryta = (input.skrytaKopie ?? []).filter((e) => !input.prijemci.includes(e));

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.prijemci.join(', '),
    // Nase adresy jen ve skryte kopii - viz skrytaKopie v typu vys.
    bcc: skryta.length > 0 ? skryta.join(', ') : undefined,
    subject: input.predmet?.trim() || `${input.nazevProjektu} - ${input.stav}`,
    text: [
      input.jenInterne ? 'INTERNI ZPRAVA - klientovi nic neslo.' : '',
      input.uvod?.trim() || '',
      // Osloveni i nazev projektu uz jsou soucasti textu ze vzoru
      // (zadani 15. 9. 2026). Znacky formatovani v prostem textu nemaji smysl.
      bezZnacek(input.text),
      '',
      input.odkazNaPreposlech ? `Preposlech v AudioTaggeru: ${input.odkazNaPreposlech}` : '',
      input.odkazNaPreposlech
        ? 'Nahravka se pusti hned v prohlizeci, text bezi vedle, chybu v nem rovnou oznacite. Na konci kliknete na Preposlechnuto.'
        : '',
      input.odkazNaDisk
        ? `${input.popisekOdkazu?.trim() || 'Slozka s nahravkami'}: ${input.odkazNaDisk}`
        : 'Odkaz na nahravky zatim neni vyplneny.',
    ]
      .filter(Boolean)
      .join('\n'),
    html: buildStavProjektuHtml(input),
  });

  return { sent: true as const, reason: undefined };
}

/* ==========================================================================
   ŽÁDOST O ÚDAJE ODKAZEM (zadání 16. 9. 2026)
   ========================================================================== */

export type PozvankaUdajuInput = {
  to: string;
  /** Komu píšeme - herci jménem, firmě názvem. */
  jmeno: string | null;
  druh: 'HEREC' | 'FIRMA';
  odkaz: string;
  /** Do kdy odkaz platí, už naformátované („15. 10. 2026"). */
  platiDo: string;
  /** Proč to posíláme - napíše se to do mailu, když je to vyplněné. */
  poznamka?: string | null;
};

function vetaOZadosti(druh: 'HEREC' | 'FIRMA'): string {
  return druh === 'HEREC'
    ? 'potřebujeme od vás pár údajů do smlouvy a k výplatě honoráře. Vyplnění zabere dvě minuty a jde to i z telefonu.'
    : 'potřebujeme od vás fakturační údaje. Stačí zadat IČ, zbytek se doplní z obchodního rejstříku sám.';
}

export function buildPozvankaUdajuHtml(input: PozvankaUdajuInput): string {
  return emailShell({
    tag: 'Vaše údaje',
    preheader: 'Formulář na vyplnění údajů pro Mediaspace.',
    body: `
    <p>${escapeHtml(pozdrav(input.jmeno))}</p>
    <p>${escapeHtml(vetaOZadosti(input.druh))}</p>
    ${input.poznamka ? `<p>${escapeHtml(input.poznamka)}</p>` : ''}

    <div class="cta-row">
      <a href="${escapeHtml(input.odkaz)}" class="cta">Vyplnit údaje</a>
    </div>

    <p class="small">Odkaz je jen pro vás a platí do ${escapeHtml(input.platiDo)}. Nikam se nepřihlašujete.</p>
`,
  });
}

export async function sendPozvankaUdajuEmail(input: PozvankaUdajuInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (!input.to) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: 'Vyplnte prosim sve udaje - Mediaspace',
    text: [
      pozdrav(input.jmeno),
      '',
      vetaOZadosti(input.druh),
      ...(input.poznamka ? ['', input.poznamka] : []),
      '',
      input.odkaz,
      '',
      `Odkaz plati do ${input.platiDo}.`,
    ].join('\n'),
    html: buildPozvankaUdajuHtml(input),
  });

  return { sent: true as const, reason: undefined };
}

export type VyplneneUdajeInput = {
  to: string;
  jmenoPrijemce: string | null;
  /** Kdo údaje vyplnil. */
  kdo: string;
  /** Je to rovnou v portálu, nebo to čeká na odkliknutí? */
  hotovo: boolean;
  kolikCeka: number;
  odkaz: string;
};

function vetaOVyplneni(input: VyplneneUdajeInput): string {
  if (input.hotovo) return `${input.kdo} vyplnil(a) své údaje a portál je má zapsané.`;
  return `${input.kdo} vyplnil(a) své údaje. ${
    input.kolikCeka === 1 ? 'Jeden údaj mění' : `${input.kolikCeka} údajů mění`
  } to, co už bylo vyplněné — proto to čeká na vaše odkliknutí.`;
}

export function buildVyplneneUdajeHtml(input: VyplneneUdajeInput): string {
  return emailShell({
    tag: input.hotovo ? 'Údaje vyplněny' : 'Údaje čekají',
    preheader: `${input.kdo} vyplnil údaje.`,
    body: `
    <p>${escapeHtml(pozdrav(input.jmenoPrijemce))}</p>
    <p>${escapeHtml(vetaOVyplneni(input))}</p>

    <div class="cta-row">
      <a href="${escapeHtml(input.odkaz)}" class="cta">${input.hotovo ? 'Zobrazit údaje' : 'Odkliknout změny'}</a>
    </div>
`,
  });
}

export async function sendVyplneneUdajeEmail(input: VyplneneUdajeInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (!input.to) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: input.hotovo
      ? `Udaje vyplneny - ${input.kdo}`
      : `Udaje cekaji na odklepnuti - ${input.kdo}`,
    text: [pozdrav(input.jmenoPrijemce), '', vetaOVyplneni(input), '', input.odkaz].join('\n'),
    html: buildVyplneneUdajeHtml(input),
  });

  return { sent: true as const, reason: undefined };
}
