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

type OrderEmailInput = {
  companyName: string;
  title: string;
  pageCount: number | null;
  priceEstimate: number | null;
  deadline: string | null;
  note: string | null;
  attachmentUrl: string | null;
  requestedByEmail: string;
};

export async function sendOrderNotificationEmail(input: OrderEmailInput) {
  const transport = getTransport();
  const to = process.env.ORDER_NOTIFICATION_EMAIL || 'objednavky@mediaspace.cz';

  if (!transport) {
    // SMTP zatim neni nakonfigurovane - objednavka se presto ulozi,
    // jen se neodesle e-mail. Volajici kod tuto informaci zaloguje.
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' as const };
  }

  const lines = [
    `Nova objednavka audioknihy - ${input.companyName}`,
    '',
    `Nazev: ${input.title}`,
    `Pocet normostran: ${input.pageCount ?? '-'}`,
    `Predbezna cena: ${input.priceEstimate != null ? input.priceEstimate + ' Kc' : '-'}`,
    `Datum odevzdani: ${input.deadline ?? '-'}`,
    `Poznamka: ${input.note ?? '-'}`,
    `Priloha: ${input.attachmentUrl ?? 'zadna'}`,
    `Objednal: ${input.requestedByEmail}`,
  ];

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'MS Portal <portal@msportal.cz>',
    to,
    subject: `Objednávka audioknihy – ${input.companyName} – ${input.title}`,
    text: lines.join('\n'),
  });

  return { sent: true as const };
}
