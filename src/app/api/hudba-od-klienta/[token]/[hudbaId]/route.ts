import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { odpovedChyby } from '@/lib/chybyApi';
import { prisma } from '@/lib/db';
import { odpojSkladbu, upravPoznamku } from '@/lib/hudbaProjektuServer';
import { rozesliUpravuDoSerie } from '@/lib/hudbaSerieServer';

/**
 * POZNÁMKA KE SKLADBĚ OD KLIENTA (zadání 17. 10. 2026: „klient pro vkládání
 * u hudby by měl mít taky možnost poznámky ke každému tracku").
 *
 * Mění se JEN poznámka a JEN u skladby, která patří k projektu z tokenu -
 * jinak by se cizím odkazem dalo psát do kterékoliv skladby v portálu.
 *
 * DELETE - SMAZÁNÍ SVÉ SKLADBY (připomínka klientky 19. 11. 2026: „stačí
 * kliknout na ten soubor nebo ho přetáhnout a automaticky se nahraje. A pak
 * už s tím nejde nic dělat. Což nechceš, když se třeba uklikneš").
 *
 * Smazat jde jen to, co vložil klient (`puvod = 'klient'`). Co jsme k projektu
 * přidali my, mu z odkazu zmizet nemůže.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ poznamka: z.string().trim().max(500).nullable() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; hudbaId: string }> },
) {
  const { token, hudbaId } = await params;
  const vyzva = (await prisma.vyzvaHudba
    .findUnique({ where: { token }, select: { caflouProjectId: true } })
    .catch(() => null)) as { caflouProjectId: string } | null;
  if (!vyzva) return odpovedChyby('chybaApi.odkazNeplati', 404);

  const skladba = (await prisma.hudbaProjektu
    .findUnique({ where: { id: hudbaId }, select: { caflouProjectId: true } })
    .catch(() => null)) as { caflouProjectId: string } | null;
  if (!skladba || skladba.caflouProjectId !== vyzva.caflouProjectId) {
    return odpovedChyby('chybaApi.skladbaSemNepatri', 404);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);

  const ok = await upravPoznamku(hudbaId, parsed.data.poznamka);
  // Poznámka klienta platí pro celou sérii stejně jako naše (17. 10. 2026).
  if (ok) await rozesliUpravuDoSerie({ hudbaId });
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; hudbaId: string }> },
) {
  const { token, hudbaId } = await params;
  const vyzva = (await prisma.vyzvaHudba
    .findUnique({ where: { token }, select: { caflouProjectId: true } })
    .catch(() => null)) as { caflouProjectId: string } | null;
  if (!vyzva) return odpovedChyby('chybaApi.odkazNeplati', 404);

  const skladba = (await prisma.hudbaProjektu
    .findUnique({ where: { id: hudbaId }, select: { caflouProjectId: true, puvod: true } })
    .catch(() => null)) as { caflouProjectId: string; puvod: string } | null;
  if (!skladba || skladba.caflouProjectId !== vyzva.caflouProjectId) {
    return odpovedChyby('chybaApi.skladbaSemNepatri', 404);
  }
  // Cizí (naši) skladbu klient nesmaže - smí pryč jen to, co sám vložil.
  if (skladba.puvod !== 'klient') return odpovedChyby('chybaApi.bezOpravneni', 403);

  const ok = await odpojSkladbu(hudbaId);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
