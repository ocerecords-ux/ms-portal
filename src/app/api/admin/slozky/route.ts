import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { extractDriveFolderId } from '@/lib/googleDrive';

/**
 * SLOŽKY NA DISKU, KTERÉ PORTÁL NABÍZÍ (zadání 30. 9. 2026: „máme na disku
 * složky: Klientská zóna, Dokumenty, Marketing. Potřebuju, ať někteří
 * uživatelé nevidí některé složky").
 *
 * Číselník, který si správce sám rozšiřuje - komu se která složka ukáže, se
 * zaškrtává na kartě účtu.
 */
const schema = z.object({
  nazev: z.string().trim().min(1, 'Vyplňte název složky.').max(80),
  driveUrl: z.string().trim().min(10, 'Vyplňte odkaz na složku na Disku.').max(500),
  popis: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    /**
     * Odkaz se ověří hned při zakládání. Bez tohohle by se špatně zkopírovaná
     * adresa projevila až tím, že se někomu v Nahrávkách složka vůbec
     * neukáže - a hledalo by se to v přístupech, ne v překlepu.
     */
    if (!extractDriveFolderId(parsed.data.driveUrl)) {
      return NextResponse.json(
        { error: 'Z odkazu nejde vyčíst složka. Otevřete složku na Disku a zkopírujte adresu z řádku prohlížeče.' },
        { status: 400 },
      );
    }

    const posledni = await prisma.diskovaSlozka.findFirst({
      orderBy: { poradi: 'desc' },
      select: { poradi: true },
    });

    const slozka = await prisma.diskovaSlozka.create({
      data: {
        nazev: parsed.data.nazev,
        driveUrl: parsed.data.driveUrl,
        popis: parsed.data.popis || null,
        poradi: ((posledni?.poradi as number | undefined) ?? 0) + 10,
      },
    });

    return NextResponse.json(slozka, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/slozky selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
