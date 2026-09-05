import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';

// Verejny endpoint (zamerne mimo /api/admin i mimo middleware matcher) -
// uzivatel sem prijde z odkazu v pozvance a nastavi si heslo. Autorizuje ho
// jednorazovy token, ktery se pri uspechu hned zneplatni.
const schema = z.object({
  token: z.string().trim().min(10),
  password: z.string().min(8, 'Heslo musí mít alespoň 8 znaků.'),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const { token, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { inviteToken: token } });
    if (!user || !user.inviteTokenExpires || user.inviteTokenExpires < new Date()) {
      return NextResponse.json({ error: 'Odkaz už není platný. Požádejte prosím o novou pozvánku.' }, { status: 400 });
    }
    if (!user.active) {
      return NextResponse.json({ error: 'Účet je neaktivní. Kontaktujte prosím MEDIA SPACE.' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        inviteToken: null,
        inviteTokenExpires: null,
        passwordSetAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, email: user.email });
  } catch (err) {
    console.error('POST /api/set-password selhalo:', err);
    return NextResponse.json({ error: 'Nastavení hesla se nezdařilo.' }, { status: 500 });
  }
}
