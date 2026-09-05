import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';
import { PROJECT_TYPE_KEYS } from '@/lib/projectTypes';

// Ulozeni internich atributu projektu (model ProjectMeta) - zadani
// 5. 9. 2026. Menit je smi POUZE Produkce a Zuzo-labuzo; zvukar ma jen
// nahled ke cteni, klient se sem nedostane vubec.
const schema = z.object({
  driveUrl: z.string().trim().max(2000).optional(),
  managerUserId: z.string().trim().optional(),
  priority: z.enum(['', 'LOW', 'MEDIUM', 'HIGH']).optional(),
  projectType: z.string().trim().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !canEditProjectMeta(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění tyto údaje měnit.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const data = parsed.data;

    if (data.driveUrl && !/^https?:\/\//i.test(data.driveUrl)) {
      return NextResponse.json({ error: 'Odkaz na KZ musí začínat http:// nebo https://.' }, { status: 400 });
    }
    if (data.projectType && !PROJECT_TYPE_KEYS.includes(data.projectType)) {
      return NextResponse.json({ error: 'Neznámý typ projektu.' }, { status: 400 });
    }

    // Manazer musi byt existujici interni ucet MEDIA SPACE.
    if (data.managerUserId) {
      const manager = await prisma.user.findFirst({
        where: { id: data.managerUserId, role: { in: ['ADMIN', 'ZVUKAR', 'PRODUKCE'] } },
        select: { id: true },
      });
      if (!manager) {
        return NextResponse.json({ error: 'Vybraný manažer neexistuje.' }, { status: 400 });
      }
    }

    const values = {
      driveUrl: data.driveUrl ? data.driveUrl : null,
      managerUserId: data.managerUserId ? data.managerUserId : null,
      priority: data.priority ? data.priority : null,
      projectType: data.projectType ? data.projectType : null,
    };

    const meta = await prisma.projectMeta.upsert({
      where: { caflouProjectId: params.id },
      create: { caflouProjectId: params.id, ...values },
      update: values,
    });

    return NextResponse.json(meta);
  } catch (err) {
    console.error('PATCH /api/projects/[id]/meta selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
