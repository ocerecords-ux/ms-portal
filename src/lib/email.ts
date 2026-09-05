import nodemailer from 'nodemailer';

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
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
  .email-hero .tag { font-family: Helvetica, Arial, sans-serif; color: #C9FFDF !important; font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; margin-top: 16px; }
  .email-hero .bar { height: 3px; width: 46px; background: #1FDF67 !important; border-radius: 2px; margin-top: 14px; }
  .email-content { padding: 30px 32px 8px; font-family: Helvetica, Arial, sans-serif; background: #FFFFFF !important; color: #201A33 !important; }
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
      <tr><td class="label">Předběžná cena</td><td class="value">${priceText}</td></tr>
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
    `Predbezna cena: ${input.priceEstimate != null ? input.priceEstimate + ' Kc' : '-'}`,
    `Datum odevzdani: ${input.deadline ?? '-'}`,
    `Preferovany herec: ${input.preferredNarrator ?? '-'}`,
    `Poznamka: ${input.note ?? '-'}`,
    `Priloha: ${input.attachmentUrl ?? 'zadna'}`,
    `Jmeno: ${input.requestedByName ?? '-'}`,
    `Objednal: ${input.requestedByEmail}`,
  ].join('\n');
}

// POZOR: v teto fazi jde tento e-mail VYHRADNE interne timu Mediaspace
// (viz ORDER_NOTIFICATION_EMAIL) - klientska potvrzovaci sablona je
// navrzena (schvaleno 4. 9. 2026), ale zamerne jeste NENI zapojena.
export async function sendOrderNotificationEmail(input: OrderEmailInput) {
  const transport = getTransport();
  const to = process.env.ORDER_NOTIFICATION_EMAIL || 'objednavky@mediaspace.cz';

  if (!transport) {
    // SMTP zatim neni nakonfigurovane - objednavka se presto ulozi,
    // jen se neodesle e-mail. Volajici kod tuto informaci zaloguje.
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'MS Portal <portal@msportal.cz>',
    to,
    subject: `Objednávka audioknihy – ${input.title}`,
    text: buildInternalNotificationText(input),
    html: buildInternalNotificationHtml(input),
  });

  return { sent: true as const };
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
  .hero .word { font-family: Helvetica, Arial, sans-serif; font-size: 21px; font-weight: 700; color: #1FDF67 !important; letter-spacing: 0.01em; padding-right: 14px; }
  .hero .rule { display: inline-block; width: 1px; height: 26px; background: rgba(255,255,255,0.4) !important; }
  .hero .tag { font-family: Helvetica, Arial, sans-serif; color: #C9FFDF !important; font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; padding-top: 18px; }
  .hero .bar { height: 3px; width: 46px; background: #1FDF67 !important; border-radius: 2px; margin-top: 12px; }
  .content { padding: 30px 34px 10px; font-family: Helvetica, Arial, sans-serif; background: #FFFFFF !important; color: #201A33 !important; }
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
  .steps td { font-family: Helvetica, Arial, sans-serif; font-size: 13.5px; color: #201A33 !important; padding: 0 0 10px; background: #FFFFFF !important; }
  .steps .num { width: 26px; color: #6B2AF0 !important; font-weight: 700; }
  .footer { padding: 18px 34px 26px; border-top: 1px solid #E4DFFB; background: #FFFFFF !important; }
  .footer p { margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 11.5px; line-height: 1.6; color: #6E6580 !important; }
  .footer .brand { color: #6B2AF0 !important; font-weight: 600; }
  @media (prefers-color-scheme: dark) {
    body, .wrap { background: #FBFAFF !important; }
    .hero { background: #6B2AF0 !important; }
    .hero .word { color: #1FDF67 !important; }
    .hero .tag { color: #C9FFDF !important; }
    .content, .cta-row, .footer, .steps td, .field-table td { background: #FFFFFF !important; color: #201A33 !important; }
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
        <td class="word">MS portal</td>
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
      <p><span class="brand">Mediaspace</span> · MS Portal · <a href="${baseUrl}" style="color:#6B2AF0;text-decoration:none;">www.msportal.cz</a></p>
    </td></tr>
  </table>
</td></tr></table>
</body>
</html>`;
}

export function buildInviteHtml(input: InviteEmailInput): string {
  const greeting = input.name ? `Dobrý den, ${escapeHtml(input.name)},` : 'Dobrý den,';
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
    from: process.env.SMTP_FROM || 'MS Portal <portal@msportal.cz>',
    to: input.to,
    subject: input.audience === 'INTERNAL' ? 'Přístup do MS Portalu' : 'Pozvánka do MS Portalu',
    text: [
      input.name ? `Dobry den, ${input.name},` : 'Dobry den,',
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
// Interni notifikace na objednavky@mediaspace.cz zustava beze zmeny.

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
  const greeting = input.name ? `Dobrý den, ${escapeHtml(input.name)},` : 'Dobrý den,';
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
       <a href="mailto:objednavky@mediaspace.cz" style="color:#6B2AF0;text-decoration:none;">objednavky@mediaspace.cz</a>.</p>
  `,
  });
}

export async function sendOrderConfirmationEmail(input: OrderConfirmationInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'MS Portal <portal@msportal.cz>',
    to: input.to,
    replyTo: process.env.ORDER_NOTIFICATION_EMAIL || 'objednavky@mediaspace.cz',
    subject: `Potvrzení objednávky – ${input.title}`,
    text: [
      input.name ? `Dobry den, ${input.name},` : 'Dobry den,',
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
  const greeting = input.name ? `Dobrý den, ${escapeHtml(input.name)},` : 'Dobrý den,';
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

export async function sendPasswordResetEmail(input: PasswordResetInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'MS Portal <portal@msportal.cz>',
    to: input.to,
    subject: 'Nové heslo do MS Portalu',
    text: [
      input.name ? `Dobry den, ${input.name},` : 'Dobry den,',
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
