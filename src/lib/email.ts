import nodemailer from 'nodemailer';
import { pozdrav, sedmyPad } from '@/lib/osloveni';
import { bezZnacek, znackyNaHtml } from '@/lib/formatovaniZpravy';
// Jazyk PŘÍJEMCE a slovník pošty (dávka 6 překladu, 27. 9. 2026) - viz
// lib/jazykEmailu.ts a lib/jazykPrijemce.ts.
import { formatDatum, kodJazyka, type Jazyk } from '@/lib/jazyk';
import { prelozitEmail, prelozitEmailS } from '@/lib/jazykEmailu';
import { odkazNaMapu } from '@/lib/hosteNataceni';

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

/*
 * JAZYK POŠTY SE BERE OD PŘÍJEMCE, ne z přepínače v liště (pravidlo 5
 * v docs/preklad-portalu.md). Volající ho podá v `input.jazyk` - kde ho
 * vezme, řeší lib/jazykPrijemce.ts. Kdo ho nepodá, dostane češtinu jako dřív;
 * proto je pole všude NEPOVINNÉ a žádnému starému volajícímu se nic nerozbije.
 */

/**
 * Datum v poště. ČASOVÉ PÁSMO ZŮSTÁVÁ PRAŽSKÉ i v anglické verzi - splatnosti
 * a termíny se počítají od naší kanceláře a nesmí se posunout jen proto, že
 * server běží v UTC. Právě kvůli pásmu se tu nevolá `formatDatum`
 * z lib/jazyk.ts, které pásmo neumí; jediná výjimka je pozvánka do studia
 * (viz buildInviteHtml), kde se pásmo mění schválně.
 */
function datumPosty(jazyk: Jazyk, d: Date): string {
  return d.toLocaleDateString(kodJazyka(jazyk), { timeZone: 'Europe/Prague' });
}

/** Datum i s časem (24 h) - „přijato", „odkaz platí do", čas podpisu. */
function datumCasPosty(jazyk: Jazyk, d: Date): string {
  return d.toLocaleString(kodJazyka(jazyk), {
    timeZone: 'Europe/Prague',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Oslovení v e-mailu. Česky se křestní jméno skloňuje do 5. pádu (pozdrav()
 * v lib/osloveni.ts, zadání 11. 9. 2026) - anglicky se neskloňuje nic, takže
 * jméno jde do věty celé přes klíč `mail.pozdravSeJmenem`.
 */
function pozdravPosty(jazyk: Jazyk, jmeno: string | null | undefined): string {
  if (jazyk !== 'en') return pozdrav(jmeno);
  const cele = jmeno?.trim();
  return cele
    ? prelozitEmailS(jazyk, 'mail.pozdravSeJmenem', { jmeno: cele })
    : prelozitEmail(jazyk, 'mail.pozdravBezJmena');
}

type OrderEmailInput = {
  /**
   * Komu zpráva jde - adresy členů týmu, kteří mají na kartě uživatele
   * zaškrtnuté „Dostává objednávky" (zadání 14. 9. 2026). Prázdné pole
   * znamená, že to zatím nikdo nemá zaškrtnuté; viz sendOrderNotificationEmail.
   */
  prijemci: string[];
  companyId: string;
  /**
   * PROJEKT, KTERÝ Z OBJEDNÁVKY VZNIKL (zadání 23. 9. 2026: „tlačítko otevřít
   * firmu bych změnil na Otevřít v projektech a dostal se na detail toho
   * projektu").
   *
   * Když projekt není (objednávka reklamy ho zatím nezakládá), zůstává
   * v tlačítku původní odkaz na firmu v administraci - prázdné tlačítko
   * nebo odkaz nikam by byl horší.
   */
  projectId?: string | null;
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
  /** Jazyk příjemce (pravidlo 5). Bez něj čeština - viz pozdravPosty výš. */
  jazyk?: Jazyk;
};

// HTML sablona interniho e-mailu (tym Mediaspace) - schvaleny design, viz
// e-mailovy mockup z 4. 9. 2026 (fialovo-zelena identita msportal.cz,
// rychle skenovatelny prehled objednavky s odkazem do adminu).
function buildInternalNotificationHtml(input: OrderEmailInput): string {
  const jazyk = input.jazyk ?? 'cs';
  // Castka se ZAMERNE neprepocitava ani jinak neformatuje - cisla dokladu
  // a ceny zustavaji tak, jak je portal pise dnes (pravidlo prekladu).
  const priceText = input.priceEstimate != null ? `${input.priceEstimate.toLocaleString('cs-CZ')} Kč` : '—';
  const pageCountText = input.pageCount != null ? String(input.pageCount) : '—';
  const deadlineText = input.deadline ?? '—';
  const narratorText = input.preferredNarrator ? escapeHtml(input.preferredNarrator) : '—';
  const noteText = input.note ? escapeHtml(input.note) : '—';
  const attachmentCell = input.attachmentUrl
    ? `<a href="${escapeHtml(input.attachmentUrl)}">${escapeHtml(
        input.attachmentName || prelozitEmail(jazyk, 'mail.objednavkaInterni.prilohaNazev'),
      )} ↗</a>`
    : '—';
  const nameText = input.requestedByName ? escapeHtml(input.requestedByName) : '—';
  const receivedAt = datumCasPosty(jazyk, new Date());
  const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
  const companyAdminUrl = `${baseUrl}/admin/companies/${encodeURIComponent(input.companyId)}`;
  const projektUrl = input.projectId ? `${baseUrl}/projekty/${encodeURIComponent(input.projectId)}` : null;
  const ctaUrl = projektUrl ?? companyAdminUrl;
  const ctaText = prelozitEmail(
    jazyk,
    projektUrl ? 'mail.objednavkaInterni.otevritProjekt' : 'mail.objednavkaInterni.otevritFirmu',
  );

  return `<!doctype html>
<html lang="${jazyk}">
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
    <div class="tag">${prelozitEmail(jazyk, 'mail.objednavkaInterni.stitek')}</div>
    <div class="bar"></div>
  </td></tr>
  <tr><td class="email-content">
    <span class="badge">${prelozitEmail(jazyk, 'mail.objednavkaInterni.odznak')}</span>
    <h2>${escapeHtml(input.title)} — ${escapeHtml(input.companyName)}</h2>

    <table class="field-table" role="presentation">
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaInterni.firma')}</td><td class="value">${escapeHtml(input.companyName)}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaInterni.normostrany')}</td><td class="value">${pageCountText}</td></tr>
      ${input.bezCeny ? '' : `<tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaInterni.cena')}</td><td class="value">${priceText}</td></tr>`}
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaInterni.termin')}</td><td class="value">${deadlineText}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaInterni.herec')}</td><td class="value">${narratorText}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaInterni.poznamka')}</td><td class="value regular">${noteText}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaInterni.priloha')}</td><td class="value">${attachmentCell}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaInterni.jmeno')}</td><td class="value regular">${nameText}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaInterni.email')}</td><td class="value regular">${escapeHtml(input.requestedByEmail)}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaInterni.prijato')}</td><td class="value regular">${receivedAt}</td></tr>
    </table>

    <div class="cta-row">
      <a href="${ctaUrl}" class="cta">${ctaText}</a>
    </div>
  </td></tr>
  <tr><td class="email-footer">
    <p><span class="brand">Mediaspace</span> · ${prelozitEmail(jazyk, 'mail.objednavkaInterni.patka')}</p>
  </td></tr>
</table>
</body>
</html>`;
}

function buildInternalNotificationText(input: OrderEmailInput): string {
  const jazyk = input.jazyk ?? 'cs';
  return [
    prelozitEmailS(jazyk, 'mail.objednavkaInterni.textNadpis', { firma: input.companyName }),
    '',
    prelozitEmailS(jazyk, 'mail.objednavkaInterni.textNazev', { hodnota: input.title }),
    prelozitEmailS(jazyk, 'mail.objednavkaInterni.textNormostrany', { hodnota: input.pageCount ?? '-' }),
    ...(input.bezCeny
      ? []
      : [
          prelozitEmailS(jazyk, 'mail.objednavkaInterni.textCena', {
            hodnota: input.priceEstimate != null ? input.priceEstimate + ' Kc' : '-',
          }),
        ]),
    prelozitEmailS(jazyk, 'mail.objednavkaInterni.textTermin', { hodnota: input.deadline ?? '-' }),
    prelozitEmailS(jazyk, 'mail.objednavkaInterni.textHerec', { hodnota: input.preferredNarrator ?? '-' }),
    prelozitEmailS(jazyk, 'mail.objednavkaInterni.textPoznamka', { hodnota: input.note ?? '-' }),
    prelozitEmailS(jazyk, 'mail.objednavkaInterni.textPriloha', {
      hodnota: input.attachmentUrl ?? prelozitEmail(jazyk, 'mail.objednavkaInterni.textBezPrilohy'),
    }),
    prelozitEmailS(jazyk, 'mail.objednavkaInterni.textJmeno', { hodnota: input.requestedByName ?? '-' }),
    prelozitEmailS(jazyk, 'mail.objednavkaInterni.textObjednal', { hodnota: input.requestedByEmail }),
    ...(input.projectId
      ? [
          '',
          prelozitEmailS(jazyk, 'mail.objednavkaInterni.textProjekt', {
            hodnota: `${(process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '')}/projekty/${input.projectId}`,
          }),
        ]
      : []),
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
    subject: prelozitEmailS(input.jazyk ?? 'cs', 'mail.objednavkaInterni.predmet', {
      nazev: input.title,
    }),
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
export type InviteAudience = 'CLIENT' | 'INTERNAL' | 'HEREC' | 'BOOKING';

/**
 * Pozvánka do kalendáře studia chodí ANGLICKY (zadání 25. 9. 2026 - klienti
 * MS Studio London jsou Britové). Je to jediná pozvánka, která z portálu
 * odchází v jiném jazyce, proto ten příznak místo dalšího parametru.
 */
export function anglickaPozvanka(audience: InviteAudience): boolean {
  return audience === 'BOOKING';
}

type InviteEmailInput = {
  to: string;
  name: string | null;
  inviteUrl: string;
  expiresAt: Date;
  audience: InviteAudience;
  /** Jazyk příjemce (pravidlo 5). U BOOKING se nebere v potaz - viz níž. */
  jazyk?: Jazyk;
};

/**
 * Jazyk pozvánky. BOOKING chodí ANGLICKY VŽDYCKY (zadání 25. 9. 2026 - klienti
 * MS Studio London jsou Britové), i kdyby si člověk v portálu přepnul na
 * češtinu. U ostatních rozhoduje jazyk příjemce jako u zbytku pošty.
 */
function jazykPozvanky(input: InviteEmailInput): Jazyk {
  return anglickaPozvanka(input.audience) ? 'en' : (input.jazyk ?? 'cs');
}

/**
 * Uvodni odstavec a "co v portalu najdete" podle toho, komu pozvanka jde.
 *
 * Hodnoty uz NEJSOU hotove texty, ale KLICE do slovniku posty
 * (lib/jazykEmailu.ts) - anglicka pozvanka se od 27. 9. 2026 nesklada
 * ternarnimi operatory v HTML, ale bere se ze slovniku jako zbytek portalu.
 */
const INVITE_COPY: Record<
  InviteAudience,
  { tag: string; badge: string; heading: string; intro: string; listTitle: string | null; list: string[] }
> = {
  CLIENT: {
    tag: 'mail.pozvanka.stitek',
    badge: 'mail.pozvanka.odznak',
    heading: 'mail.pozvanka.nadpis',
    intro: 'mail.pozvanka.uvodKlient',
    listTitle: 'mail.pozvanka.seznamNadpis',
    list: ['mail.pozvanka.klientBod1', 'mail.pozvanka.klientBod2', 'mail.pozvanka.klientBod3'],
  },
  INTERNAL: {
    tag: 'mail.pozvanka.stitekInterni',
    badge: 'mail.pozvanka.odznakInterni',
    heading: 'mail.pozvanka.nadpisInterni',
    intro: 'mail.pozvanka.uvodInterni',
    listTitle: 'mail.pozvanka.seznamNadpisInterni',
    list: ['mail.pozvanka.interniBod1', 'mail.pozvanka.interniBod2', 'mail.pozvanka.interniBod3'],
  },
  HEREC: {
    tag: 'mail.pozvanka.stitek',
    badge: 'mail.pozvanka.odznak',
    heading: 'mail.pozvanka.nadpis',
    intro: 'mail.pozvanka.uvodHerec',
    // Hercovska cast portalu se teprve stavi - schvalne tu neslibujeme nic,
    // co uzivatel po prihlaseni nenajde.
    listTitle: null,
    list: [],
  },
  // Muzikanti a producenti, kteří si u nás bookují studio (25. 9. 2026).
  BOOKING: {
    tag: 'mail.pozvanka.stitekBooking',
    badge: 'mail.pozvanka.odznak',
    heading: 'mail.pozvanka.nadpisBooking',
    intro: 'mail.pozvanka.uvodBooking',
    listTitle: 'mail.pozvanka.seznamNadpisBooking',
    list: ['mail.pozvanka.bookingBod1', 'mail.pozvanka.bookingBod2', 'mail.pozvanka.bookingBod3'],
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
function emailShell(options: { tag: string; preheader: string; body: string; jazyk?: Jazyk }): string {
  const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
  // `lang` patri k jazyku PRIJEMCE, ne k jazyku kodu - bez nej nabizi Gmail
  // Britovi preklad z cestiny na mailu, ktery uz anglicky je.
  const jazyk = options.jazyk ?? 'cs';
  return `<!doctype html>
