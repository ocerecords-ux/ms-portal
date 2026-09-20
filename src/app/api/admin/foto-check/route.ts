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

  // Od 20. 9. 2026 se kouká na VŠECHNY účty, ne jen na tým Mediaspace
  // („ověř to u všech"), a vedle samotné fotky i na PŘÍZNAK `maFotku`:
  // seznamy, lišta a chat se řídí jen jím (viz lib/fotky.ts), takže fotka
  // uložená bez příznaku se nikde neukáže.
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, photoUrl: true, maFotku: true },
    orderBy: [{ name: 'asc' }],
  });

  const ucty = users
    .map((u) => {
      const fotka = u.photoUrl ?? '';
      const priznakSedi = u.maFotku === Boolean(fotka);
      return {
        kdo: u.name || u.email,
        role: u.role,
        maFotku: Boolean(fotka),
        priznakVDatabazi: u.maFotku,
        // Když tohle není true, fotka je uložená, ale nikde se neukáže.
        priznakSedi,
        druh: !fotka
          ? 'nic'
          : fotka.startsWith('data:')
            ? 'data: URL (uložená přímo v databázi)'
            : fotka.startsWith('http')
              ? 'odkaz do úložiště'
              : 'něco jiného',
        delka: fotka.length,
        zacatek: fotka ? fotka.slice(0, 60) : null,
        // Adresa, přes kterou fotku vydává portál - tahle má fungovat všude.
        odkaz: fotka ? `/api/uzivatele/${u.id}/fotka` : null,
      };
    })
    // Účty bez fotky a se správným příznakem nemá cenu vypisovat.
    .filter((u) => u.maFotku || !u.priznakSedi);

  return NextResponse.json({
    souhrn: {
      uctuCelkem: users.length,
      sFotkou: ucty.filter((u) => u.maFotku).length,
      vUlozisti: ucty.filter((u) => u.druh === 'odkaz do úložiště').length,
      vDatabazi: ucty.filter((u) => u.druh.startsWith('data:')).length,
      spatnyPriznak: ucty.filter((u) => !u.priznakSedi).length,
    },
    ucty,
  });
}
