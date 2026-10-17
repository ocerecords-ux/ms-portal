import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { zapisSkladbu } from '@/lib/hudbaProjektuServer';
import { overPrilohu } from '@/lib/storage';
import { oznacVlozeni } from '@/lib/vyzvaHudbaServer';

/**
 * HUDBA, KTEROU VLOŽIL KLIENT (zadání 17. 10. 2026).
 *
 * VEŘEJNÉ, ALE JEN NA JEDEN PROJEKT. Přihlášení tu není - hudbu u klienta
 * často řeší někdo, kdo v portálu účet nemá. Token je jediný klíč a vede
 * vždycky na jeden konkrétní projekt; nic jiného se přes něj dělat nedá.
 *
 * Soubor tudy NEJDE, jen záznam o něm - samotný WAV putuje z prohlížeče
 * rovnou do Dropboxu (viz podpis/route.ts).
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  cesta: z.string().trim().min(1),
  nazev: z.string().trim().max(200),
  autor: z.string().trim().max(200).nullable().optional(),
  delkaS: z.number().int().min(0).max(24 * 3600).optional(),
  obalKlic: z.string().trim().max(300).nullable().optional(),
  jmeno: z.string().trim().max(120).nullable().optional(),
});

/** Projekt, na který token vede. Nic jiného z tokenu nevyčteme. */
export async function projektZTokenu(token: string): Promise<string | null> {
  const vyzva = (await prisma.vyzvaHudba
    .findUnique({ where: { token }, select: { caflouProjectId: true } })
    .catch(() => null)) as { caflouProjectId: string } | null;
  return vyzva?.caflouProjectId ?? null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const caflouProjectId = await projektZTokenu(token);
  if (!caflouProjectId) return NextResponse.json({ error: 'Odkaz neplatí.' }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const obalKlic = parsed.data.obalKlic?.trim() || null;
  const obalOvereny = obalKlic && (await overPrilohu(obalKlic)) ? obalKlic : null;

  const skladba = await zapisSkladbu({
    caflouProjectId,
    cesta: parsed.data.cesta,
    nazev: parsed.data.nazev,
    autor: parsed.data.autor ?? null,
    delkaS: parsed.data.delkaS ?? 0,
    obalKlic: obalOvereny,
    puvod: 'klient',
    vlozilKlient: parsed.data.jmeno ?? null,
    pridalId: null,
  });
  if (!skladba) {
    return NextResponse.json(
      { error: 'Soubor se nepodařilo uložit. Zkuste to prosím znovu.' },
      { status: 502 },
    );
  }

  await oznacVlozeni(token, parsed.data.jmeno ?? null);
  return NextResponse.json({ skladba }, { status: 201 });
}
