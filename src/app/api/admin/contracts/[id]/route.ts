import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { resolveProject } from '@/lib/projectOptions';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';

// Uprava a smazani smlouvy. Podepsanou smlouvu uz nejde menit ani smazat -
// jinak by prestaly sedet otisky u podpisu a dolozka by nemela cenu.
const schema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().max(60000).optional(),
  companyId: z.string().trim().nullable().optional(),
  signerName: z.string().trim().min(1).max(200).optional(),
  signerEmail: z.string().trim().email().optional(),
  caflouProjectId: z.string().trim().nullable().optional(),
  /** Zrušení smlouvy - jediná změna stavu, kterou tudy pouštíme. */
  cancel: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;

    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      include: { signatures: { select: { id: true } } },
    });
    if (!contract) return odpovedChyby('chybaApi.smlouvaNenalezena', 404);

    if (contract.status === 'SIGNED') {
      return odpovedChyby('chybaApi.podepsanouSmlouvuNejdeMenit', 409);
    }

    const data: Record<string, unknown> = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.signerName !== undefined) data.signerName = d.signerName;
    if (d.signerEmail !== undefined) data.signerEmail = d.signerEmail;
    if (d.companyId !== undefined) data.companyId = d.companyId || null;
    if (d.caflouProjectId !== undefined) {
      const projekt = await resolveProject(d.caflouProjectId);
      data.caflouProjectId = projekt.caflouProjectId;
      data.projectName = projekt.projectName;
    }

    if (d.body !== undefined) {
      // Zmena textu shodi uz porizene podpisy - clovek podepisoval jine zneni.
      if (d.body.trim() !== contract.body.trim() && contract.signatures.length > 0) {
        await prisma.contractSignature.deleteMany({ where: { contractId: contract.id } });
        data.status = 'DRAFT';
        data.sentAt = null;
        data.bodyHash = null;
        data.completedAt = null;
      }
      data.body = d.body;
    }

    if (d.cancel) {
      data.status = 'CANCELLED';
    }

    await prisma.contract.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/contracts/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return odpovedChybyS('chybaApi.ulozeniNezdariloS', { zprava: message }, 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: { status: true },
    });
    if (!contract) return odpovedChyby('chybaApi.smlouvaNenalezena', 404);
    if (contract.status === 'SIGNED') {
      return odpovedChyby('chybaApi.podepsanouSmlouvuNejdeSmazat', 409);
    }

    await prisma.contract.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/contracts/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return odpovedChybyS('chybaApi.smazaniNezdariloS', { zprava: message }, 500);
  }
}
