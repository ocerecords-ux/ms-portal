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

// HTML sablona interniho e-mailu (tym MEDIA SPACE) - schvaleny design, viz
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

// POZOR: v teto fazi jde tento e-mail VYHRADNE interne timu MEDIA SPACE
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

type InviteEmailInput = {
  to: string;
  name: string | null;
  inviteUrl: string;
  expiresAt: Date;
};

function buildInviteHtml(input: InviteEmailInput): string {
  const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
  const greeting = input.name ? `Dobrý den, ${escapeHtml(input.name)},` : 'Dobrý den,';
  const expiresText = input.expiresAt.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<style>
  :root { color-scheme: light only; supported-color-schemes: light; }
  body { margin: 0 !important; padding: 0 !important; background: #FBFAFF !important; }
  table { border-collapse: collapse; width: 100%; }
  .email-hero { background: #6B2AF0 !important; background: linear-gradient(135deg, #7B55FF, #6B2AF0) !important; padding: 28px 32px 24px; }
  .email-hero .word { display: block; height: 150px; width: 150px; }
  .email-hero .tag { font-family: Helvetica, Arial, sans-serif; color: #C9FFDF !important; font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; margin-top: 16px; }
  .email-hero .bar { height: 3px; width: 46px; background: #1FDF67 !important; border-radius: 2px; margin-top: 14px; }
  .email-content { padding: 30px 32px 8px; font-family: Helvetica, Arial, sans-serif; background: #FFFFFF !important; color: #201A33 !important; }
  .email-content h2 { font-size: 19px; margin: 0 0 14px; font-weight: 600; color: #201A33 !important; }
  .email-content p { font-size: 14px; line-height: 1.6; margin: 0 0 14px; color: #201A33 !important; }
  .email-content .small { font-size: 12px; color: #6E6580 !important; }
  .cta-row { padding: 8px 0 26px; background: #FFFFFF !important; }
  .cta { display: inline-block; background: #201A33 !important; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 22px; border-radius: 8px; }
  .email-footer { padding: 18px 32px 26px; border-top: 1px solid #E4DFFB; background: #FFFFFF !important; }
  .email-footer p { margin: 0; font-size: 11.5px; color: #6E6580 !important; }
  .email-footer .brand { color: #6B2AF0 !important; font-weight: 600; }
  @media (prefers-color-scheme: dark) {
    body { background: #FBFAFF !important; }
    .email-hero { background: #6B2AF0 !important; }
    .email-content, .cta-row, .email-footer { background: #FFFFFF !important; color: #201A33 !important; }
    .cta { background: #201A33 !important; color: #ffffff !important; }
  }
</style>
</head>
<body>
<table role="presentation">
  <tr><td class="email-hero">
    <img class="word" src="${baseUrl}${LOGO_GIF_PATH}" width="150" height="150" alt="Mediaspace" />
    <div class="tag">MS Portal - pozvánka</div>
    <div class="bar"></div>
  </td></tr>
  <tr><td class="email-content">
    <h2>Vítejte v MS Portalu</h2>
    <p>${greeting}</p>
    <p>založili jsme vám přístup do klientského portálu MEDIA SPACE. Přihlašovacím jménem je tento e-mail
       (<strong>${escapeHtml(input.to)}</strong>), heslo si nastavíte sami přes tlačítko níže.</p>
    <div class="cta-row">
      <a href="${escapeHtml(input.inviteUrl)}" class="cta">Nastavit heslo →</a>
    </div>
    <p class="small">Odkaz platí do ${expiresText}. Pokud vyprší, napište nám a pošleme vám nový.</p>
  </td></tr>
  <tr><td class="email-footer">
    <p><span class="brand">Mediaspace</span> · MS Portal</p>
  </td></tr>
</table>
</body>
</html>`;
}

export async function sendInviteEmail(input: InviteEmailInput) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'MS Portal <portal@msportal.cz>',
    to: input.to,
    subject: 'Pozvánka do MS Portalu',
    text: [
      input.name ? `Dobry den, ${input.name},` : 'Dobry den,',
      '',
      'zalozili jsme vam pristup do portalu MEDIA SPACE (MS Portal).',
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
