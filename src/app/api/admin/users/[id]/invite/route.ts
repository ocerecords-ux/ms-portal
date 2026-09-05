import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { sendInviteEmail } from '@/lib/email';

// Odeslani pozvanky uzivateli (zadani 5. 9. 2026): vygeneruje jednorazovy
// token, ulozi ho k uzivateli a posle mu e-mail s odkazem, kde si sam
// nastavi heslo. Opakovane odeslani token vzdy prepise - stary odkaz tim
// prestane platit.
const INVITE_VALID_DAYS = 7;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) return NextResponse.json({ error: 'Uživatel nenalezen.' }, { status: 404 });
    if (!user.active) {
      return NextResponse.json({ error: 'Uživatel je neaktivní - nejdřív ho aktivujte.' }, { status: 400 });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { inviteToken: token, inviteTokenExpires: expiresAt, invitedAt: new Date() },
    });

    const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const inviteUrl = `${baseUrl}/nastaveni-hesla?token=${token}`;

    const result = await sendInviteEmail({
      to: user.email,
      name: user.name,
      inviteUrl,
      expiresAt,
    });

    if (!result.sent) {
      // Token je ulozeny, jen se ho nepodarilo odeslat - admin muze odkaz
      // predat rucne, aby uzivatel nezustal viset.
      return NextResponse.json(
        {
          error: 'E-mail se nepodařilo odeslat (SMTP zatím není nastavené). Odkaz můžete poslat ručně.',
          inviteUrl,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, sentTo: user.email, expiresAt });
  } catch (err) {
    console.error('POST /api/admin/users/[id]/invite selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Odeslání pozvánky se nezdařilo (${message}).` }, { status: 500 });
  }
}
