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

// Zelena varianta wordmarku Mediaspace pouzita v hlavicce e-mailu (schvaleny
// design, viz e-mailovy mockup) - vlozena primo jako base64 data URI, aby
// obrazek fungoval spolehlive i v e-mailovych klientech, ktere blokuji
// externi obrazky.
const LOGO_BASE64 = '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';

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
<style>
  body { margin: 0; padding: 0; background: #FBFAFF; }
  table { border-collapse: collapse; width: 100%; }
  .email-hero { background: linear-gradient(135deg, #7B55FF, #6B2AF0); padding: 28px 32px 24px; }
  .email-hero .word { display: block; height: 30px; width: auto; }
  .email-hero .tag { font-family: Helvetica, Arial, sans-serif; color: #C9FFDF; font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; margin-top: 10px; }
  .email-hero .bar { height: 3px; width: 46px; background: #1FDF67; border-radius: 2px; margin-top: 14px; }
  .email-content { padding: 30px 32px 8px; font-family: Helvetica, Arial, sans-serif; color: #201A33; }
  .email-content h2 { font-size: 19px; margin: 0 0 14px; font-weight: 600; color: #201A33; }
  .badge { display: inline-block; background: #E9FFF2; color: #149E4B; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 4px 9px; border-radius: 999px; margin-bottom: 12px; }
  .field-table { border: 1px solid #E4DFFB; border-radius: 10px; overflow: hidden; margin: 4px 0 18px; }
  .field-table tr:not(:last-child) td { border-bottom: 1px solid #E4DFFB; }
  .field-table td { padding: 11px 14px; font-size: 13.5px; vertical-align: top; }
  .field-table td.label { color: #6E6580; width: 42%; background: #F6F6F6; font-weight: 500; }
  .field-table td.value { color: #201A33; font-weight: 600; }
  .field-table td.value.regular { font-weight: 400; }
  .field-table td.value a { color: #6B2AF0; text-decoration: none; font-weight: 600; }
  .cta-row { padding: 4px 0 26px; }
  .cta { display: inline-block; background: #201A33; color: #ffffff !important; text-decoration: none; font-size: 13.5px; font-weight: 600; padding: 11px 20px; border-radius: 8px; }
  .email-footer { padding: 18px 32px 26px; border-top: 1px solid #E4DFFB; }
  .email-footer p { margin: 0; font-size: 11.5px; color: #6E6580; }
  .email-footer .brand { color: #6B2AF0; font-weight: 600; }
</style>
</head>
<body>
<table role="presentation">
  <tr><td class="email-hero">
    <img class="word" src="data:image/png;base64,${LOGO_BASE64}" alt="Mediaspace" />
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
    subject: `Nová objednávka – ${input.companyName} – ${input.title}`,
    text: buildInternalNotificationText(input),
    html: buildInternalNotificationHtml(input),
  });

  return { sent: true as const };
}
