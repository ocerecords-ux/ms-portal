import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

// Diagnostika fotek (zprava uzivatele 8. 9. 2026: "nezobrazujou se fotky").
// Vypise, co je u uctu opravdu ulozene v photoUrl - jestli tam neni nic,
// nebo tam visi stara adresa do S3, ktera uz nic nevraci. Samotna data
// (data: URL byva stovky kB) se nevypisuji, jen zacatek a delka.
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'ZVUKAR', 'PRODUKCE'] } },
    select: { id: true, name: true, email: true, photoUrl: true },
    orderBy: [{ name: 'asc' }],
  });

  return NextResponse.json({
    ucty: users.map((u) => ({
      kdo: u.name || u.email,
      maFotku: Boolean(u.photoUrl),
      druh: !u.photoUrl
        ? 'nic'
        : u.photoUrl.startsWith('data:')
          ? 'data: URL (uložená přímo v databázi)'
          : u.photoUrl.startsWith('http')
            ? 'odkaz do úložiště'
            : 'něco jiného',
      delka: u.photoUrl?.length ?? 0,
      zacatek: u.photoUrl ? u.photoUrl.slice(0, 60) : null,
    })),
  });
}
