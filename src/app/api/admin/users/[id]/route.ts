import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

// Zatim jen upravuje stitek dane osoby v Caflou (viz schema.prisma > User.caflouTag).
// Rozsirit pripadne o dalsi editovatelna pole (jmeno, aktivni...) az bude potreba.
const schema = z.object({
  caflouTag: z.string().trim().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      caflouTag: parsed.data.caflouTag || null,
    },
    select: { id: true, email: true, name: true, role: true, caflouTag: true, createdAt: true },
  });

  return NextResponse.json(user);
}
