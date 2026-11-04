import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { sendInviteEmail, type InviteAudience } from '@/lib/email';
import { jeEmail } from '@/lib/prihlasovaciJmeno';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';
import { prelozit } from '@/lib/jazyk';

// Odeslani pozvanky uzivateli (zadani 5. 9. 2026): vygeneruje jednorazovy
// token, ulozi ho k uzivateli a posle mu e-mail s odkazem, kde si sam
// nastavi heslo. Opakovane odeslani token vzdy prepise - stary odkaz tim
// prestane platit.
const INVITE_VALID_DAYS = 7;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) return odpovedChyby('chybaApi.uzivatelNenalezen', 404);
    if (!user.active) {
      return odpovedChyby('chybaApi.uzivatelNeaktivni', 400);
    }
    /**
     * Účet se od 29. 9. 2026 může přihlašovat i jménem bez zavináče (tabule
     * ve studiu). Pozvánka pak nemá kam odejít - a je lepší to říct rovnou
     * než vyrobit token, který nikdo nedostane.
     */
    if (!jeEmail(user.email)) {
      return odpovedChyby('chybaApi.ucetBezEmailu', 400);
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { inviteToken: token, inviteTokenExpires: expiresAt, invitedAt: new Date() },
    });

    const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const inviteUrl = `${baseUrl}/nastaveni-hesla?token=${token}`;

    // Text pozvanky se lisi podle toho, komu jde (zadani 5. 9. 2026) -
    // klientovi, internimu cloveku z Mediaspace, nebo herci.
    const audience: InviteAudience =
      user.role === 'HEREC' ? 'HEREC' : user.role === 'CLIENT' ? 'CLIENT' : 'INTERNAL';

    const result = await sendInviteEmail({
      to: user.email,
      name: user.name,
      inviteUrl,
      expiresAt,
      audience,
    });

    if (!result.sent) {
      // Token je ulozeny, jen se ho nepodarilo odeslat - admin muze odkaz
      // predat rucne, aby uzivatel nezustal viset.
      // Vedle klice jde dal i odkaz, ktery si admin predava rucne - proto se
      // odpoved sklada tady a ne pres `odpovedChyby` (to posila jen chybu).
      return NextResponse.json(
        {
          error: prelozit('cs', 'chybaApi.pozvankaBezSmtp'),
          klic: 'chybaApi.pozvankaBezSmtp',
          inviteUrl,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, sentTo: user.email, expiresAt });
  } catch (err) {
    console.error('POST /api/admin/users/[id]/invite selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return odpovedChybyS('chybaApi.pozvankaNeodeslanaS', { zprava: message }, 500);
  }
}