<html lang="${jazyk}">
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
  const jazyk = jazykPozvanky(input);
  const greeting = escapeHtml(pozdravPosty(jazyk, input.name));
  // ČASOVÉ PÁSMO PODLE JAZYKA ZŮSTÁVÁ (zadání 25. 9. 2026): Brit čte platnost
  // odkazu v londýnském čase, Čech v pražském. Proto se tu nevolá datumPosty.
  const expiresText = input.expiresAt.toLocaleDateString(kodJazyka(jazyk), {
    timeZone: jazyk === 'en' ? 'Europe/London' : 'Europe/Prague',
  });

  const copy = INVITE_COPY[input.audience];
  const listHtml = copy.listTitle
    ? `
    <p style="font-weight:600;margin-bottom:10px;">${prelozitEmail(jazyk, copy.listTitle)}</p>
    <table role="presentation" class="steps" width="100%">
      ${copy.list
        .map((klic, i) => `<tr><td class="num">${i + 1}</td><td>${prelozitEmail(jazyk, klic)}</td></tr>`)
        .join('\n      ')}
    </table>
`
    : '';
  const closing = prelozitEmail(
    jazyk,
    input.audience === 'INTERNAL' ? 'mail.pozvanka.zaverInterni' : 'mail.pozvanka.zaver',
  );

  return emailShell({
    jazyk,
    tag: prelozitEmail(jazyk, copy.tag),
    preheader: prelozitEmail(
      jazyk,
      input.audience === 'BOOKING' ? 'mail.pozvanka.preheaderBooking' : 'mail.pozvanka.preheader',
    ),
    body: `
    <span class="badge">${prelozitEmail(jazyk, copy.badge)}</span>
    <h2>${prelozitEmail(jazyk, copy.heading)}</h2>
    <p>${greeting}</p>
    <p>${prelozitEmail(jazyk, copy.intro)}</p>

    <table role="presentation" class="field-table">
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.pozvanka.prihlasovaciJmeno')}</td><td class="value">${escapeHtml(input.to)}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.pozvanka.odkazPlatiDo')}</td><td class="value regular">${expiresText}</td></tr>
    </table>

    <div class="cta-row">
      <a href="${escapeHtml(input.inviteUrl)}" class="cta">${prelozitEmail(jazyk, 'mail.pozvanka.nastavitHeslo')}</a>
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

  const jazyk = jazykPozvanky(input);

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmail(
      jazyk,
      input.audience === 'BOOKING'
        ? 'mail.pozvanka.predmetBooking'
        : input.audience === 'INTERNAL'
          ? 'mail.pozvanka.predmetInterni'
          : 'mail.pozvanka.predmet',
    ),
    // Prosty text drzi stejny tvar v obou jazycich, jen jinymi klici.
    text: [
      pozdravPosty(jazyk, input.name),
      '',
      prelozitEmail(
        jazyk,
        input.audience === 'BOOKING' ? 'mail.pozvanka.textUvodBooking' : 'mail.pozvanka.textUvod',
      ),
      prelozitEmailS(jazyk, 'mail.pozvanka.textJmeno', { hodnota: input.to }),
      '',
      prelozitEmail(jazyk, 'mail.pozvanka.textHeslo'),
      input.inviteUrl,
      '',
      prelozitEmailS(jazyk, 'mail.pozvanka.textPlatnost', {
        datum: formatDatum(jazyk, input.expiresAt),
      }),
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
  /** Jazyk příjemce (pravidlo 5). Bez něj čeština. */
  jazyk?: Jazyk;
};

export function buildOrderConfirmationHtml(input: OrderConfirmationInput): string {
  const jazyk = input.jazyk ?? 'cs';
  const greeting = escapeHtml(pozdravPosty(jazyk, input.name));
  const rows: string[] = [
    `<tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaPotvrzeni.nazev')}</td><td class="value">${escapeHtml(input.title)}</td></tr>`,
  ];
  if (input.isAudiobook) {
    rows.push(
      `<tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaPotvrzeni.normostrany')}</td><td class="value regular">${input.pageCount ?? '—'}</td></tr>`,
    );
    // Castka se nepreformatovava ani v anglickem mailu - viz pravidla prekladu.
    rows.push(
      `<tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaPotvrzeni.cena')}</td><td class="value">${
        input.priceEstimate != null ? `${input.priceEstimate.toLocaleString('cs-CZ')} Kč` : '—'
      }</td></tr>`,
    );
  }
  rows.push(
    `<tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaPotvrzeni.termin')}</td><td class="value regular">${input.deadline ?? '—'}</td></tr>`,
  );
  if (input.preferredNarrator) {
    rows.push(
      `<tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaPotvrzeni.herec')}</td><td class="value regular">${escapeHtml(
        input.preferredNarrator,
      )}</td></tr>`,
    );
  }
  if (input.note) {
    rows.push(
      `<tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaPotvrzeni.poznamka')}</td><td class="value regular">${escapeHtml(input.note)}</td></tr>`,
    );
  }
  if (input.attachmentName) {
    rows.push(
      `<tr><td class="label">${prelozitEmail(jazyk, 'mail.objednavkaPotvrzeni.priloha')}</td><td class="value regular">${escapeHtml(input.attachmentName)}</td></tr>`,
    );
  }

  const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');

  return emailShell({
    jazyk,
    tag: prelozitEmail(
      jazyk,
      input.isAudiobook ? 'mail.objednavkaPotvrzeni.stitek' : 'mail.objednavkaPotvrzeni.stitekJina',
    ),
    preheader: prelozitEmailS(jazyk, 'mail.objednavkaPotvrzeni.preheader', { nazev: input.title }),
    body: `
    <span class="badge">${prelozitEmail(jazyk, 'mail.objednavkaPotvrzeni.odznak')}</span>
    <h2>${prelozitEmail(jazyk, 'mail.objednavkaPotvrzeni.nadpis')}</h2>
    <p>${greeting}</p>
    <p>${prelozitEmail(
      jazyk,
      input.isAudiobook ? 'mail.objednavkaPotvrzeni.uvodAudiokniha' : 'mail.objednavkaPotvrzeni.uvod',
    )}</p>

    <table role="presentation" class="field-table">
      ${rows.join('\n      ')}
    </table>

    <div class="cta-row">
      <a href="${baseUrl}/projekty" class="cta-dark">${prelozitEmail(jazyk, 'mail.objednavkaPotvrzeni.tlacitko')}</a>
    </div>

    ${
      input.isAudiobook
        ? `<p class="small">${prelozitEmail(jazyk, 'mail.objednavkaPotvrzeni.cenaPoznamka')}</p>`
        : ''
    }
    <p class="small">${prelozitEmailS(jazyk, 'mail.objednavkaPotvrzeni.automat', {
      adresa: `<a href="mailto:${ADRESA_ODESILATELE}" style="color:#6B2AF0;text-decoration:none;">${ADRESA_ODESILATELE}</a>`,
    })}</p>
  `,
  });
}

