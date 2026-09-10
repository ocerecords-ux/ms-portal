import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { STAVY_S_NOTIFIKACI, prazdneNastaveni } from '@/lib/notifikaceFirmy';

/**
 * Nastavení zpráv klientovi podle stavu projektu (zadání 10. 9. 2026).
 *
 * GET vrátí nastavení firmy doplněné o chybějící stavy (co uložené není, se
 * neposílá). PUT uloží celou tabulku najednou - je jich pět řádků, takže
 * ukládat po jednom by znamenalo pět dotazů a pět míst, kde se to může
 * rozejít.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nastaveni: z.record(z.enum(['NIKAM', 'KLIENT', 'INTERNE'])),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const radky = await prisma.notifikaceFirmy.findMany({
    where: { companyId: params.id },
    select: { stav: true, komu: true },
  });

  const nastaveni = prazdneNastaveni();
  for (const r of radky) {
    if (r.stav in nastaveni) nastaveni[r.stav] = r.komu;
  }
  return NextResponse.json({ nastaveni });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const firma = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!firma) return NextResponse.json({ error: 'Firma nenalezena.' }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  }

  // Ulozi se jen stavy, ktere zname - cokoliv jineho by v tabulce zustalo
  // viset a nikdo by uz nezjistil, odkud se to vzalo.
  const zapisy = Object.entries(parsed.data.nastaveni).filter(([stav]) => STAVY_S_NOTIFIKACI.includes(stav));

  await prisma.$transaction(
    zapisy.map(([stav, komu]) =>
      prisma.notifikaceFirmy.upsert({
        where: { companyId_stav: { companyId: params.id, stav } },
        create: { companyId: params.id, stav, komu },
        update: { komu },
      }),
    ),
  );

  return NextResponse.json({ ulozeno: true });
}
