import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { extractDriveFolderId } from '@/lib/googleDrive';

/**
 * Úprava a vypnutí složky na Disku (zadání 30. 9. 2026).
 *
 * MAZÁNÍ TU SCHVÁLNĚ NENÍ: smazáním by zmizela i zaškrtnutí u všech účtů
 * a nedalo by se vrátit. Vypnutá složka se nikomu nenabízí, ale komu byla
 * přidělená, to zůstane zapsané - když šlo o dočasné skrytí, stačí ji zase
 * zapnout a nikdo nic nenastavuje znovu.
 */
const schema = z.object({
  nazev: z.string().trim().min(1, 'Vyplňte název složky.').max(80).optional(),
  driveUrl: z.string().trim().min(10).max(500).optional(),
  popis: z.string().trim().max(200).nullable().optional(),
  poradi: z.number().int().optional(),
  aktivni: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    if (parsed.data.driveUrl && !extractDriveFolderId(parsed.data.driveUrl)) {
      return NextResponse.json(
        { error: 'Z odkazu nejde vyčíst složka. Otevřete složku na Disku a zkopírujte adresu z řádku prohlížeče.' },
        { status: 400 },
      );
    }

    const slozka = await prisma.diskovaSlozka.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.nazev !== undefined ? { nazev: parsed.data.nazev } : {}),
        ...(parsed.data.driveUrl !== undefined ? { driveUrl: parsed.data.driveUrl } : {}),
        ...(parsed.data.popis !== undefined ? { popis: parsed.data.popis || null } : {}),
        ...(parsed.data.poradi !== undefined ? { poradi: parsed.data.poradi } : {}),
        ...(parsed.data.aktivni !== undefined ? { aktivni: parsed.data.aktivni } : {}),
      },
    });

    return NextResponse.json(slozka);
  } catch (err) {
    console.error('PATCH /api/admin/slozky/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