export async function sendOrderConfirmationEmail(input: OrderConfirmationInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  const jazyk = input.jazyk ?? 'cs';

  await transport.sendMail({
    // ADRESY TYMU SEM NESMI (zadani 14. 9. 2026: „klient nevidi adresy tymu").
    // Do 14. 9. 2026 tu v Reply-To svitila interni schranka na objednavky;
    // ted odpoved jde zpatky na mediaspace@msportal.cz, tedy tam, odkud
    // zprava prisla. Kdo ji uvnitr cte, je nase vec, ne klientova.
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmailS(jazyk, 'mail.objednavkaPotvrzeni.predmet', { nazev: input.title }),
    text: [
      pozdravPosty(jazyk, input.name),
      '',
      prelozitEmail(jazyk, 'mail.objednavkaPotvrzeni.textUvod'),
      '',
      prelozitEmailS(jazyk, 'mail.objednavkaPotvrzeni.textNazev', { hodnota: input.title }),
      ...(input.isAudiobook
        ? [
            prelozitEmailS(jazyk, 'mail.objednavkaPotvrzeni.textNormostrany', {
              hodnota: input.pageCount ?? '-',
            }),
            prelozitEmailS(jazyk, 'mail.objednavkaPotvrzeni.textCena', {
              hodnota: input.priceEstimate != null ? input.priceEstimate + ' Kc' : '-',
            }),
          ]
        : []),
      prelozitEmailS(jazyk, 'mail.objednavkaPotvrzeni.textTermin', { hodnota: input.deadline ?? '-' }),
      prelozitEmailS(jazyk, 'mail.objednavkaPotvrzeni.textHerec', {
        hodnota: input.preferredNarrator ?? '-',
      }),
      prelozitEmailS(jazyk, 'mail.objednavkaPotvrzeni.textPoznamka', { hodnota: input.note ?? '-' }),
      '',
      prelozitEmail(jazyk, 'mail.objednavkaPotvrzeni.textZaver'),
      // Podpis je nazev znacky, ten se nepreklada do anglictiny.
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
  /** Jazyk příjemce (pravidlo 5). Bez něj čeština. */
  jazyk?: Jazyk;
};

export function buildPasswordResetHtml(input: PasswordResetInput): string {
  const jazyk = input.jazyk ?? 'cs';
  const greeting = escapeHtml(pozdravPosty(jazyk, input.name));
  const expiresText = datumCasPosty(jazyk, input.expiresAt);

  return emailShell({
    jazyk,
    tag: prelozitEmail(jazyk, 'mail.heslo.stitek'),
    preheader: prelozitEmail(jazyk, 'mail.heslo.preheader'),
    body: `
    <span class="badge">${prelozitEmail(jazyk, 'mail.heslo.odznak')}</span>
    <h2>${prelozitEmail(jazyk, 'mail.heslo.nadpis')}</h2>
    <p>${greeting}</p>
    <p>${prelozitEmailS(jazyk, 'mail.heslo.veta', {
      ucet: `<strong>${escapeHtml(input.to)}</strong>`,
    })}</p>

    <div class="cta-row">
      <a href="${escapeHtml(input.resetUrl)}" class="cta">${prelozitEmail(jazyk, 'mail.heslo.tlacitko')}</a>
    </div>

    <p class="small">${prelozitEmailS(jazyk, 'mail.heslo.platnost', { datum: expiresText })}</p>
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
  /** Jazyk příjemců (pravidlo 5). Bez něj čeština. */
  jazyk?: Jazyk;
};

export function buildHerecDotocenHtml(input: HerecDotocenInput): string {
  const jazyk = input.jazyk ?? 'cs';
  return emailShell({
    jazyk,
    tag: prelozitEmail(jazyk, 'mail.dotoceno.stitek'),
    preheader: prelozitEmailS(jazyk, 'mail.dotoceno.preheader', {
      herec: input.jmenoHerce,
      projekt: input.nazevProjektu,
    }),
    body: `
    <span class="badge">${prelozitEmail(jazyk, 'mail.dotoceno.odznak')}</span>
    <h2>${prelozitEmailS(jazyk, 'mail.dotoceno.nadpis', { herec: escapeHtml(input.jmenoHerce) })}</h2>
    <table role="presentation" class="field-table">
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.dotoceno.projekt')}</td><td class="value">${escapeHtml(input.nazevProjektu)}</td></tr>
      ${input.nazevFirmy ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.dotoceno.firma')}</td><td class="value regular">${escapeHtml(input.nazevFirmy)}</td></tr>` : ''}
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.dotoceno.herec')}</td><td class="value">${escapeHtml(input.jmenoHerce)}</td></tr>
      ${input.potvrdil ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.dotoceno.odskrtl')}</td><td class="value regular">${escapeHtml(input.potvrdil)}</td></tr>` : ''}
    </table>
    <div class="cta-row">
      <a href="${escapeHtml(input.odkazNaProjekt)}" class="cta">${prelozitEmail(jazyk, 'mail.dotoceno.tlacitko')}</a>
    </div>
    <p class="small">${prelozitEmail(jazyk, 'mail.dotoceno.komuChodi')}</p>
`,
  });
}

export async function sendHerecDotocenEmail(input: HerecDotocenInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (input.prijemci.length === 0) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };

  const jazyk = input.jazyk ?? 'cs';

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.prijemci.join(', '),
    subject: prelozitEmailS(jazyk, 'mail.dotoceno.predmet', {
      herec: input.jmenoHerce,
      projekt: input.nazevProjektu,
    }),
    text: [
      prelozitEmailS(jazyk, 'mail.dotoceno.textNadpis', { herec: input.jmenoHerce }),
      '',
      input.nazevFirmy
        ? prelozitEmailS(jazyk, 'mail.dotoceno.textProjektSFirmou', {
            projekt: input.nazevProjektu,
            firma: input.nazevFirmy,
          })
        : prelozitEmailS(jazyk, 'mail.dotoceno.textProjekt', { projekt: input.nazevProjektu }),
      input.potvrdil ? prelozitEmailS(jazyk, 'mail.dotoceno.textOdskrtl', { kdo: input.potvrdil }) : '',
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
  /** Jazyk klienta (pravidlo 5). Bez něj čeština. */
  jazyk?: Jazyk;
};

/**
 * Věta o dotočení. V ČEŠTINĚ jde jméno herce do 7. pádu — „s Lubošem
 * Ondráčkem" (zadání 16. 9. 2026). Když se jméno skloňovat nedá (přezdívka,
 * závorka, cizí tvar), věta se o něj zkrátí; první pád uprostřed věty by byl
 * horší než žádné jméno.
 *
 * V ANGLIČTINĚ se neskloňuje, takže jméno jde do věty tak, jak je uložené.
 */
function vetaODotoceni(jazyk: Jazyk, jmenoHerce: string): string {
  const tvar = jazyk === 'en' ? jmenoHerce.trim() : sedmyPad(jmenoHerce);
  return tvar
    ? prelozitEmailS(jazyk, 'mail.dotocenoKlient.veta', { herec: tvar })
    : prelozitEmail(jazyk, 'mail.dotocenoKlient.vetaBezJmena');
}

export function buildHerecDotocenKlientoviHtml(input: HerecDotocenKlientoviInput): string {
  const jazyk = input.jazyk ?? 'cs';
  return emailShell({
    jazyk,
    tag: prelozitEmail(jazyk, 'mail.dotoceno.stitek'),
    preheader: prelozitEmailS(jazyk, 'mail.dotocenoKlient.preheader', {
      projekt: input.nazevProjektu,
      herec: input.jmenoHerce,
    }),
    // KRATKÁ ZPRÁVA (zadání 16. 9. 2026: „zbytek pryč, jen nechat tlačítko
    // do portálu"). Pozdrav, jedna věta, tlačítko - nic víc. Název projektu
    // nese předmět mailu.
    body: `
    <p>${escapeHtml(pozdravPosty(jazyk, input.jmenoKlienta))}</p>
    <p>${escapeHtml(vetaODotoceni(jazyk, input.jmenoHerce))}</p>

    <div class="cta-row">
      <a href="${escapeHtml(input.odkazNaPortal)}" class="cta">${prelozitEmail(jazyk, 'mail.otevritPortal')}</a>
    </div>
`,
  });
}

export async function sendHerecDotocenKlientoviEmail(input: HerecDotocenKlientoviInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (!input.to) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };

  const jazyk = input.jazyk ?? 'cs';

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmailS(jazyk, 'mail.dotocenoKlient.predmet', {
      herec: input.jmenoHerce,
      projekt: input.nazevProjektu,
    }),
    text: [
      pozdravPosty(jazyk, input.jmenoKlienta),
      '',
      vetaODotoceni(jazyk, input.jmenoHerce),
      '',
      input.odkazNaPortal,
    ].join('\n'),
    html: buildHerecDotocenKlientoviHtml(input),
  });

  return { sent: true as const, reason: undefined };
}

/**
 * ZMĚNA NATÁČECÍHO TERMÍNU — ZPRÁVA KLIENTOVI (zadání 1. 10. 2026: „jeste dej
 * klientovi moznost nastaveni notifikace pri zmene terminu nataceci
 * frekvence"). Chodí jen klientovi projektu, a jen když si to zapnul — viz
 * lib/zmenaTerminuKlient.ts.
 *
 * Termíny chodí hotovým textem (`puvodne`, `nove`), ne jako Date: formátuje je
 * volající v pásmu studia. Mail nemá počítat, v jakém pásmu se natáčí.
 */
export type ZmenaTerminuKlientoviInput = {
  to: string;
  jmenoKlienta: string | null;
  nazevProjektu: string;
  /** Termín, jak byl zapsaný dosud. */
  puvodne: string;
  /** Nový termín. U zrušení null. */
  nove: string | null;
  /** Kam v portálu klient kouká na svoje projekty. */
  odkazNaPortal: string;
  /** Jazyk klienta (pravidlo 5). Bez něj čeština. */
  jazyk?: Jazyk;
};

export function buildZmenaTerminuKlientoviHtml(input: ZmenaTerminuKlientoviInput): string {
  const jazyk = input.jazyk ?? 'cs';
  const zruseno = input.nove === null;
  return emailShell({
    jazyk,
    tag: prelozitEmail(jazyk, 'mail.zmenaTerminu.stitek'),
    preheader: prelozitEmailS(
      jazyk,
      zruseno ? 'mail.zmenaTerminu.preheaderZruseno' : 'mail.zmenaTerminu.preheader',
      { projekt: input.nazevProjektu },
    ),
    // Krátká zpráva jako u dotočeno: pozdrav, věta, termíny, tlačítko.
    body: `
    <p>${escapeHtml(pozdravPosty(jazyk, input.jmenoKlienta))}</p>
    <p>${escapeHtml(
      prelozitEmailS(jazyk, zruseno ? 'mail.zmenaTerminu.vetaZruseno' : 'mail.zmenaTerminu.veta', {
        projekt: input.nazevProjektu,
      }),
    )}</p>
    <p>${
      zruseno
        ? escapeHtml(prelozitEmailS(jazyk, 'mail.zmenaTerminu.zruseno', { kdy: input.puvodne }))
        : `${escapeHtml(prelozitEmailS(jazyk, 'mail.zmenaTerminu.puvodne', { kdy: input.puvodne }))}<br />${escapeHtml(
            prelozitEmailS(jazyk, 'mail.zmenaTerminu.nove', { kdy: input.nove ?? '' }),
          )}`
    }</p>

    <div class="cta-row">
      <a href="${escapeHtml(input.odkazNaPortal)}" class="cta">${prelozitEmail(jazyk, 'mail.zmenaTerminu.tlacitko')}</a>
    </div>
`,
  });
}

export async function sendZmenaTerminuKlientoviEmail(input: ZmenaTerminuKlientoviInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (!input.to) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };

  const jazyk = input.jazyk ?? 'cs';
  const zruseno = input.nove === null;

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmailS(
      jazyk,
      zruseno ? 'mail.zmenaTerminu.predmetZruseno' : 'mail.zmenaTerminu.predmet',
      { projekt: input.nazevProjektu },
    ),
    text: [
      pozdravPosty(jazyk, input.jmenoKlienta),
      '',
      prelozitEmailS(jazyk, zruseno ? 'mail.zmenaTerminu.vetaZruseno' : 'mail.zmenaTerminu.veta', {
        projekt: input.nazevProjektu,
      }),
      '',
      zruseno
        ? prelozitEmailS(jazyk, 'mail.zmenaTerminu.zruseno', { kdy: input.puvodne })
        : prelozitEmailS(jazyk, 'mail.zmenaTerminu.puvodne', { kdy: input.puvodne }),
      ...(zruseno
        ? []
        : [prelozitEmailS(jazyk, 'mail.zmenaTerminu.nove', { kdy: input.nove ?? '' })]),
      '',
      input.odkazNaPortal,
    ].join('\n'),
    html: buildZmenaTerminuKlientoviHtml(input),
  });

  return { sent: true as const, reason: undefined };
}

export async function sendPasswordResetEmail(input: PasswordResetInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  const jazyk = input.jazyk ?? 'cs';

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmail(jazyk, 'mail.heslo.predmet'),
    text: [
      pozdravPosty(jazyk, input.name),
      '',
      prelozitEmailS(jazyk, 'mail.heslo.textVeta', { ucet: input.to }),
      prelozitEmail(jazyk, 'mail.heslo.textOdkaz'),
      input.resetUrl,
      '',
      // Prosty text tu odjakziva pise cas bez pevneho pasma (na rozdil od
      // HTML varianty) - necham tak, jen se meni lokal podle prijemce.
      prelozitEmailS(jazyk, 'mail.heslo.textPlatnost', {
        datum: input.expiresAt.toLocaleString(kodJazyka(jazyk)),
      }),
      prelozitEmail(jazyk, 'mail.heslo.textKdyzNezadal'),
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
  currency: 'CZK' | 'EUR' | 'USD' | 'GBP';
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
  /** Jazyk příjemce (pravidlo 5). Bez něj čeština. */
  jazyk?: Jazyk;
};

const OFFER_CURRENCY_SYMBOL: Record<string, string> = { CZK: 'Kč', EUR: '€', USD: '$', GBP: '£' };

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
  const jazyk = input.jazyk ?? 'cs';
  const nazev = input.projectName?.trim() || input.subject?.trim() || input.number;

  return emailShell({
    jazyk,
    tag: prelozitEmail(jazyk, 'mail.nabidka.stitek'),
    preheader: prelozitEmailS(jazyk, 'mail.nabidka.preheader', { nazev }),
    body: `
    <p>${prelozitEmail(jazyk, 'mail.pozdravBezJmena')}</p>
    <p>${prelozitEmailS(jazyk, 'mail.nabidka.veta', {
      nazev: `<strong>${escapeHtml(nazev)}</strong>`,
    })}</p>

    <div class="cta-row">
      <a href="${escapeHtml(input.offerUrl)}" class="cta">${prelozitEmail(jazyk, 'mail.nabidka.tlacitko')}</a>
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
  const jazyk = input.jazyk ?? 'cs';

  const zprava = {
    ...obalka,
    to: input.to,
    subject: prelozitEmailS(jazyk, 'mail.nabidka.predmet', { nazev: nazevVPredmetu }),
    text: [
      prelozitEmail(jazyk, 'mail.textPozdravBezJmena'),
      '',
      prelozitEmailS(jazyk, 'mail.nabidka.textVeta', { nazev: nazevVPredmetu }),
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
  currency: 'CZK' | 'EUR' | 'USD' | 'GBP';
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
  /** Od 26. 9. 2026 jich může být víc - jeden na každý výstup projektu. */
  rodneListy?: { nazev: string; obsah: Buffer }[] | null;
  /** Jazyk odběratele (pravidlo 5). Bez něj čeština. */
  jazyk?: Jazyk;
};

export function buildInvoiceHtml(input: InvoiceEmailInput): string {
  const jazyk = input.jazyk ?? 'cs';
  const greeting = escapeHtml(pozdravPosty(jazyk, input.contactName));
  const dueText = input.dueDate ? datumPosty(jazyk, input.dueDate) : null;
  const account = [input.accountNumber, input.iban].filter(Boolean).join(' · ');

  return emailShell({
    jazyk,
    tag: prelozitEmail(jazyk, 'mail.faktura.stitek'),
    preheader: prelozitEmailS(jazyk, 'mail.faktura.preheader', {
      cislo: input.number,
      firma: input.issuerName,
    }),
    // CISLO FAKTURY, VARIABILNI SYMBOL ANI CASTKY SE NEPREKLADAJI ANI
    // NEPREFORMATOVAVAJI - je to ucetni doklad, musi sedet s PDF i s bankou.
    body: `
    <span class="badge">${prelozitEmailS(jazyk, 'mail.faktura.odznak', { cislo: escapeHtml(input.number) })}</span>
    <h2>${input.subject ? escapeHtml(input.subject) : prelozitEmail(jazyk, 'mail.faktura.nadpis')}</h2>
    <p>${greeting}</p>
    <p>${prelozitEmailS(jazyk, 'mail.faktura.veta', {
      firma: `<strong>${escapeHtml(input.companyName)}</strong>`,
    })}</p>

    <table role="presentation" class="field-table">
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.faktura.cislo')}</td><td class="value">${escapeHtml(input.number)}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.faktura.bezDph')}</td><td class="value regular">${escapeHtml(formatOfferMoney(input.totalExVat, input.currency))}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.faktura.kUhrade')}</td><td class="value">${escapeHtml(formatOfferMoney(input.totalIncVat, input.currency))}</td></tr>
      ${dueText ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.faktura.splatnost')}</td><td class="value">${escapeHtml(dueText)}</td></tr>` : ''}
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.faktura.ucet')}</td><td class="value regular">${escapeHtml(account || input.accountLabel)}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.faktura.variabilniSymbol')}</td><td class="value">${escapeHtml(input.variableSymbol)}</td></tr>
    </table>

    ${input.pdf ? `<p class="small">${prelozitEmail(jazyk, 'mail.faktura.pdfVPriloze')}</p>` : ''}
    ${
      input.rodneListy?.length
        ? `<p class="small">${
            input.rodneListy.length > 1
              ? prelozitEmailS(jazyk, 'mail.faktura.rodneListyVPriloze', { pocet: input.rodneListy.length })
              : prelozitEmail(jazyk, 'mail.faktura.rodnyListVPriloze')
          }</p>`
        : ''
    }

    <p class="small">${prelozitEmail(jazyk, 'mail.faktura.kdybyNesedelo')}</p>
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
  const jazyk = input.jazyk ?? 'cs';

  const zprava = {
    ...odesilatelMediaspace(ODPOVED_UCTARNA),
    to: input.to,
    // Kopie schvalne v Cc, ne skryta: ucetni i clovek od projektu maji o sobe
    // vedet, at si fakturu nepreposilaji dokola.
    ...(input.cc?.length ? { cc: input.cc } : {}),
    subject: input.subject
      ? prelozitEmailS(jazyk, 'mail.faktura.predmetSPredmetem', {
          cislo: input.number,
          predmet: input.subject,
        })
      : prelozitEmailS(jazyk, 'mail.faktura.predmet', { cislo: input.number }),
    text: [
      pozdravPosty(jazyk, input.contactName),
      '',
      prelozitEmailS(jazyk, 'mail.faktura.textVeta', {
        cislo: input.number,
        firma: input.companyName,
      }),
      prelozitEmailS(jazyk, 'mail.faktura.textKUhrade', {
        castka: formatOfferMoney(input.totalIncVat, input.currency),
      }),
      input.dueDate
        ? prelozitEmailS(jazyk, 'mail.faktura.textSplatnost', {
            datum: formatDatum(jazyk, input.dueDate),
          })
        : '',
      prelozitEmailS(jazyk, 'mail.faktura.textUcet', {
        ucet: [input.accountNumber, input.iban].filter(Boolean).join(' / ') || input.accountLabel,
      }),
      prelozitEmailS(jazyk, 'mail.faktura.textVariabilniSymbol', { vs: input.variableSymbol }),
      input.pdf ? prelozitEmail(jazyk, 'mail.faktura.textPdfVPriloze') : '',
      input.rodneListy?.length
        ? input.rodneListy.length > 1
          ? prelozitEmailS(jazyk, 'mail.faktura.textRodneListyVPriloze', {
              pocet: input.rodneListy.length,
            })
          : prelozitEmail(jazyk, 'mail.faktura.textRodnyListVPriloze')
        : '',
      '',
      input.issuerName,
    ]
      .filter(Boolean)
      .join('\n'),
    html: buildInvoiceHtml(input),
    ...(() => {
      const prilohy = [
        input.pdf ? { filename: input.pdf.nazev, content: input.pdf.obsah } : null,
        ...(input.rodneListy ?? []).map((r) => ({ filename: r.nazev, content: r.obsah })),
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
  /** Jazyk podepisujícího (pravidlo 5). Bez něj čeština. */
  jazyk?: Jazyk;
};

export function buildContractHtml(input: ContractEmailInput): string {
  const jazyk = input.jazyk ?? 'cs';
  return emailShell({
    jazyk,
    tag: prelozitEmail(jazyk, 'mail.smlouva.stitek'),
    preheader: prelozitEmailS(jazyk, 'mail.smlouva.preheader', {
      cislo: input.number,
      firma: input.issuerName,
    }),
    body: `
    <span class="badge">${prelozitEmailS(jazyk, 'mail.smlouva.odznak', { cislo: escapeHtml(input.number) })}</span>
    <h2>${escapeHtml(input.title)}</h2>
    <p>${escapeHtml(pozdravPosty(jazyk, input.signerName))}</p>
    <p>${prelozitEmailS(jazyk, 'mail.smlouva.veta', {
      firma: `<strong>${escapeHtml(input.issuerName)}</strong>`,
    })}</p>

    <table role="presentation" class="field-table">
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.smlouva.cislo')}</td><td class="value">${escapeHtml(input.number)}</td></tr>
      ${input.projectName ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.smlouva.projekt')}</td><td class="value regular">${escapeHtml(input.projectName)}</td></tr>` : ''}
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.smlouva.druhaStrana')}</td><td class="value regular">${escapeHtml(input.issuerName)}</td></tr>
      ${input.alreadySignedByUs ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.smlouva.stav')}</td><td class="value regular">${prelozitEmail(jazyk, 'mail.smlouva.podepsanaZaNas')}</td></tr>` : ''}
    </table>

    <div class="cta-row">
      <a href="${escapeHtml(input.contractUrl)}" class="cta">${prelozitEmail(jazyk, 'mail.smlouva.tlacitko')}</a>
    </div>

    <p class="small">${prelozitEmail(jazyk, 'mail.smlouva.klic')}</p>
  `,
  });
}

export async function sendContractEmail(input: ContractEmailInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  const jazyk = input.jazyk ?? 'cs';

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmailS(jazyk, 'mail.smlouva.predmet', {
      cislo: input.number,
      nazev: input.title,
    }),
    text: [
      pozdravPosty(jazyk, input.signerName),
      '',
      prelozitEmailS(jazyk, 'mail.smlouva.textVeta', {
        cislo: input.number,
        firma: input.issuerName,
      }),
      input.projectName
        ? prelozitEmailS(jazyk, 'mail.smlouva.textProjekt', { projekt: input.projectName })
        : '',
      '',
      prelozitEmail(jazyk, 'mail.smlouva.textOtevrit'),
      input.contractUrl,
      '',
      prelozitEmail(jazyk, 'mail.smlouva.textKlic'),
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
  /** Jazyk příjemců (pravidlo 5). Bez něj čeština. */
  jazyk?: Jazyk;
};

function podpisRadek(jazyk: Jazyk, p: { role: string; name: string; signedAt: Date }): string {
  return `${p.name} (${datumCasPosty(jazyk, p.signedAt)})`;
}

export function buildPodepsanaSmlouvaHtml(input: PodepsanaSmlouvaInput): string {
  const jazyk = input.jazyk ?? 'cs';
  const nase = input.podepsali.find((p) => p.role === 'MEDIASPACE') ?? null;
  const protistrana = input.podepsali.find((p) => p.role === 'PROTISTRANA') ?? null;

  return emailShell({
    jazyk,
    tag: prelozitEmailS(jazyk, 'mail.smlouvaPodepsana.stitek', { cislo: input.number }),
    preheader: prelozitEmailS(jazyk, 'mail.smlouvaPodepsana.preheader', { cislo: input.number }),
    body: `
    <span class="badge">${prelozitEmailS(jazyk, 'mail.smlouva.odznak', { cislo: escapeHtml(input.number) })}</span>
    <h2>${escapeHtml(input.title)}</h2>
    <p>${escapeHtml(pozdravPosty(jazyk, input.jmenoPrijemce))}</p>
    <p>${prelozitEmail(jazyk, 'mail.smlouvaPodepsana.veta')}</p>

    <table role="presentation" class="field-table">
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.smlouva.cislo')}</td><td class="value">${escapeHtml(input.number)}</td></tr>
      ${input.projectName ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.smlouva.projekt')}</td><td class="value regular">${escapeHtml(input.projectName)}</td></tr>` : ''}
      ${nase ? `<tr><td class="label">${prelozitEmailS(jazyk, 'mail.smlouvaPodepsana.zaNas', { firma: escapeHtml(input.issuerName) })}</td><td class="value regular">${escapeHtml(podpisRadek(jazyk, nase))}</td></tr>` : ''}
      ${protistrana ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.smlouvaPodepsana.zaProtistranu')}</td><td class="value regular">${escapeHtml(podpisRadek(jazyk, protistrana))}</td></tr>` : ''}
    </table>

    <div class="cta-row">
      <a href="${escapeHtml(input.contractUrl)}" class="cta">${prelozitEmail(jazyk, 'mail.smlouvaPodepsana.tlacitko')}</a>
    </div>

    <p class="small">${prelozitEmail(jazyk, 'mail.smlouvaPodepsana.otisk')}</p>
  `,
  });
}

export async function sendPodepsanaSmlouvaEmail(input: PodepsanaSmlouvaInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (input.prijemci.length === 0) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };

  const skryta = (input.skrytaKopie ?? []).filter((e) => !input.prijemci.includes(e));
  const jazyk = input.jazyk ?? 'cs';

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.prijemci.join(', '),
    bcc: skryta.length > 0 ? skryta.join(', ') : undefined,
    subject: prelozitEmailS(jazyk, 'mail.smlouvaPodepsana.predmet', {
      cislo: input.number,
      nazev: input.title,
    }),
    text: [
      pozdravPosty(jazyk, input.jmenoPrijemce),
      '',
      prelozitEmailS(jazyk, 'mail.smlouvaPodepsana.textVeta', { cislo: input.number }),
      input.projectName
        ? prelozitEmailS(jazyk, 'mail.smlouva.textProjekt', { projekt: input.projectName })
        : '',
      ...input.podepsali.map((p) =>
        prelozitEmailS(jazyk, 'mail.smlouvaPodepsana.textPodepsal', {
          podpis: podpisRadek(jazyk, p),
        }),
      ),
      '',
      prelozitEmail(jazyk, 'mail.smlouvaPodepsana.textPriloha'),
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
  /** Jazyk zvukaře (pravidlo 5). Bez něj čeština. */
  jazyk?: Jazyk;
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
  const jazyk = input.jazyk ?? 'cs';
  const radky = [
    `<tr><td class="label">${prelozitEmail(jazyk, 'mail.bonus.bonus')}</td><td class="value">${escapeHtml(input.castka)}</td></tr>`,
    `<tr><td class="label">${prelozitEmail(jazyk, 'mail.bonus.kniha')}</td><td class="value regular">${escapeHtml(input.projekt)}</td></tr>`,
    input.podilProcent > 0
      ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.bonus.podilNaStrihu')}</td><td class="value regular">${input.podilProcent} %</td></tr>`
      : '',
    input.poznamka
      ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.bonus.zaCo')}</td><td class="value regular">${escapeHtml(input.poznamka)}</td></tr>`
      : '',
    input.schvalil
      ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.bonus.schvalil')}</td><td class="value regular">${escapeHtml(input.schvalil)}</td></tr>`
      : '',
  ].filter(Boolean);

  return emailShell({
    jazyk,
    tag: prelozitEmail(jazyk, 'mail.bonus.stitek'),
    // Castka uz prichazi naformatovana od volajiciho - nesaha se na ni.
    preheader: prelozitEmailS(jazyk, 'mail.bonus.preheader', {
      projekt: input.projekt,
      castka: input.castka,
    }),
    body: `
    <span class="badge">${prelozitEmail(jazyk, 'mail.bonus.odznak')}</span>
    <h2>${escapeHtml(input.projekt)}</h2>

    <table role="presentation" class="field-table">
      ${radky.join('\n      ')}
    </table>

    <div class="cta-row">
      <a href="${escapeHtml(input.odkaz)}" class="cta">${prelozitEmail(jazyk, 'mail.bonus.tlacitko')}</a>
    </div>

    <p class="small">${prelozitEmail(jazyk, 'mail.bonus.vysvetleni')}</p>
  `,
  });
}

export async function sendBonusEmail(input: BonusEmailInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };

  const jazyk = input.jazyk ?? 'cs';

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmailS(jazyk, 'mail.bonus.predmet', { projekt: input.projekt }),
    // Prosty text drzi krok s HTML - taky bez osloveni, jen udaje.
    text: [
      prelozitEmailS(jazyk, 'mail.bonus.textBonus', { castka: input.castka }),
      prelozitEmailS(jazyk, 'mail.bonus.textKniha', { projekt: input.projekt }),
      input.podilProcent > 0
        ? prelozitEmailS(jazyk, 'mail.bonus.textPodilNaStrihu', { procenta: input.podilProcent })
        : '',
      input.poznamka ? prelozitEmailS(jazyk, 'mail.bonus.textZaCo', { duvod: input.poznamka }) : '',
      input.schvalil ? prelozitEmailS(jazyk, 'mail.bonus.textSchvalil', { kdo: input.schvalil }) : '',
      '',
      prelozitEmail(jazyk, 'mail.bonus.textOdkaz'),
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

export type MesicniPrehledInput = {
  to: string;
  /**
   * Jazyk PŘÍJEMCE (pravidlo 5), ne přepínač v liště. Nepovinně - kdo ho
   * nepředá, dostane češtinu jako doteď.
   */
  jazyk?: Jazyk;
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
  /** Nastaveni v Prehledy → Zvukari (21. 9. 2026). Bez nej plati: castky ano, 6. den. */
  castkyViditelne?: boolean;
  poznamka?: string | null;
  den?: number;
};

export function buildMesicniPrehledHtml(input: MesicniPrehledInput): string {
  const jazyk = input.jazyk ?? 'cs';
  const sCastkou = input.castkyViditelne !== false;
  const den = input.den ?? 6;
  const radekDruhu = (d: { nazev: string; hodiny: string; castka: string }) =>
    `<tr><td class="label">${escapeHtml(d.nazev)}</td><td class="value regular">${escapeHtml(d.hodiny)}${sCastkou ? ` · ${escapeHtml(d.castka)}` : ''}</td></tr>`;

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

  const bonusy = input.bonusCelkem && sCastkou
    ? `<h3 style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#6B2AF0;margin:22px 0 8px;">${prelozitEmail(jazyk, 'mail.prehled.bonusy')}</h3>
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
    tag: prelozitEmailS(jazyk, 'mail.prehled.stitek', { mesic: input.mesic }),
    preheader: sCastkou
      ? prelozitEmailS(jazyk, 'mail.prehled.preheaderSCastkou', {
          mesic: input.mesic,
          hodiny: input.hodiny,
          celkem: input.celkem,
        })
      : prelozitEmailS(jazyk, 'mail.prehled.preheader', { mesic: input.mesic, hodiny: input.hodiny }),
    body: `
    <span class="badge">${escapeHtml(input.mesic)}</span>
    <h2>${escapeHtml(input.hodiny)}${sCastkou ? ` · ${escapeHtml(input.celkem)}` : ''}</h2>

    <table role="presentation" class="field-table">
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.prehled.odpracovano')}</td><td class="value">${escapeHtml(input.hodiny)}</td></tr>
      ${sCastkou ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.prehled.zaPraci')}</td><td class="value">${escapeHtml(input.castka)}</td></tr>` : ''}
      ${sCastkou && input.bonusCelkem ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.prehled.bonusy')}</td><td class="value">${escapeHtml(input.bonusCelkem)}</td></tr>` : ''}
      ${sCastkou ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.prehled.celkem')}</td><td class="value">${escapeHtml(input.celkem)}</td></tr>` : ''}
    </table>

    ${
      input.druhy.length
        ? `<h3 style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#6B2AF0;margin:22px 0 8px;">${prelozitEmail(jazyk, 'mail.prehled.podleDruhu')}</h3>
    <table role="presentation" class="field-table">
      ${input.druhy.map(radekDruhu).join('\n      ')}
    </table>`
        : ''
    }

    ${input.projekty.length ? `<h3 style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#6B2AF0;margin:22px 0 8px;">${prelozitEmail(jazyk, 'mail.prehled.projekty')}</h3>` : ''}
    ${projekty}

    ${bonusy}

    ${input.poznamka ? `<p>${escapeHtml(input.poznamka).replace(/\n/g, '<br>')}</p>` : ''}

    <div class="cta-row">
      <a href="${escapeHtml(input.odkaz)}" class="cta">${prelozitEmail(jazyk, 'mail.prehled.otevritVykazy')}</a>
    </div>

    <p class="small">${prelozitEmailS(jazyk, 'mail.prehled.patka', { den })}</p>
  `,
  });
}

export async function sendMesicniPrehledEmail(input: MesicniPrehledInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };

  const jazyk = input.jazyk ?? 'cs';
  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmailS(jazyk, 'mail.prehled.predmet', { mesic: input.mesic }),
    text: [
      prelozitEmailS(jazyk, 'mail.prehled.textNadpis', { mesic: input.mesic }),
      '',
      prelozitEmailS(jazyk, 'mail.prehled.textOdpracovano', { hodiny: input.hodiny }),
      input.castkyViditelne !== false
        ? prelozitEmailS(jazyk, 'mail.prehled.textZaPraci', { castka: input.castka })
        : '',
      input.castkyViditelne !== false && input.bonusCelkem
        ? prelozitEmailS(jazyk, 'mail.prehled.textBonusy', { castka: input.bonusCelkem })
        : '',
      input.castkyViditelne !== false
        ? prelozitEmailS(jazyk, 'mail.prehled.textCelkem', { celkem: input.celkem })
        : '',
      '',
      input.druhy.length ? prelozitEmail(jazyk, 'mail.prehled.textPodleDruhu') : '',
      ...input.druhy.map((d) => `  ${d.nazev}: ${d.hodiny}${input.castkyViditelne !== false ? ` · ${d.castka}` : ''}`),
      input.projekty.length ? '' : '',
      input.projekty.length ? prelozitEmail(jazyk, 'mail.prehled.textProjekty') : '',
      ...input.projekty.map((p) => `  ${p.nazev}: ${p.hodiny}`),
      input.bonusy.length ? '' : '',
      input.bonusy.length ? prelozitEmail(jazyk, 'mail.prehled.textBonusySeznam') : '',
      ...input.bonusy.map((b) => `  ${b.nazev}: ${b.castka}`),
      input.poznamka ? '' : '',
      input.poznamka || '',
      '',
      prelozitEmail(jazyk, 'mail.prehled.textDny'),
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
  /** Jazyk PŘÍJEMCE (pravidlo 5). Nepovinně - bez něj čeština jako doteď. */
  jazyk?: Jazyk;
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

function pocetTerminu(n: number, jazyk: Jazyk = 'cs'): string {
  if (n === 1) return prelozitEmail(jazyk, 'mail.terminy.pocetJeden');
  if (n < 5) return prelozitEmailS(jazyk, 'mail.terminy.pocetMalo', { pocet: n });
  return prelozitEmailS(jazyk, 'mail.terminy.pocetMnoho', { pocet: n });
}

export function buildRecordingOfferHtml(input: RecordingOfferEmailInput): string {
  const jazyk = input.jazyk ?? 'cs';
  const pocet = pocetTerminu(input.requiredSessions, jazyk);
  // Pasmo zustava prazske - je to termin v prazskem studiu, ne cas ctenare.
  // Meni se jen jazyk, tedy i tvar data (britsky 13/09/2026).
  const den = new Intl.DateTimeFormat(kodJazyka(jazyk), { timeZone: 'Europe/Prague' });
  const obdobi = `${den.format(input.periodFrom)} – ${den.format(input.periodTo)}`;
  return emailShell({
    tag: prelozitEmail(jazyk, 'mail.terminy.stitek'),
    preheader: prelozitEmailS(jazyk, 'mail.terminy.preheader', { pocet, projekt: input.projectName }),
    body: `
    <span class="badge">${prelozitEmail(jazyk, 'mail.terminy.odznak')}</span>
    <h2>${escapeHtml(input.projectName)}</h2>
    <p>${escapeHtml(pozdravPosty(jazyk, input.actorName))}</p>
    <p>${prelozitEmailS(jazyk, 'mail.terminy.uvod', { pocet: `<strong>${escapeHtml(pocet)}</strong>` })}</p>

    <table role="presentation" class="field-table">
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.terminy.projekt')}</td><td class="value">${escapeHtml(input.projectName)}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.terminy.studio')}</td><td class="value regular">${escapeHtml(input.studioName)}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.terminy.obdobi')}</td><td class="value regular">${escapeHtml(obdobi)}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.terminy.vyberte')}</td><td class="value">${prelozitEmailS(jazyk, 'mail.terminy.vyberteHodnota', { pocet: escapeHtml(pocet), celkem: input.offeredCount })}</td></tr>
    </table>

    ${input.note ? `<p class="small"><strong>${prelozitEmail(jazyk, 'mail.terminy.poznamkaProdukce')}</strong> ${escapeHtml(input.note)}</p>` : ''}

    <div class="cta-row">
      <a href="${escapeHtml(input.offerUrl)}" class="cta">${prelozitEmail(jazyk, 'mail.terminy.tlacitko')}</a>
    </div>

    <p class="small">${prelozitEmail(jazyk, 'mail.terminy.patka')}</p>
  `,
  });
}

export async function sendRecordingOfferEmail(input: RecordingOfferEmailInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  const jazyk = input.jazyk ?? 'cs';
  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmailS(jazyk, 'mail.terminy.predmet', { projekt: input.projectName }),
    text: [
      pozdravPosty(jazyk, input.actorName),
      '',
      prelozitEmailS(jazyk, 'mail.terminy.textUvod', { projekt: input.projectName }),
      prelozitEmailS(jazyk, 'mail.terminy.textStudio', { studio: input.studioName }),
      prelozitEmailS(jazyk, 'mail.terminy.textVyberte', {
        pocet: input.requiredSessions,
        celkem: input.offeredCount,
      }),
      input.note ? prelozitEmailS(jazyk, 'mail.terminy.textPoznamka', { poznamka: input.note }) : '',
      '',
      prelozitEmail(jazyk, 'mail.terminy.textOdkaz'),
      input.offerUrl,
      '',
      prelozitEmail(jazyk, 'mail.terminy.textPatka'),
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
  /** Jazyk PŘÍJEMCE (pravidlo 5). Nepovinně - bez něj čeština jako doteď. */
  jazyk?: Jazyk;
  actorName: string;
  projectName: string;
  studioName: string;
  decision: 'CONFIRMED' | 'RETURNED' | 'REJECTED';
  note: string | null;
  /** Potvrzene terminy, uz naformatovane ("pondělí 14. 9. · 9:00–13:00"). */
  slots: string[];
  offerUrl: string;
  /**
   * Odkaz na potvrzené termíny ve formátu kalendáře (zadání 19. 9. 2026:
   * „tlačítko přidat do kalendáře a mu se to tam automaticky nasype").
   */
  calendarUrl?: string;
};

// Klice do slovniku posty, ne hotove vety - text se sklada az podle jazyka
// prijemce (davka 6).
const DECISION_TEXTS: Record<string, { tag: string; nadpis: string; uvod: string }> = {
  CONFIRMED: {
    tag: 'mail.rozhodnuti.potvrzeno.stitek',
    nadpis: 'mail.rozhodnuti.potvrzeno.nadpis',
    uvod: 'mail.rozhodnuti.potvrzeno.uvod',
  },
  RETURNED: {
    tag: 'mail.rozhodnuti.vraceno.stitek',
    nadpis: 'mail.rozhodnuti.vraceno.nadpis',
    uvod: 'mail.rozhodnuti.vraceno.uvod',
  },
  REJECTED: {
    tag: 'mail.rozhodnuti.zamitnuto.stitek',
    nadpis: 'mail.rozhodnuti.zamitnuto.nadpis',
    uvod: 'mail.rozhodnuti.zamitnuto.uvod',
  },
};

export function buildRecordingDecisionHtml(input: RecordingDecisionEmailInput): string {
  const jazyk = input.jazyk ?? 'cs';
  const t = DECISION_TEXTS[input.decision];
  const nadpis = prelozitEmail(jazyk, t.nadpis);
  const seznam = input.slots.length
    ? `<table role="presentation" class="field-table">${input.slots
        .map(
          (s) =>
            `<tr><td class="label">${prelozitEmail(jazyk, 'mail.rozhodnuti.termin')}</td><td class="value">${escapeHtml(s)}</td></tr>`,
        )
        .join('')}</table>`
    : '';

  return emailShell({
    tag: prelozitEmail(jazyk, t.tag),
    preheader: prelozitEmailS(jazyk, 'mail.rozhodnuti.preheader', { nadpis, projekt: input.projectName }),
    body: `
    <span class="badge">${escapeHtml(input.projectName)}</span>
    <h2>${escapeHtml(nadpis)}</h2>
    <p>${escapeHtml(pozdravPosty(jazyk, input.actorName))}</p>
    <p>${escapeHtml(prelozitEmail(jazyk, t.uvod))}</p>
    ${seznam}
    ${input.note ? `<p class="small"><strong>${prelozitEmail(jazyk, 'mail.rozhodnuti.vzkaz')}</strong> ${escapeHtml(input.note)}</p>` : ''}
    <p class="small">${prelozitEmailS(jazyk, 'mail.rozhodnuti.studio', { studio: escapeHtml(input.studioName) })}</p>
    ${
      input.decision === 'RETURNED'
        ? `<div class="cta-row"><a href="${escapeHtml(input.offerUrl)}" class="cta">${prelozitEmail(jazyk, 'mail.rozhodnuti.vybratZnovu')}</a></div>`
        : `<div class="cta-row"><a href="${escapeHtml(input.offerUrl)}" class="cta">${prelozitEmail(jazyk, 'mail.rozhodnuti.zobrazit')}</a></div>`
    }
    ${
      input.decision === 'CONFIRMED' && input.calendarUrl
        ? `<div class="cta-row"><a href="${escapeHtml(input.calendarUrl)}" class="cta-dark">${prelozitEmail(jazyk, 'mail.rozhodnuti.doKalendare')}</a></div>
    <p class="small">${prelozitEmail(jazyk, 'mail.rozhodnuti.oKalendari')}</p>`
        : ''
    }
  `,
  });
}

export async function sendRecordingDecisionEmail(input: RecordingDecisionEmailInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  const jazyk = input.jazyk ?? 'cs';
  const t = DECISION_TEXTS[input.decision];
  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmailS(jazyk, 'mail.rozhodnuti.predmet', {
      nadpis: prelozitEmail(jazyk, t.nadpis),
      projekt: input.projectName,
    }),
    text: [
      pozdravPosty(jazyk, input.actorName),
      '',
      prelozitEmail(jazyk, t.uvod),
      ...input.slots.map((s) => `- ${s}`),
      input.note ? `${prelozitEmail(jazyk, 'mail.rozhodnuti.vzkaz')} ${input.note}` : '',
      prelozitEmailS(jazyk, 'mail.rozhodnuti.studio', { studio: input.studioName }),
      '',
      input.offerUrl,
      input.decision === 'CONFIRMED' && input.calendarUrl
        ? prelozitEmailS(jazyk, 'mail.rozhodnuti.textKalendar', { odkaz: input.calendarUrl })
        : '',
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
  /** Jazyk PŘÍJEMCE (pravidlo 5). Nepovinně - bez něj čeština jako doteď. */
  jazyk?: Jazyk;
  recipientName: string;
  projectName: string;
  /**
   * Název stavu projektu z databáze - je ULOŽENÝ ČESKY a schválně se
   * nepřekládá (viz STAVY_PROJEKTU v lib/stavyProjektu.ts a docs, „Co dávka 5
   * nechala dalším dávkám").
   */
  statusName: string;
  rodnyListUrl: string;
  recordingsUrl: string;
};

export function buildRodnyListHtml(input: RodnyListEmailInput): string {
  const jazyk = input.jazyk ?? 'cs';
  return emailShell({
    tag: prelozitEmail(jazyk, 'mail.rodnyList.stitek'),
    preheader: prelozitEmailS(jazyk, 'mail.rodnyList.preheader', { projekt: input.projectName }),
    body: `
    <span class="badge">${escapeHtml(input.statusName)}</span>
    <h2>${escapeHtml(input.projectName)}</h2>
    <p>${escapeHtml(pozdravPosty(jazyk, input.recipientName))}</p>
    <p>${prelozitEmailS(jazyk, 'mail.rodnyList.uvod', {
      stav: `<strong>${escapeHtml(input.statusName)}</strong>`,
      rodnyList: `<strong>${prelozitEmail(jazyk, 'mail.rodnyList.termin')}</strong>`,
    })}</p>

    <table role="presentation" class="field-table">
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.rodnyList.projekt')}</td><td class="value">${escapeHtml(input.projectName)}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.rodnyList.stav')}</td><td class="value regular">${escapeHtml(input.statusName)}</td></tr>
    </table>

    <div class="cta-row">
      <a href="${escapeHtml(input.rodnyListUrl)}" class="cta">${prelozitEmail(jazyk, 'mail.rodnyList.otevrit')}</a>
    </div>

    <div class="cta-row">
      <a href="${escapeHtml(input.recordingsUrl)}" class="cta-dark">${prelozitEmail(jazyk, 'mail.rodnyList.naNahravky')}</a>
    </div>

    <p class="small">${prelozitEmail(jazyk, 'mail.rodnyList.patka')}</p>
  `,
  });
}

export async function sendRodnyListEmail(input: RodnyListEmailInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  const jazyk = input.jazyk ?? 'cs';
  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmailS(jazyk, 'mail.rodnyList.predmet', { projekt: input.projectName }),
    text: [
      pozdravPosty(jazyk, input.recipientName),
      '',
      prelozitEmailS(jazyk, 'mail.rodnyList.textUvod', {
        projekt: input.projectName,
        stav: input.statusName,
      }),
      '',
      prelozitEmail(jazyk, 'mail.rodnyList.textRodnyList'),
      input.rodnyListUrl,
      '',
      prelozitEmail(jazyk, 'mail.rodnyList.textNahravky'),
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
   * Jazyk PŘÍJEMCE (pravidlo 5). Nepovinně - bez něj čeština jako doteď.
   *
   * Týká se JEN obalu (tlačítka, patička, shrnutí AudioTaggeru). Nadpis,
   * předmět i tělo zprávy si píše produkce ve vzoru a jsou v databázi -
   * ty jdou ven tak, jak jsou napsané.
   */
  jazyk?: Jazyk;
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
   * Tlačítko „Spot schvaluji" (zadání 18. 9. 2026). Posílá se jen u reklamy
   * a jen ve stavu, kdy klient spot schvaluje - vede na stránku s nahrávkami,
   * kde je schvalovací karta. Samotný odkaz nic nepřeklápí; schvaluje se až
   * kliknutím na stránce, jinak by spot odklepl první antivir, který si
   * odkaz z mailu otevře.
   */
  odkazNaSchvaleni?: string | null;
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
  const jazyk = input.jazyk ?? 'cs';
  const tlacitka: string[] = [];
  if (input.odkazNaPreposlech) {
    tlacitka.push(
      `<a href="${escapeHtml(input.odkazNaPreposlech)}" class="cta">${prelozitEmail(jazyk, 'mail.stav.preposlechnout')}</a>`,
    );
  }
  if (input.odkazNaDisk) {
    // Popisek od produkce je jeji text - neprekladame ho, jen nahradni tvar.
    tlacitka.push(
      `<a href="${escapeHtml(input.odkazNaDisk)}" class="${
        input.odkazNaPreposlech ? 'cta-dark' : 'cta'
      }">${escapeHtml(input.popisekOdkazu?.trim() || prelozitEmail(jazyk, 'mail.stav.stahnoutZeSlozky'))}</a>`,
    );
  }
  if (input.odkazNaSchvaleni) {
    // Schvaleni je posledni - napred si to klient ma poslechnout.
    tlacitka.push(
      `<a href="${escapeHtml(input.odkazNaSchvaleni)}" class="cta">${prelozitEmail(jazyk, 'mail.stav.schvalit')}</a>`,
    );
  }
  // Kazde tlacitko na svem radku - na telefonu by se vedle sebe nevesla.
  const tlacitko = tlacitka.length
    ? `<table role="presentation">${tlacitka
        .map((odkaz) => `<tr><td style="padding-bottom:10px;">${odkaz}</td></tr>`)
        .join('')}</table>`
    : `<p style="color:#6C6580;">${prelozitEmail(jazyk, 'mail.stav.bezOdkazu')}</p>`;

  const interniPoznamka = input.jenInterne
    ? `<p style="background:#F3EEFF;border-radius:10px;padding:10px 14px;font-size:13px;">${prelozitEmail(jazyk, 'mail.stav.interniZprava')}</p>`
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
        <p class="t-title" style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6B2AF0;">${prelozitEmail(jazyk, 'mail.stav.taggerNadpis')}</p>
        <table role="presentation" class="steps t-steps" width="100%">
          <tr><td class="num" style="background:#F7F5FF;color:#6B2AF0;font-weight:700;width:24px;">1</td><td style="background:#F7F5FF;">${prelozitEmail(jazyk, 'mail.stav.taggerKrok1')}</td></tr>
          <tr><td class="num" style="background:#F7F5FF;color:#6B2AF0;font-weight:700;width:24px;">2</td><td style="background:#F7F5FF;">${prelozitEmail(jazyk, 'mail.stav.taggerKrok2')}</td></tr>
          <tr><td class="num" style="background:#F7F5FF;color:#6B2AF0;font-weight:700;width:24px;">3</td><td style="background:#F7F5FF;">${prelozitEmail(jazyk, 'mail.stav.taggerKrok3')}</td></tr>
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
    tag: input.predmet?.trim() || prelozitEmailS(jazyk, 'mail.stav.stitek', { stav: input.stav }),
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

  const jazyk = input.jazyk ?? 'cs';
  const skryta = (input.skrytaKopie ?? []).filter((e) => !input.prijemci.includes(e));

  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.prijemci.join(', '),
    // Nase adresy jen ve skryte kopii - viz skrytaKopie v typu vys.
    bcc: skryta.length > 0 ? skryta.join(', ') : undefined,
    subject:
      input.predmet?.trim() ||
      prelozitEmailS(jazyk, 'mail.stav.predmet', { projekt: input.nazevProjektu, stav: input.stav }),
    text: [
      input.jenInterne ? prelozitEmail(jazyk, 'mail.stav.textInterni') : '',
      input.uvod?.trim() || '',
      // Osloveni i nazev projektu uz jsou soucasti textu ze vzoru
      // (zadani 15. 9. 2026). Znacky formatovani v prostem textu nemaji smysl.
      bezZnacek(input.text),
      '',
      input.odkazNaPreposlech
        ? prelozitEmailS(jazyk, 'mail.stav.textPreposlech', { odkaz: input.odkazNaPreposlech })
        : '',
      input.odkazNaPreposlech ? prelozitEmail(jazyk, 'mail.stav.textTagger') : '',
      input.odkazNaDisk
        ? `${input.popisekOdkazu?.trim() || prelozitEmail(jazyk, 'mail.stav.textSlozka')}: ${input.odkazNaDisk}`
        : prelozitEmail(jazyk, 'mail.stav.textBezOdkazu'),
      input.odkazNaSchvaleni
        ? prelozitEmailS(jazyk, 'mail.stav.textSchvalit', { odkaz: input.odkazNaSchvaleni })
        : '',
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
  /** Jazyk PŘÍJEMCE (pravidlo 5). Nepovinně - bez něj čeština jako doteď. */
  jazyk?: Jazyk;
  /** Komu píšeme - herci jménem, firmě názvem. */
  jmeno: string | null;
  druh: 'HEREC' | 'FIRMA';
  odkaz: string;
  /** Do kdy odkaz platí, už naformátované („15. 10. 2026"). */
  platiDo: string;
  /** Proč to posíláme - napíše se to do mailu, když je to vyplněné. */
  poznamka?: string | null;
};

function vetaOZadosti(druh: 'HEREC' | 'FIRMA', jazyk: Jazyk = 'cs'): string {
  return prelozitEmail(jazyk, druh === 'HEREC' ? 'mail.udaje.zadostHerec' : 'mail.udaje.zadostFirma');
}

export function buildPozvankaUdajuHtml(input: PozvankaUdajuInput): string {
  const jazyk = input.jazyk ?? 'cs';
  return emailShell({
    tag: prelozitEmail(jazyk, 'mail.udaje.stitek'),
    preheader: prelozitEmail(jazyk, 'mail.udaje.preheader'),
    body: `
    <p>${escapeHtml(pozdravPosty(jazyk, input.jmeno))}</p>
    <p>${escapeHtml(vetaOZadosti(input.druh, jazyk))}</p>
    ${input.poznamka ? `<p>${escapeHtml(input.poznamka)}</p>` : ''}

    <div class="cta-row">
      <a href="${escapeHtml(input.odkaz)}" class="cta">${prelozitEmail(jazyk, 'mail.udaje.tlacitko')}</a>
    </div>

    <p class="small">${prelozitEmailS(jazyk, 'mail.udaje.patka', { platiDo: escapeHtml(input.platiDo) })}</p>
`,
  });
}

export async function sendPozvankaUdajuEmail(input: PozvankaUdajuInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (!input.to) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };

  const jazyk = input.jazyk ?? 'cs';
  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmail(jazyk, 'mail.udaje.predmet'),
    text: [
      pozdravPosty(jazyk, input.jmeno),
      '',
      vetaOZadosti(input.druh, jazyk),
      ...(input.poznamka ? ['', input.poznamka] : []),
      '',
      input.odkaz,
      '',
      prelozitEmailS(jazyk, 'mail.udaje.textPlatiDo', { platiDo: input.platiDo }),
    ].join('\n'),
    html: buildPozvankaUdajuHtml(input),
  });

  return { sent: true as const, reason: undefined };
}

export type VyplneneUdajeInput = {
  to: string;
  /** Jazyk PŘÍJEMCE (pravidlo 5). Nepovinně - bez něj čeština jako doteď. */
  jazyk?: Jazyk;
  jmenoPrijemce: string | null;
  /** Kdo údaje vyplnil. */
  kdo: string;
  /** Je to rovnou v portálu, nebo to čeká na odkliknutí? */
  hotovo: boolean;
  kolikCeka: number;
  odkaz: string;
};

function vetaOVyplneni(input: VyplneneUdajeInput): string {
  const jazyk = input.jazyk ?? 'cs';
  if (input.hotovo) return prelozitEmailS(jazyk, 'mail.udaje.vyplnenoHotovo', { kdo: input.kdo });
  return input.kolikCeka === 1
    ? prelozitEmailS(jazyk, 'mail.udaje.vyplnenoCekaJeden', { kdo: input.kdo })
    : prelozitEmailS(jazyk, 'mail.udaje.vyplnenoCekaVice', { kdo: input.kdo, pocet: input.kolikCeka });
}

export function buildVyplneneUdajeHtml(input: VyplneneUdajeInput): string {
  const jazyk = input.jazyk ?? 'cs';
  return emailShell({
    tag: prelozitEmail(jazyk, input.hotovo ? 'mail.udaje.stitekHotovo' : 'mail.udaje.stitekCeka'),
    preheader: prelozitEmailS(jazyk, 'mail.udaje.preheaderVyplnil', { kdo: input.kdo }),
    body: `
    <p>${escapeHtml(pozdravPosty(jazyk, input.jmenoPrijemce))}</p>
    <p>${escapeHtml(vetaOVyplneni(input))}</p>

    <div class="cta-row">
      <a href="${escapeHtml(input.odkaz)}" class="cta">${prelozitEmail(jazyk, input.hotovo ? 'mail.udaje.zobrazit' : 'mail.udaje.odkliknout')}</a>
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
    subject: prelozitEmailS(
      input.jazyk ?? 'cs',
      input.hotovo ? 'mail.udaje.predmetHotovo' : 'mail.udaje.predmetCeka',
      { kdo: input.kdo },
    ),
    text: [
      pozdravPosty(input.jazyk ?? 'cs', input.jmenoPrijemce),
      '',
      vetaOVyplneni(input),
      '',
      input.odkaz,
    ].join('\n'),
    html: buildVyplneneUdajeHtml(input),
  });

  return { sent: true as const, reason: undefined };
}

/* ==========================================================================
   POSLUCHAČI PŘEPOSLECHU (zadání 21. 9. 2026: „když chci někomu delegovat
   přeposlech ... těm lidem pak nastavíme podle mailu i notifikace, že tam
   přibyly nové tracky")
   ========================================================================== */

export type PreposlechPosluchaciInput = {
  to: string;
  /** Jazyk PŘÍJEMCE (pravidlo 5). Nepovinně - bez něj čeština jako doteď. */
  jazyk?: Jazyk;
  jmeno: string | null;
  nazevProjektu: string;
  odkaz: string;
};

export type PreposlechPredanInput = PreposlechPosluchaciInput & {
  /** Kdo přeposlech předal - jméno nebo e-mail. */
  kdo: string | null;
};

function vetaPredani(input: PreposlechPredanInput): string {
  const jazyk = input.jazyk ?? 'cs';
  return input.kdo
    ? prelozitEmailS(jazyk, 'mail.preposlech.predalVam', { kdo: input.kdo, projekt: input.nazevProjektu })
    : prelozitEmailS(jazyk, 'mail.preposlech.dostavate', { projekt: input.nazevProjektu });
}

export function buildPreposlechPredanHtml(input: PreposlechPredanInput): string {
  const jazyk = input.jazyk ?? 'cs';
  return emailShell({
    tag: prelozitEmail(jazyk, 'mail.preposlech.stitek'),
    preheader: prelozitEmailS(jazyk, 'mail.preposlech.preheader', { projekt: input.nazevProjektu }),
    body: `
    <p>${escapeHtml(pozdravPosty(jazyk, input.jmeno))}</p>
    <p>${escapeHtml(vetaPredani(input))}</p>
    <p>${prelozitEmail(jazyk, 'mail.preposlech.jakTo')}</p>

    <div class="cta-row">
      <a href="${escapeHtml(input.odkaz)}" class="cta">${prelozitEmail(jazyk, 'mail.preposlech.tlacitko')}</a>
    </div>

    <p class="small">${prelozitEmail(jazyk, 'mail.preposlech.patka')}</p>
`,
  });
}

export async function sendPreposlechPredanEmail(input: PreposlechPredanInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (!input.to) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };
  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmailS(input.jazyk ?? 'cs', 'mail.preposlech.predmet', { projekt: input.nazevProjektu }),
    text: [pozdravPosty(input.jazyk ?? 'cs', input.jmeno), '', vetaPredani(input), '', input.odkaz].join('\n'),
    html: buildPreposlechPredanHtml(input),
  });
  return { sent: true as const, reason: undefined };
}

export type NoveStopyInput = PreposlechPosluchaciInput & {
  pribylo: number;
  celkem: number;
};

function vetaNoveStopy(input: NoveStopyInput): string {
  const jazyk = input.jazyk ?? 'cs';
  const kolik =
    input.pribylo === 1
      ? prelozitEmail(jazyk, 'mail.stopy.pocetJedna')
      : input.pribylo < 5
        ? prelozitEmailS(jazyk, 'mail.stopy.pocetMalo', { pocet: input.pribylo })
        : prelozitEmailS(jazyk, 'mail.stopy.pocetMnoho', { pocet: input.pribylo });
  return prelozitEmailS(jazyk, 'mail.stopy.veta', {
    projekt: input.nazevProjektu,
    kolik,
    celkem: input.celkem,
  });
}

export function buildNoveStopyHtml(input: NoveStopyInput): string {
  const jazyk = input.jazyk ?? 'cs';
  return emailShell({
    tag: prelozitEmail(jazyk, 'mail.stopy.stitek'),
    preheader: vetaNoveStopy(input),
    body: `
    <p>${escapeHtml(pozdravPosty(jazyk, input.jmeno))}</p>
    <p>${escapeHtml(vetaNoveStopy(input))}</p>

    <div class="cta-row">
      <a href="${escapeHtml(input.odkaz)}" class="cta">${prelozitEmail(jazyk, 'mail.stopy.tlacitko')}</a>
    </div>

    <p class="small">${prelozitEmail(jazyk, 'mail.stopy.patka')}</p>
`,
  });
}

export async function sendNoveStopyEmail(input: NoveStopyInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (!input.to) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };
  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmailS(input.jazyk ?? 'cs', 'mail.stopy.predmet', { projekt: input.nazevProjektu }),
    text: [pozdravPosty(input.jazyk ?? 'cs', input.jmeno), '', vetaNoveStopy(input), '', input.odkaz].join('\n'),
    html: buildNoveStopyHtml(input),
  });
  return { sent: true as const, reason: undefined };
}

/**
 * ODPOVĚĎ NA DOTAZ KLIENTA (zadání 25. 9. 2026: „kdyby klient dostal
 * notifikace, když mu v jeho profilu odpoví někdo v chatu, že tam má
 * nepřečtenou zprávu").
 *
 * Mail říká, že odpověď přišla, a nic víc: ukázka je krátká a celý rozhovor
 * je za odkazem v portálu. Kdo o odpovědi ví a přijde si ji přečíst, další
 * mail nedostane - o to se stará lib/dotazyOznameniServer.ts.
 */
export type NovaOdpovedKlientoviInput = {
  to: string;
  /** Jazyk PŘÍJEMCE (pravidlo 5). Nepovinně - bez něj čeština jako doteď. */
  jazyk?: Jazyk;
  jmeno: string | null;
  nazevProjektu: string;
  odKoho: string;
  /** Pár slov ze zprávy; prázdné u samotné přílohy. */
  nahled: string | null;
  odkaz: string;
};

function vetaOdpovedi(input: NovaOdpovedKlientoviInput): string {
  return prelozitEmailS(input.jazyk ?? 'cs', 'mail.odpoved.veta', {
    odKoho: input.odKoho,
    projekt: input.nazevProjektu,
  });
}

export function buildNovaOdpovedKlientoviHtml(input: NovaOdpovedKlientoviInput): string {
  const jazyk = input.jazyk ?? 'cs';
  return emailShell({
    tag: prelozitEmail(jazyk, 'mail.odpoved.stitek'),
    preheader: vetaOdpovedi(input),
    body: `
    <p>${escapeHtml(pozdravPosty(jazyk, input.jmeno))}</p>
    <p>${escapeHtml(vetaOdpovedi(input))}</p>
    ${input.nahled ? `<blockquote>${escapeHtml(input.nahled)}</blockquote>` : ''}

    <div class="cta-row">
      <a href="${escapeHtml(input.odkaz)}" class="cta">${prelozitEmail(jazyk, 'mail.odpoved.tlacitko')}</a>
    </div>

    <p class="small">${prelozitEmail(jazyk, 'mail.odpoved.patka')}</p>
`,
  });
}

export async function sendNovaOdpovedKlientoviEmail(input: NovaOdpovedKlientoviInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (!input.to) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };
  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: prelozitEmailS(input.jazyk ?? 'cs', 'mail.odpoved.predmet', { projekt: input.nazevProjektu }),
    text: [
      pozdravPosty(input.jazyk ?? 'cs', input.jmeno),
      '',
      vetaOdpovedi(input),
      input.nahled ?? '',
      '',
      input.odkaz,
    ]
      .filter((r) => r !== null)
      .join('\n'),
    html: buildNovaOdpovedKlientoviHtml(input),
  });
  return { sent: true as const, reason: undefined };
}

/* ==========================================================================
   UPOMÍNKA K FAKTURĚ PO SPLATNOSTI (zadání 25. 9. 2026)
   ========================================================================== */

export type UpominkaInput = {
  to: string;
  /**
   * Jazyk PŘÍJEMCE (pravidlo 5). Nepovinně - bez něj čeština jako doteď.
   *
   * Řídí JEN obal: štítek v hlavičce, popisky v tabulce a tlačítko. PŘEDMĚT
   * ANI TĚLO SE NEPŘEKLÁDAJÍ - to si píše uživatel ve Vzoru upomínky
   * v administraci a je to uložené v databázi tak, jak to napsal.
   */
  jazyk?: Jazyk;
  kopie?: string[];
  /** Hotový předmět i text - proměnné dosazuje lib/upominkyServer.ts. */
  predmet: string;
  text: string;
  cisloFaktury: string;
  castka: string;
  splatnost: string | null;
  /** Kolikátá upomínka; do hlavičky mailu se nepíše, je jen pro nás. */
  poradi: number;
  /** Odkaz na PDF/portál, když ho máme. */
  odkaz?: string | null;
};

export function buildUpominkaHtml(input: UpominkaInput): string {
  const jazyk = input.jazyk ?? 'cs';
  // Text píše produkce ve Vzoru upomínky - escapuje se a teprve pak se z
  // povolených značek udělá HTML, stejně jako u zpráv o stavu projektu.
  // NEPŘEKLÁDÁ SE: je to text z databáze, ne z kódu.
  const odstavce = input.text
    .split(/\n{2,}/)
    .map((o) => `<p>${znackyNaHtml(escapeHtml(o).replace(/\n/g, '<br />'))}</p>`)
    .join('');

  return emailShell({
    tag: prelozitEmail(jazyk, 'mail.upominka.stitek'),
    preheader: prelozitEmailS(jazyk, 'mail.upominka.preheader', { cislo: input.cisloFaktury }),
    body: `
    <span class="badge">${prelozitEmailS(jazyk, 'mail.upominka.odznak', { cislo: escapeHtml(input.cisloFaktury) })}</span>
    ${odstavce}

    <table role="presentation" class="field-table">
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.upominka.cisloFaktury')}</td><td class="value">${escapeHtml(input.cisloFaktury)}</td></tr>
      <tr><td class="label">${prelozitEmail(jazyk, 'mail.upominka.kUhrade')}</td><td class="value">${escapeHtml(input.castka)}</td></tr>
      ${input.splatnost ? `<tr><td class="label">${prelozitEmail(jazyk, 'mail.upominka.splatnost')}</td><td class="value">${escapeHtml(input.splatnost)}</td></tr>` : ''}
    </table>

    ${input.odkaz ? `<div class="cta-row"><a href="${escapeHtml(input.odkaz)}" class="cta">${prelozitEmail(jazyk, 'mail.upominka.tlacitko')}</a></div>` : ''}
`,
  });
}

export async function sendUpominkaEmail(input: UpominkaInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (!input.to) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };
  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    // Kopie chodí skrytě - klient nemá vidět, kdo u nás na platbu čeká.
    ...(input.kopie && input.kopie.length > 0 ? { bcc: input.kopie } : {}),
    // Předmět i prostý text jdou ze Vzoru upomínky v databázi - viz typ výš.
    // Nepřekládají se, jazyk příjemce řídí jen obal v buildUpominkaHtml.
    subject: input.predmet,
    text: `${bezZnacek(input.text)}\n\n${input.odkaz ?? ''}`.trim(),
    html: buildUpominkaHtml(input),
  });
  return { sent: true as const, reason: undefined };
}

// ---------------------------------------------------------------------------
// Rezervace studia - zpravy klientovi (zadani 25. 9. 2026: „pod kliknutim na
// jmeno by mel jit nastavit osobni profil a ruzne notifikace, zmeny terminu
// a pod")
// ---------------------------------------------------------------------------
//
// ANGLICKY, jako cely kalendar rezervaci: cte to muzikant z Londyna.
// Kdy ktera zprava chodi, rozhoduji tri prepinace na jeho uctu
// (User.bookingMail*) - tady se jen sklada text.

export type DruhZpravyStudia = 'POTVRZENI' | 'ZMENA' | 'ZRUSENI' | 'PRIPOMINKA';

export type StudioBookingEmailInput = {
  to: string;
  name: string | null;
  druh: DruhZpravyStudia;
  /** Nazev studia, napr. „MS Studio - London". */
  studio: string;
  /** Kdy to zacina a konci - uz slozene v pasmu studia. */
  kdy: string;
  nazev: string;
  poznamka?: string | null;
  /** Puvodni termin u presunu. */
  puvodne?: string | null;
  /**
   * VIC TERMINU V JEDNE ZPRAVE (zadani 28. 9. 2026: „aby mu nechodilo treba
   * deset mailu s notifikacema, kdyz to bude klikat po jednom terminu").
   *
   * Kdyz si clovek zabookuje nekolik oken najednou, odejde jeden mail se
   * seznamem. `kdy` v tom pripade nese souhrn do predmetu („4 sessions,
   * 14-18 Oct"), podrobnosti jsou tady.
   */
  terminy?: string[] | null;
};

const ZPRAVY_STUDIA: Record<
  DruhZpravyStudia,
  { tag: string; badge: string; heading: string; intro: string; subject: string }
> = {
  POTVRZENI: {
    tag: 'Studio booking',
    badge: 'Booked',
    heading: 'Your studio time is booked',
    intro: 'the studio is yours — here is what we have in the diary.',
    subject: 'Studio booked',
  },
  ZMENA: {
    tag: 'Studio booking',
    badge: 'Changed',
    heading: 'Your booking has moved',
    intro: 'we had to move your booking. Here is where it sits now — if it does not work, tell us and we will sort something out.',
    subject: 'Your studio booking has moved',
  },
  ZRUSENI: {
    tag: 'Studio booking',
    badge: 'Cancelled',
    heading: 'Your booking has been cancelled',
    intro: 'we have had to cancel this booking. Sorry about that — write to us and we will find you another slot.',
    subject: 'Your studio booking has been cancelled',
  },
  PRIPOMINKA: {
    tag: 'Studio booking',
    badge: 'Tomorrow',
    heading: 'See you in the studio tomorrow',
    intro: 'just a reminder of your session tomorrow.',
    subject: 'Your studio session tomorrow',
  },
};

function buildStudioBookingHtml(input: StudioBookingEmailInput): string {
  const copy = ZPRAVY_STUDIA[input.druh];
  const greeting = escapeHtml(input.name ? `Hello ${input.name},` : 'Hello,');
  const zaklad = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');

  return emailShell({
    tag: copy.tag,
    preheader: `${copy.heading} - ${input.kdy}`,
    body: `
    <span class="badge">${copy.badge}</span>
    <h2>${copy.heading}</h2>
    <p>${greeting}</p>
    <p>${copy.intro}</p>

    <table role="presentation" class="field-table">
      <tr><td class="label">Booking</td><td class="value">${escapeHtml(input.nazev)}</td></tr>
      ${
        input.terminy && input.terminy.length > 1
          ? input.terminy
              .map(
                (t, i) =>
                  `<tr><td class="label">${i === 0 ? 'When' : '&nbsp;'}</td><td class="value">${escapeHtml(t)}</td></tr>`,
              )
              .join('')
          : `<tr><td class="label">When</td><td class="value">${escapeHtml(input.kdy)}</td></tr>`
      }
      ${input.puvodne ? `<tr><td class="label">Previously</td><td class="value regular">${escapeHtml(input.puvodne)}</td></tr>` : ''}
      <tr><td class="label">Studio</td><td class="value regular">${escapeHtml(input.studio)}</td></tr>
      ${input.poznamka ? `<tr><td class="label">Your note</td><td class="value regular">${escapeHtml(input.poznamka)}</td></tr>` : ''}
    </table>

    <div class="cta-row">
      <a href="${zaklad}/studio" class="cta">Open the calendar</a>
    </div>
    <p class="small">You can turn these emails off under your name in the booking calendar.</p>
  `,
  });
}

export async function sendStudioBookingEmail(input: StudioBookingEmailInput) {
  const transport = getTransport();
  if (!transport) return { sent: false as const, reason: 'SMTP_NOT_CONFIGURED' };
  if (!input.to) return { sent: false as const, reason: 'ZADNY_PRIJEMCE' };

  const copy = ZPRAVY_STUDIA[input.druh];
  await transport.sendMail({
    ...odesilatelMediaspace(),
    to: input.to,
    subject: `${copy.subject} - ${input.kdy}`,
    text: [
      input.name ? `Hello ${input.name},` : 'Hello,',
      '',
      copy.intro,
      '',
      `Booking: ${input.nazev}`,
      ...(input.terminy && input.terminy.length > 1
        ? [`When:`, ...input.terminy.map((t) => `  ${t}`)]
        : [`When: ${input.kdy}`]),
      ...(input.puvodne ? [`Previously: ${input.puvodne}`] : []),
      `Studio: ${input.studio}`,
      '',
      `${(process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '')}/studio`,
    ].join('\n'),
    html: buildStudioBookingHtml(input),
  });
  return { sent: true as const, reason: undefined };
}


// ===========================================================================
// CENIK STUDIA (zadani 28. 9. 2026: „aby se pak dalo poslat nekomu PDF nebo
// stahnout")
//
// TEXT PISE CLOVEK, NE PORTAL. Ostatni maily portalu maji znen napevno,
// protoze jsou to doklady a notifikace - cenik je ale obchodni zprava a
// pokazde jina („posilam, jak jsme se bavili"). Formular proto posila predmet
// i telo jako text a sablona je jen obali do znacky Mediaspace; diky tomu tu
// taky nejsou zadne prekladove klice a cenik muze odejit anglicky, cesky nebo
// jakkoliv jinak, aniz by se kvuli tomu prekladal portal.
// ===========================================================================

type CenikEmailInput = {
  to: string;
  predmet: string;
  /** Telo zpravy, odstavce oddelene prazdnym radkem. */
  zprava: string;
  /** Na koho ma prijemce odpovedet - clovek, ktery cenik posila. */
  odpovedNa?: string | null;
  pdf?: { nazev: string; obsah: Buffer } | null;
};

export function buildCenikHtml(input: CenikEmailInput): string {
  const odstavce = input.zprava
    .split(/\n\s*\n/)
    .map((o) => o.trim())
    .filter(Boolean)
    .map((o) => `<p>${escapeHtml(o).replace(/\n/g, '<br />')}</p>`)
    .join('\n');

  return emailShell({
    tag: 'Price list',
    preheader: input.predmet,
    body: `
    ${odstavce}
    ${input.pdf ? '<p class="small">The price list is attached as a PDF.</p>' : ''}
  `,
  });
}

export async function sendCenikEmail(input: CenikEmailInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  await transport.sendMail({
    ...odesilatelMediaspace(input.odpovedNa ?? null),
    to: input.to,
    subject: input.predmet,
    text: input.zprava,
    html: buildCenikHtml(input),
    ...(input.pdf ? { attachments: [{ filename: input.pdf.nazev, content: input.pdf.obsah }] } : {}),
  });

  return { sent: true as const, reason: undefined };
}


// ===========================================================================
// POZVÁNKA NA NATÁČENÍ PRO HOSTA (zadání 30. 9. 2026: „u některých natáčení
// bývá klient. Buď osobně, nebo se propojuje přes link do daného studia.
// A potřebuju tam naházet i více lidí - maily, na které jim rovnou odejde
// pozvánka na natáčení, která bude obsahovat link pro natáčení online
// a adresu studia s mapkou a infem o parkování").
//
// JEDEN MAIL, DVĚ PODOBY. Kdo přijde do studia, čte nejdřív adresu, mapu
// a parkování; kdo se připojuje na dálku, čte nejdřív odkaz. Druhá půlka
// zůstává jako doplněk - host si to rozmyslí a nemusí psát, kde to je.
//
// PŘESUN TERMÍNU se posílá TÝMŽ mailem, jen s jiným nadpisem a předmětem.
// Vlastní šablona na změnu by se dřív nebo později rozešla s tou původní
// a host by dostal dvě různě vypadající zprávy o jedné věci.
// ===========================================================================

export type PozvankaNataceniInput = {
  to: string;
  jazyk?: Jazyk;
  hostName: string | null;
  projectName: string;
  /** „úterý 7. 10. 2026, 10:00–13:00" - skládá hosteNataceniServer. */
  kdy: string;
  studioName: string;
  adresa: string | null;
  mapaUrl: string | null;
  parkovani: string | null;
  hovorOdkaz: string | null;
  /** Host se připojuje na dálku. */
  online: boolean;
  /** Termín se posunul - jiný nadpis a předmět, jinak tentýž mail. */
  zmena: boolean;
  /** Soubor pro kalendář. */
  ics?: { nazev: string; obsah: string } | null;
  /** Odpovědi mají chodit produkci, ne do prázdna. */
  odpovedNa?: string | null;
};

function pozvankaKdeBlok(input: PozvankaNataceniInput, jazyk: Jazyk): string {
  const radky = [
    `<tr><td class="label">${prelozitEmail(jazyk, 'mail.pozvankaNataceni.kde')}</td><td class="value">${escapeHtml(
      [input.studioName, input.adresa?.trim()].filter(Boolean).join(' · '),
    )}</td></tr>`,
  ];
  if (input.parkovani?.trim()) {
    radky.push(
      `<tr><td class="label">${prelozitEmail(jazyk, 'mail.pozvankaNataceni.parkovani')}</td><td class="value">${escapeHtml(
        input.parkovani.trim(),
      )}</td></tr>`,
    );
  }
  return `<table role="presentation" class="field-table">${radky.join('')}</table>`;
}

export function buildPozvankaNataceniHtml(input: PozvankaNataceniInput): string {
  const jazyk = input.jazyk ?? 'cs';
  const mapa = odkazNaMapu(input.adresa, input.mapaUrl);

  const kdyBlok = `<table role="presentation" class="field-table">
    <tr><td class="label">${prelozitEmail(jazyk, 'mail.pozvankaNataceni.kdy')}</td><td class="value">${escapeHtml(input.kdy)}</td></tr>
    <tr><td class="label">${prelozitEmail(jazyk, 'mail.pozvankaNataceni.projekt')}</td><td class="value">${escapeHtml(input.projectName)}</td></tr>
  </table>`;

  const online = input.hovorOdkaz
    ? `<div class="cta-row"><a href="${escapeHtml(input.hovorOdkaz)}" class="cta">${prelozitEmail(
        jazyk,
        'mail.pozvankaNataceni.pripojitSe',
      )}</a></div>
    <p class="small">${prelozitEmail(jazyk, 'mail.pozvankaNataceni.odkazPlati')}</p>`
    : '';

  const misto = `${pozvankaKdeBlok(input, jazyk)}${
    mapa
      ? `<div class="cta-row"><a href="${escapeHtml(mapa)}" class="cta-dark">${prelozitEmail(
          jazyk,
          'mail.pozvankaNataceni.otevritMapu',
        )}</a></div>`
      : ''
  }`;

  // Co host potřebuje první, je nahoře - viz komentář nad typem.
  const telo = input.online ? `${online}${misto}` : `${misto}${online}`;

  return emailShell({
    jazyk,
    tag: prelozitEmail(jazyk, 'mail.pozvankaNataceni.stitek'),
    preheader: prelozitEmailS(jazyk, 'mail.pozvankaNataceni.preheader', {
      kdy: input.kdy,
      studio: input.studioName,
    }),
    body: `
    <span class="badge">${escapeHtml(input.projectName)}</span>
    <h2>${escapeHtml(
      prelozitEmail(jazyk, input.zmena ? 'mail.pozvankaNataceni.nadpisZmena' : 'mail.pozvankaNataceni.nadpis'),
    )}</h2>
    <p>${escapeHtml(pozdravPosty(jazyk, input.hostName))}</p>
    <p>${escapeHtml(
      prelozitEmail(
        jazyk,
        input.zmena
          ? 'mail.pozvankaNataceni.uvodZmena'
          : input.online
            ? 'mail.pozvankaNataceni.uvodOnline'
            : 'mail.pozvankaNataceni.uvodOsobne',
      ),
    )}</p>
    ${kdyBlok}
    ${telo}
    ${input.ics ? `<p class="small">${prelozitEmail(jazyk, 'mail.pozvankaNataceni.kalendar')}</p>` : ''}
    <p class="small">${prelozitEmail(jazyk, 'mail.pozvankaNataceni.kdyzNeco')}</p>
  `,
  });
}

export async function sendPozvankaNataceniEmail(input: PozvankaNataceniInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  const jazyk = input.jazyk ?? 'cs';
  const mapa = odkazNaMapu(input.adresa, input.mapaUrl);

  await transport.sendMail({
    ...odesilatelMediaspace(input.odpovedNa ?? null),
    to: input.to,
    subject: prelozitEmailS(jazyk, input.zmena ? 'mail.pozvankaNataceni.predmetZmena' : 'mail.pozvankaNataceni.predmet', {
      projekt: input.projectName,
      kdy: input.kdy,
    }),
    text: [
      pozdravPosty(jazyk, input.hostName),
      '',
      prelozitEmail(
        jazyk,
        input.zmena
          ? 'mail.pozvankaNataceni.uvodZmena'
          : input.online
            ? 'mail.pozvankaNataceni.uvodOnline'
            : 'mail.pozvankaNataceni.uvodOsobne',
      ),
      '',
      `${prelozitEmail(jazyk, 'mail.pozvankaNataceni.kdy')}: ${input.kdy}`,
      `${prelozitEmail(jazyk, 'mail.pozvankaNataceni.projekt')}: ${input.projectName}`,
      `${prelozitEmail(jazyk, 'mail.pozvankaNataceni.kde')}: ${[input.studioName, input.adresa?.trim()]
        .filter(Boolean)
        .join(' · ')}`,
      input.parkovani?.trim() ? `${prelozitEmail(jazyk, 'mail.pozvankaNataceni.parkovani')}: ${input.parkovani.trim()}` : '',
      mapa ? `${prelozitEmail(jazyk, 'mail.pozvankaNataceni.otevritMapu')}: ${mapa}` : '',
      input.hovorOdkaz ? `${prelozitEmail(jazyk, 'mail.pozvankaNataceni.pripojitSe')}: ${input.hovorOdkaz}` : '',
      '',
      prelozitEmail(jazyk, 'mail.pozvankaNataceni.kdyzNeco'),
    ]
      .filter(Boolean)
      .join('\n'),
    html: buildPozvankaNataceniHtml(input),
    /**
     * Příloha jde jako `text/calendar`, ne jako obyčejný soubor - jinak ji
     * Outlook i Apple Mail ukážou jako přílohu ke stažení místo termínu,
     * který jde uložit jedním klepnutím.
     *
     * METHOD:PUBLISH, ne REQUEST - portál se hosta neptá, jestli přijde
     * (to není pozvánka k odsouhlasení, ale sdělení termínu), a REQUEST
     * v hlavičce u kalendáře bez ORGANIZERa a ATTENDEE dělá zmatek.
     */
    ...(input.ics
      ? {
          attachments: [
            {
              filename: input.ics.nazev,
              content: input.ics.obsah,
              contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
            },
          ],
        }
      : {}),
  });

  return { sent: true as const };
}
