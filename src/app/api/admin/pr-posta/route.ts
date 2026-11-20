import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import nodemailer from 'nodemailer';

import { authOptions } from '@/lib/auth';
import { zkusOdeslatPod } from '@/lib/email';

/**
 * ZKOUŠEČKA PŘIHLÁŠENÍ KE SCHRÁNCE PR (20. 11. 2026).
 *
 * Odeslání z adresy Emy padalo na „535 authentication failed" a každá další
 * varianta (jiný port, jiný tvar jména) znamenala nové nasazení. Tohle se
 * jen PŘIHLÁSÍ a zase odejde - nic neposílá - a server, port i jméno si
 * vezme z adresy, takže se dá zkoušet rovnou.
 *
 * HESLO SE NIKDY NEPŘEDÁVÁ V ADRESE. Bere se vždycky z PR_SMTP_PASSWORD.
 *
 * SERVER JEN Z POVOLENÉHO SEZNAMU. Jinak by šlo tímhle odkazem poslat naše
 * heslo na cizí server - stačilo by napsat jiný host.
 *
 * POZOR NA GEO OCHRANU. Schránka na Business Mailu ji může mít zapnutou -
 * pak server pustí SMTP jen z vyjmenovaných zemí. Portál běží na Vercelu ve
 * Frankfurtu, takže se musí povolit i Německo; jinak přijde „535 authentication
 * failed" i se správným heslem a vypadá to na špatné heslo (20. 11. 2026).
 *
 * Jen pro Žůžo-labůžo a jen k ladění; až bude pošta chodit, může to zmizet.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const POVOLENE = [
  'email.active24.com',
  'smtp.active24.com',
  'mail.active24.com',
  'smtp.websupport.cz',
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  /**
   * ZKOUŠKA „ODESLAT POD JINOU ADRESOU" (20. 11. 2026). Naše hlavní schránka
   * se přihlašuje bez potíží; otázka je, jestli z ní server pustí mail
   * s adresou pr@mediaspace.cz v „Od". Když ano, nepotřebujeme přihlášení
   * ke schránce PR vůbec.
   */
  const pod = req.nextUrl.searchParams.get('pod')?.trim();
  const komu = req.nextUrl.searchParams.get('komu')?.trim();
  if (pod && komu) {
    return NextResponse.json(await zkusOdeslatPod(pod, komu));
  }

  const heslo = process.env.PR_SMTP_PASSWORD?.trim();
  if (!heslo) return NextResponse.json({ ok: false, duvod: 'Chybí PR_SMTP_PASSWORD.' });

  const host = (req.nextUrl.searchParams.get('host') || process.env.PR_SMTP_HOST || '').trim();
  if (!POVOLENE.includes(host)) {
    return NextResponse.json({ ok: false, duvod: `Server ${host} není v povoleném seznamu.` });
  }
  const port = Number(req.nextUrl.searchParams.get('port') || process.env.PR_SMTP_PORT || 587);
  const user = (req.nextUrl.searchParams.get('user') || process.env.PR_SMTP_USER || '').trim();

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: heslo },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    await transport.verify();
    return NextResponse.json({ ok: true, host, port, user, delkaHesla: heslo.length });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      host,
      port,
      user,
      delkaHesla: heslo.length,
      duvod: err instanceof Error ? err.message.slice(0, 300) : 'neznámá chyba',
    });
  }
}
