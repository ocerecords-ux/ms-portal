import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';

// Zapomenute heslo (zadani 5. 9. 2026) - verejny endpoint. Pouziva stejny
// jednorazovy token jako pozvanka (User.inviteToken), jen s kratsi platnosti;
// uzivatel pak konci na stejne strance /nastaveni-hesla.
//
// DULEZITE: odpoved je VZDY stejna, i kdyz ucet neexistuje nebo je neaktivni -
// jinak by stranka prozradila, ktere e-maily v portalu existuji.
const RESET_VALID_HOURS = 2;

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function POST(req: NextRequest) {
  const ok = NextResponse.json({
    ok: true,
    message: 'Pokud účet s tímto e-mailem existuje, poslali jsme na něj odkaz pro nastavení nového hesla.',
  });

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return ok;

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !user.active) return ok;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_VALID_HOURS * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { inviteToken: token, inviteTokenExpires: expiresAt },
    });

    const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: `${baseUrl}/nastaveni-hesla?token=${token}`,
      expiresAt,
    });
  } catch (err) {
    console.error('POST /api/forgot-password selhalo:', err);
  }

  return ok;
}
